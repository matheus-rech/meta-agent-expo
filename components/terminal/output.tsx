import { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { TerminalMessage } from "@/lib/agent/types";

interface TerminalOutputProps {
  messages: TerminalMessage[];
  isThinking: boolean;
  showTimestamps: boolean;
  autoScroll: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatExecTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const TIER_BADGES: Record<string, { emoji: string; label: string }> = {
  cloud: { emoji: "☁️", label: "Cloud" },
  ollama: { emoji: "🖥️", label: "Ollama" },
  template: { emoji: "📋", label: "Template" },
};

function TierBadge({ tier }: { tier: string }) {
  const badge = TIER_BADGES[tier];
  if (!badge) return null;
  return (
    <View
      className="flex-row items-center gap-0.5 px-1.5 rounded border border-[#30363D]"
      style={{ backgroundColor: "#21262D", paddingVertical: 1 }}
    >
      <Text className="text-[9px]">{badge.emoji}</Text>
      <Text className="text-[9px] font-mono text-[#8B949E]">
        {badge.label}
      </Text>
    </View>
  );
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(text);
  }, [text]);

  return (
    <TouchableOpacity
      onPress={handleCopy}
      className="p-1 rounded"
      style={{ backgroundColor: "#21262D" }}
      activeOpacity={0.7}
    >
      <Text className="text-[10px] text-[#8B949E]">Copy</Text>
    </TouchableOpacity>
  );
}

/**
 * Parse markdown-like text into styled components
 * Handles: **bold**, `code`, ```code blocks```
 */
function RenderContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        const code = codeLines.join("\n");
        elements.push(
          <CodeBlock key={`cb-${blockKey++}`} code={code} language={codeLang} />
        );
        codeLines = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    elements.push(
      <Text key={`ln-${i}`} className="text-[13px] text-[#8B949E] leading-5">
        <InlineMarkdown text={line} />
        {"\n"}
      </Text>
    );
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <CodeBlock key={`cb-${blockKey}`} code={codeLines.join("\n")} language={codeLang} />
    );
  }

  return <>{elements}</>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+?)`)/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <Text key={`b-${keyIdx++}`} className="font-bold text-[#C9D1D9]">
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      parts.push(
        <Text
          key={`c-${keyIdx++}`}
          className="font-mono text-[12px] text-[#A371F7]"
          style={{ backgroundColor: "#21262D", borderRadius: 3, paddingHorizontal: 4 }}
        >
          {match[4]}
        </Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <View
      className="my-2 rounded-lg overflow-hidden border border-[#30363D]"
      testID="code-block"
    >
      <View
        className="flex-row items-center justify-between px-3 border-b border-[#30363D]"
        style={{ backgroundColor: "#161B22", paddingVertical: 6 }}
      >
        <Text className="text-[11px] font-mono text-[#8B949E] uppercase">
          {language || "output"}
        </Text>
        <CopyButton text={code} />
      </View>
      <View className="p-3" style={{ backgroundColor: "#0D1117" }}>
        <Text className="text-[13px] leading-5 font-mono text-[#C9D1D9]" selectable>
          {code}
        </Text>
      </View>
    </View>
  );
}

function MessageItem({
  message,
  showTimestamp,
}: {
  message: TerminalMessage;
  showTimestamp: boolean;
}) {
  const { type, content, timestamp, files, images, tier, executionTime } =
    message;

  if (type === "banner") {
    return (
      <View className="py-2" testID="msg-banner">
        <Text
          className="font-mono text-[9px] leading-[1.15] text-[#58A6FF]"
          selectable
        >
          {content}
        </Text>
      </View>
    );
  }

  if (type === "user") {
    return (
      <View className="py-1.5" testID="msg-user">
        <View className="flex-row items-start gap-1.5">
          <Text className="text-[#58A6FF] font-mono text-[13px] font-bold">
            {">"}
          </Text>
          <Text className="font-mono text-[13px] text-[#58A6FF] flex-1">
            {content}
          </Text>
        </View>
        {showTimestamp && (
          <Text className="text-[10px] text-[#484F58] ml-4 mt-0.5">
            {formatTime(timestamp)}
          </Text>
        )}
      </View>
    );
  }

  if (type === "agent") {
    return (
      <View className="py-1.5 relative" testID="msg-agent">
        {tier && (
          <View className="absolute top-1.5 right-0 z-10">
            <TierBadge tier={tier} />
          </View>
        )}
        <View style={tier ? { paddingRight: 70 } : undefined}>
          <RenderContent text={content} />
        </View>
        {showTimestamp && (
          <Text className="text-[10px] text-[#484F58] mt-0.5">
            {formatTime(timestamp)}
          </Text>
        )}
      </View>
    );
  }

  if (type === "r-output") {
    return (
      <View className="py-1.5" testID="msg-r-output">
        <View className="my-1 rounded-lg overflow-hidden border border-[#30363D]">
          <View
            className="flex-row items-center justify-between px-3 border-b border-[#30363D]"
            style={{ backgroundColor: "#161B22", paddingVertical: 4 }}
          >
            <Text className="text-[11px] font-mono text-[#8B949E] uppercase">
              R Output
            </Text>
            {executionTime != null && (
              <Text className="text-[10px] font-mono text-[#484F58]">
                {formatExecTime(executionTime)}
              </Text>
            )}
          </View>
          <View className="p-3" style={{ backgroundColor: "#0D1117" }}>
            <Text
              className="text-[12px] leading-5 font-mono text-[#C9D1D9]"
              selectable
            >
              {content}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (type === "r-plot") {
    return (
      <View className="py-1.5" testID="msg-r-plot">
        {images?.map((src, i) => (
          <View
            key={i}
            className="my-1 rounded-lg overflow-hidden border border-[#30363D]"
            style={{ backgroundColor: "#0D1117" }}
          >
            <Image
              source={{ uri: src }}
              style={{ width: "100%", aspectRatio: 1.4, borderRadius: 8 }}
              resizeMode="contain"
              testID={`r-plot-image-${i}`}
            />
          </View>
        ))}
      </View>
    );
  }

  if (type === "system") {
    return (
      <View className="py-1.5" testID="msg-system">
        <RenderContent text={content} />
      </View>
    );
  }

  if (type === "error") {
    return (
      <View className="py-1.5" testID="msg-error">
        <View
          className="flex-row items-start gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: "rgba(248, 81, 73, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(248, 81, 73, 0.25)",
          }}
        >
          <Text className="text-[14px] mt-0.5">⚠️</Text>
          <Text className="text-[13px] text-[#F85149] font-mono flex-1">
            {content}
          </Text>
        </View>
      </View>
    );
  }

  if (type === "code") {
    return (
      <View className="py-1.5" testID="msg-code">
        <RenderContent text={content} />
      </View>
    );
  }

  return null;
}

export function TerminalOutput({
  messages,
  isThinking,
  showTimestamps,
  autoScroll,
}: TerminalOutputProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (autoScroll) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isThinking, autoScroll]);

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 px-4 py-2"
      style={{ backgroundColor: "#0D1117" }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="messages-area"
    >
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          showTimestamp={showTimestamps}
        />
      ))}

      {isThinking && (
        <View
          className="py-2 flex-row items-center gap-2"
          testID="thinking-indicator"
        >
          <ActivityIndicator size="small" color="#8B949E" />
          <Text className="text-[13px] font-mono text-[#8B949E]">
            Thinking...
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
