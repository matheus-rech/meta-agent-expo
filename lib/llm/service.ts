/**
 * LLM Service — Tiered fallback: Cloud API → Ollama → Templates
 *
 * Tier 1: Cloud LLM (Gemini Flash — free tier available)
 * Tier 2: Local Ollama (if running on localhost:11434)
 * Tier 3: Rule-based templates for common meta-analysis queries
 *
 * API keys stored via expo-secure-store, not in this module.
 */

export interface LLMConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tier: "cloud" | "ollama" | "template";
  model: string;
  tokensUsed?: number;
}

type TierStatus = "available" | "unavailable" | "checking";

const SYSTEM_PROMPT = `You are Meta Agent, a specialized AI assistant for medical researchers conducting meta-analyses and systematic reviews.

## Core Capabilities
- You have deep knowledge of meta-analysis methodology (Cochrane Handbook, PRISMA 2020)
- You can write R code using the metafor and meta packages for statistical analysis
- You understand effect sizes (OR, RR, RD, SMD, MD, HR), heterogeneity (I², τ², Q), and publication bias
- You help with PRISMA flowcharts, risk of bias assessment (RoB 2, NOS, ROBINS-I), and GRADE

## R Code Generation Rules
When asked to perform analysis or generate plots, write executable R code using:
- \`library(metafor)\` for meta-analysis models (rma, forest, funnel, regtest)
- \`library(meta)\` for metabin, metacont, metaprop, metagen functions
- Always use the REML estimator for random-effects models unless specified
- Include comments explaining each step
- Wrap R code in \`\`\`r code blocks

## Response Style
- Be concise but thorough — this is for researchers
- Cite methodological references when relevant (Higgins, Viechtbauer, Harrer)
- When showing statistical results, explain their clinical interpretation
- Suggest next steps in the analysis workflow

## Important
- You are running in a mobile environment with WebR (R compiled to WebAssembly)
- Available packages: metafor, meta (more can be installed by the user)
- Plots are generated as PNG images
- Keep code concise — WebR has memory limits (~2GB)`;

class LLMService {
  private config: LLMConfig = {};
  private conversationHistory: LLMMessage[] = [];
  private ollamaStatus: TierStatus = "unavailable";

  configure(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
    if (config.ollamaUrl) this.checkOllama();
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  getTierStatuses(): {
    cloud: TierStatus;
    ollama: TierStatus;
    template: TierStatus;
  } {
    return {
      cloud: this.config.geminiApiKey ? "available" : "unavailable",
      ollama: this.ollamaStatus,
      template: "available",
    };
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async checkOllama(): Promise<boolean> {
    const url = this.config.ollamaUrl || "http://localhost:11434";
    try {
      this.ollamaStatus = "checking";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${url}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        this.ollamaStatus = "available";
        return true;
      }
    } catch {
      // Ollama not running
    }
    this.ollamaStatus = "unavailable";
    return false;
  }

  async complete(userMessage: string): Promise<LLMResponse> {
    this.conversationHistory.push({ role: "user", content: userMessage });

    // Tier 1: Cloud API (Gemini)
    if (this.config.geminiApiKey) {
      try {
        const response = await this.callGemini(userMessage);
        this.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });
        return response;
      } catch (err) {
        console.warn("Cloud LLM failed, falling back:", err);
      }
    }

    // Tier 2: Ollama
    if (this.ollamaStatus === "available") {
      try {
        const response = await this.callOllama(userMessage);
        this.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });
        return response;
      } catch (err) {
        console.warn("Ollama failed, falling back to templates:", err);
      }
    }

    // Tier 3: Templates
    const response = this.getTemplateResponse(userMessage);
    this.conversationHistory.push({
      role: "assistant",
      content: response.content,
    });
    return response;
  }

  private async callGemini(userMessage: string): Promise<LLMResponse> {
    const model = this.config.geminiModel || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.geminiApiKey}`;

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I am Meta Agent, ready to assist with meta-analysis and systematic reviews.",
          },
        ],
      },
      ...this.conversationHistory.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated.";

    return {
      content: text,
      tier: "cloud",
      model,
      tokensUsed: data.usageMetadata?.totalTokenCount,
    };
  }

  private async callOllama(userMessage: string): Promise<LLMResponse> {
    const url = this.config.ollamaUrl || "http://localhost:11434";
    const model = this.config.ollamaModel || "qwen2.5-coder:3b";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...this.conversationHistory.slice(-10),
    ];

    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { num_predict: 2048 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || "No response generated.",
      tier: "ollama",
      model,
    };
  }

  private getTemplateResponse(userMessage: string): LLMResponse {
    const lower = userMessage.toLowerCase();

    for (const template of TEMPLATES) {
      if (template.triggers.some((t) => lower.includes(t))) {
        return {
          content: template.response,
          tier: "template",
          model: "rule-based",
        };
      }
    }

    return {
      content: `I'm currently running in offline template mode (no API key configured and Ollama not detected).

To enable full AI capabilities:
1. **Cloud API**: Go to Settings → enter your Gemini API key (free tier available at aistudio.google.com)
2. **Local LLM**: Install Ollama (ollama.com) and run \`ollama run qwen2.5-coder:3b\`

Meanwhile, I can still help with:
- **/r <code>** — Execute R code directly
- **/help** — See available commands
- **/meta** — Meta-analysis help
- **/forest** / **/funnel** — Plot guides`,
      tier: "template",
      model: "rule-based",
    };
  }
}

const TEMPLATES = [
  {
    triggers: [
      "meta-analysis",
      "metaanalysis",
      "random effects",
      "fixed effect",
    ],
    response: `Here's how to run a **random-effects meta-analysis** using metafor:

\`\`\`r
library(metafor)

# Example: binary outcome (OR)
dat <- escalc(measure = "OR",
  ai = events_tx, bi = n_tx - events_tx,
  ci = events_ctrl, di = n_ctrl - events_ctrl,
  data = study_data)

# Fit random-effects model (REML)
res <- rma(yi, vi, data = dat, method = "REML")
summary(res)

# Forest plot
forest(res, slab = dat$study,
  xlab = "Odds Ratio",
  header = "Author(s) and Year")
\`\`\`

Replace \`study_data\` with your dataframe or use \`/r\` to run this directly.

**Key outputs to check:**
- Pooled estimate and 95% CI
- I² (heterogeneity) — >50% is substantial
- Q-test p-value
- τ² (between-study variance)`,
  },
  {
    triggers: ["forest plot", "forest"],
    response: `To create a **forest plot** in R:

\`\`\`r
library(metafor)

# Assuming 'res' is your rma() model
forest(res,
  slab = dat$study,
  xlab = "Effect Size",
  header = "Author(s) and Year",
  refline = 0,
  cex = 0.8,
  col = "darkblue",
  border = "darkblue")

# Add prediction interval
addpoly(res, row = -1, mlab = "Prediction Interval")
\`\`\`

Use **/r** to execute this code with your data loaded.`,
  },
  {
    triggers: ["funnel plot", "publication bias", "egger"],
    response: `For **publication bias** assessment:

\`\`\`r
library(metafor)

# Funnel plot
funnel(res, main = "Funnel Plot")

# Contour-enhanced funnel plot
funnel(res, level = c(90, 95, 99),
  shade = c("white", "gray75", "gray95"),
  refline = 0, legend = TRUE)

# Egger's regression test
regtest(res, model = "lm")

# Trim-and-fill
tf <- trimfill(res)
summary(tf)
funnel(tf)
\`\`\`

**Interpretation:**
- Funnel asymmetry suggests publication bias
- Egger's p < 0.10 is significant
- Trim-and-fill estimates # of "missing" studies`,
  },
  {
    triggers: ["heterogeneity", "i-squared", "i2", "tau-squared", "tau2"],
    response: `**Heterogeneity assessment** from your meta-analysis model:

\`\`\`r
library(metafor)

# After fitting: res <- rma(yi, vi, data = dat)
# Key heterogeneity statistics:
cat("I² =", round(res$I2, 1), "%\\n")
cat("τ² =", round(res$tau2, 4), "\\n")
cat("H² =", round(res$H2, 2), "\\n")
cat("Q =", round(res$QE, 2),
    ", df =", res$k - 1,
    ", p =", round(res$QEp, 4), "\\n")

# Prediction interval
predict(res)
\`\`\`

**Thresholds (Cochrane Handbook):**
- I² 0-40%: might not be important
- I² 30-60%: moderate heterogeneity
- I² 50-90%: substantial
- I² 75-100%: considerable`,
  },
  {
    triggers: ["risk of bias", "rob", "quality assessment"],
    response: `For **Risk of Bias** assessment:

**RoB 2 (RCTs)** — 5 domains:
1. Randomization process
2. Deviations from intended interventions
3. Missing outcome data
4. Measurement of the outcome
5. Selection of the reported result

**NOS (Observational)** — 0-9 stars across:
- Selection (4 stars)
- Comparability (2 stars)
- Outcome/Exposure (3 stars)

\`\`\`r
# Using robvis for visualization
library(robvis)

rob_data <- data.frame(
  Study = c("Smith 2019", "Jones 2020"),
  D1 = c("Low", "Some concerns"),
  D2 = c("Low", "Low"),
  D3 = c("Low", "High"),
  D4 = c("Some concerns", "Low"),
  D5 = c("Low", "Low"),
  Overall = c("Some concerns", "High")
)

rob_summary(rob_data, tool = "ROB2")
rob_traffic_light(rob_data, tool = "ROB2")
\`\`\``,
  },
  {
    triggers: ["grade", "certainty of evidence", "evidence quality"],
    response: `The **GRADE framework** assesses certainty of evidence:

**Starting level:**
- RCTs → High
- Observational → Low

**Rate down for:**
1. Risk of bias
2. Inconsistency (I² > 50%)
3. Indirectness
4. Imprecision (wide CIs, small N)
5. Publication bias

**Rate up for (observational only):**
- Large effect (>2x or >5x)
- Dose-response gradient
- Plausible confounders would reduce effect

**Final:** ⊕⊕⊕⊕ High → ⊕⊕⊕◯ Moderate → ⊕⊕◯◯ Low → ⊕◯◯◯ Very Low

For a Summary of Findings table, prepare your data and I can help generate the R code.`,
  },
];

// Singleton
let instance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!instance) {
    instance = new LLMService();
  }
  return instance;
}
