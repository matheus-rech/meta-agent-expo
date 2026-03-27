import { useState, useCallback } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "@/components/terminal/status-bar";
import { TerminalOutput } from "@/components/terminal/output";
import { TerminalInput } from "@/components/terminal/input";
import { WebRRuntime } from "@/lib/webr/webr-runtime";
import { useAppContext } from "../_layout";
import {
  getInitialMessages,
  handleInput,
} from "@/lib/agent/engine";
import { getMemory } from "@/lib/agent/memory";
import type { TerminalMessage } from "@/lib/agent/types";

export default function TerminalScreen() {
  const { webrStatus, setWebrStatus, autoScroll, showTimestamps } =
    useAppContext();

  const [messages, setMessages] = useState<TerminalMessage[]>(
    getInitialMessages
  );
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId] = useState(
    () => `sess_${Math.random().toString(36).substring(2, 8)}`
  );

  const handleWebRStatus = useCallback(
    (status: string, message?: string) => {
      setWebrStatus({
        status: status as any,
        detail: message,
      });
    },
    [setWebrStatus]
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const lower = trimmed.toLowerCase();
      const memory = getMemory();
      memory.addToHistory(trimmed);

      // Handle /clear specially
      if (lower === "/clear") {
        setMessages(getInitialMessages());
        return;
      }

      // Add user message
      const userMsg: TerminalMessage = {
        id: `msg-${Date.now()}-user`,
        type: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Get response from engine
      const responses = await handleInput(
        trimmed,
        () => setIsThinking(true),
        () => setIsThinking(false)
      );

      if (responses.length > 0) {
        setMessages((prev) => [...prev, ...responses]);
      }
    },
    [isThinking]
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0D1117" }}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, backgroundColor: "#0D1117" }}>
          <StatusBar
            webrStatus={webrStatus.status}
            webrDetail={webrStatus.detail}
            sessionId={sessionId}
            isThinking={isThinking}
          />

          <TerminalOutput
            messages={messages}
            isThinking={isThinking}
            showTimestamps={showTimestamps}
            autoScroll={autoScroll}
          />

          <TerminalInput onSubmit={handleSubmit} isThinking={isThinking} />
        </View>
      </KeyboardAvoidingView>

      {/* Hidden WebR runtime */}
      <WebRRuntime onStatusChange={handleWebRStatus} />
    </SafeAreaView>
  );
}
