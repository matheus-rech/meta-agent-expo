import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { initializeMemory } from "@/lib/agent/memory";
import { configureLLM } from "@/lib/agent/engine";
import type { WebRStatus } from "@/lib/webr/service";

import "../global.css";

export interface WebRState {
  status: WebRStatus;
  detail?: string;
}

interface AppContextType {
  webrStatus: WebRState;
  setWebrStatus: (s: WebRState) => void;
  geminiApiKey: string;
  setGeminiApiKey: (k: string) => void;
  ollamaUrl: string;
  setOllamaUrl: (u: string) => void;
  hapticFeedback: boolean;
  setHapticFeedback: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  showTimestamps: boolean;
  setShowTimestamps: (v: boolean) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function useAppContext() {
  return useContext(AppContext);
}

export default function RootLayout() {
  const [webrStatus, setWebrStatus] = useState<WebRState>({
    status: "uninitialized",
  });
  const [geminiApiKey, setGeminiApiKeyState] = useState("");
  const [ollamaUrl, setOllamaUrlState] = useState("");
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");

  // Persist API key in secure store
  const setGeminiApiKey = useCallback(async (key: string) => {
    setGeminiApiKeyState(key);
    if (Platform.OS !== "web") {
      try {
        if (key) {
          await SecureStore.setItemAsync("gemini_api_key", key);
        } else {
          await SecureStore.deleteItemAsync("gemini_api_key");
        }
      } catch {
        // SecureStore may not be available
      }
    }
  }, []);

  const setOllamaUrl = useCallback((url: string) => {
    setOllamaUrlState(url);
  }, []);

  // Load saved key on mount
  useEffect(() => {
    (async () => {
      await initializeMemory();

      if (Platform.OS !== "web") {
        try {
          const savedKey = await SecureStore.getItemAsync("gemini_api_key");
          if (savedKey) {
            setGeminiApiKeyState(savedKey);
            configureLLM({ geminiApiKey: savedKey });
          }
        } catch {
          // SecureStore may not be available
        }
      }
    })();
  }, []);

  // Update LLM config when keys change
  useEffect(() => {
    configureLLM({
      geminiApiKey: geminiApiKey || undefined,
      ollamaUrl: ollamaUrl || undefined,
    });
  }, [geminiApiKey, ollamaUrl]);

  return (
    <AppContext.Provider
      value={{
        webrStatus,
        setWebrStatus,
        geminiApiKey,
        setGeminiApiKey,
        ollamaUrl,
        setOllamaUrl,
        hapticFeedback,
        setHapticFeedback,
        autoScroll,
        setAutoScroll,
        showTimestamps,
        setShowTimestamps,
        selectedModel,
        setSelectedModel,
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="light" />
    </AppContext.Provider>
  );
}
