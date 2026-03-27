/**
 * Agent Engine — Orchestrates LLM + WebR + Commands for real agent behavior
 */

import { executeSlashCommand } from "./commands";
import { getMemory } from "./memory";
import { getLLMService, type LLMConfig } from "../llm/service";
import { getWebRService } from "../webr/service";
import type { TerminalMessage, MessageType, SlashCommandSuggestion } from "./types";

let msgIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

function createMessage(
  type: MessageType,
  content: string,
  extra?: Partial<TerminalMessage>
): TerminalMessage {
  return {
    id: nextId(),
    type,
    content,
    timestamp: Date.now(),
    ...extra,
  };
}

const ASCII_BANNER = `
 ███╗   ███╗███████╗████████╗ █████╗
 ████╗ ████║██╔════╝╚══██╔══╝██╔══██╗
 ██╔████╔██║█████╗     ██║   ███████║
 ██║╚██╔╝██║██╔══╝     ██║   ██╔══██║
 ██║ ╚═╝ ██║███████╗   ██║   ██║  ██║
 ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝
    ─── AGENT MOBILE v3.0 ───
  Real R · Real AI · Real Analysis
`;

export const SLASH_COMMANDS: SlashCommandSuggestion[] = [
  { command: "/help", description: "Show help message" },
  { command: "/clear", description: "Clear terminal" },
  { command: "/r", description: "Execute R code (e.g. /r summary(cars))" },
  { command: "/status", description: "Check R + AI status" },
  { command: "/install", description: "Install R package" },
  { command: "/packages", description: "List installed packages" },
  { command: "/history", description: "Show command history" },
  { command: "/reset", description: "Reset conversation context" },
  { command: "/skills", description: "List available skills" },
  { command: "/version", description: "Show version info" },
  { command: "/meta", description: "Meta-analysis help" },
  { command: "/forest", description: "Generate forest plot" },
  { command: "/funnel", description: "Generate funnel plot" },
];

export function getInitialMessages(): TerminalMessage[] {
  return [
    createMessage("banner", ASCII_BANNER),
    createMessage(
      "system",
      "Welcome to **Meta Agent Mobile v3.0**. Type /help for commands."
    ),
  ];
}

function extractRCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```r\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Main input handler — routes through commands, WebR, or LLM
 */
export async function handleInput(
  input: string,
  onThinkingStart: () => void,
  onThinkingEnd: () => void
): Promise<TerminalMessage[]> {
  const trimmed = input.trim();
  const memory = getMemory();
  memory.addToHistory(trimmed);

  // Try slash commands first
  if (trimmed.startsWith("/")) {
    const result = await executeSlashCommand(trimmed);

    if (result.handled && result.response) {
      // Handle special markers
      if (result.response === "__CLEAR__") {
        return [];
      }

      if (result.response === "__STATUS__") {
        return await buildStatusMessage();
      }

      if (result.response === "__R_STATUS__") {
        return await buildRStatusMessage();
      }

      if (result.response.startsWith("__R_EXECUTE__:")) {
        const code = result.response.substring("__R_EXECUTE__:".length);
        return await executeRCode(code, onThinkingStart, onThinkingEnd);
      }

      if (result.response.startsWith("__R_INSTALL__:")) {
        const pkg = result.response.substring("__R_INSTALL__:".length);
        return await installRPackage(pkg, onThinkingStart, onThinkingEnd);
      }

      if (result.response === "__R_PACKAGES__") {
        return buildPackagesMessage();
      }

      return [createMessage("agent", result.response)];
    }
  }

  // Free-form text → LLM
  onThinkingStart();
  try {
    memory.addMessage({ role: "user", content: trimmed });
    const llm = getLLMService();
    const response = await llm.complete(trimmed);
    onThinkingEnd();

    memory.addMessage({ role: "assistant", content: response.content });

    const messages: TerminalMessage[] = [];
    messages.push(
      createMessage("agent", response.content, { tier: response.tier })
    );

    // If response contains R code and WebR is ready, offer to run it
    const codeBlocks = extractRCodeBlocks(response.content);
    const webR = getWebRService();
    if (codeBlocks.length > 0 && webR.getStatus() === "ready") {
      messages.push(
        createMessage(
          "system",
          "💡 Tip: Copy the R code above and run it with `/r <code>`."
        )
      );
    }

    return messages;
  } catch (err) {
    onThinkingEnd();
    return [
      createMessage(
        "error",
        `Agent error: ${err instanceof Error ? err.message : String(err)}`
      ),
    ];
  }
}

async function buildStatusMessage(): Promise<TerminalMessage[]> {
  const webR = getWebRService();
  const llm = getLLMService();
  const tiers = llm.getTierStatuses();
  const memory = getMemory();
  const state = memory.getState();

  const statusIcon = (s: string) =>
    s === "available" || s === "ready"
      ? "✅"
      : s === "checking" || s === "loading"
        ? "⏳"
        : "❌";

  const content = `**System Status**
━━━━━━━━━━━━━━━━━━━━━━━━━━

**Session**
ID: ${state.id.slice(0, 16)}...
Messages: ${state.messages.length}
History: ${memory.getCommandHistory().length} commands

**R Environment (WebR)**
Status: ${statusIcon(webR.getStatus())} ${webR.getStatus()}
Packages: ${webR.getInstalledPackages().join(", ") || "none yet"}

**AI Tiers**
☁️ Cloud (Gemini): ${statusIcon(tiers.cloud)} ${tiers.cloud}
🖥️ Local (Ollama): ${statusIcon(tiers.ollama)} ${tiers.ollama}
📋 Templates: ${statusIcon(tiers.template)} ${tiers.template}`;

  return [createMessage("agent", content)];
}

async function buildRStatusMessage(): Promise<TerminalMessage[]> {
  const webR = getWebRService();
  const pkgs = webR.getInstalledPackages();

  const content = `**R Environment Status**
━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${webR.getStatus()}
Engine: WebR (WebAssembly via WebView)
Packages: ${pkgs.length > 0 ? pkgs.join(", ") : "none installed"}

Use \`/install <name>\` to add packages.
Use \`/r <code>\` to execute R code.`;

  return [createMessage("agent", content)];
}

async function executeRCode(
  code: string,
  onThinkingStart: () => void,
  onThinkingEnd: () => void
): Promise<TerminalMessage[]> {
  const webR = getWebRService();

  if (webR.getStatus() !== "ready") {
    return [
      createMessage(
        "error",
        "WebR is not ready yet. Please wait for initialization to complete, or check /status."
      ),
    ];
  }

  onThinkingStart();
  try {
    const result = await webR.executeR(code);
    onThinkingEnd();

    const messages: TerminalMessage[] = [];
    messages.push(createMessage("code", "```r\n" + code + "\n```"));

    if (!result.success && result.error) {
      messages.push(createMessage("error", `**R Error:** ${result.error}`));
    } else {
      messages.push(
        createMessage("r-output", result.output || "(no output)", {
          executionTime: result.executionTime,
        })
      );
    }

    if (result.plots) {
      for (const img of result.plots) {
        messages.push(createMessage("r-plot", "Plot output", { images: [img] }));
      }
    }

    return messages;
  } catch (err) {
    onThinkingEnd();
    return [
      createMessage(
        "error",
        `Failed to execute R code: ${
          err instanceof Error ? err.message : String(err)
        }`
      ),
    ];
  }
}

async function installRPackage(
  pkg: string,
  onThinkingStart: () => void,
  onThinkingEnd: () => void
): Promise<TerminalMessage[]> {
  const webR = getWebRService();

  if (webR.getStatus() !== "ready") {
    return [
      createMessage(
        "error",
        "WebR is not ready. Please wait for initialization."
      ),
    ];
  }

  onThinkingStart();
  const result = await webR.installPackage(pkg);
  onThinkingEnd();

  if (result.success) {
    return [
      createMessage(
        "system",
        `✅ Package **${pkg}** installed successfully. Use \`library(${pkg})\` to load it.`
      ),
    ];
  } else {
    return [
      createMessage(
        "error",
        `Failed to install **${pkg}**. ${result.error || "It may not be available in the WebR repository."}`
      ),
    ];
  }
}

function buildPackagesMessage(): TerminalMessage[] {
  const webR = getWebRService();
  const pkgs = webR.getInstalledPackages();
  if (pkgs.length === 0) {
    return [
      createMessage(
        "agent",
        'No packages installed yet. Use `/install <name>` to add packages.'
      ),
    ];
  }
  return [
    createMessage(
      "agent",
      `**Installed R Packages:**\n${pkgs.map((p) => `• ${p}`).join("\n")}\n\nUse \`/install <name>\` to add more.`
    ),
  ];
}

export function configureLLM(config: Partial<LLMConfig>) {
  getLLMService().configure(config);
}
