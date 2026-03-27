import { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppContext } from "../_layout";
import { getWebRService } from "@/lib/webr/service";
import { getLLMService } from "@/lib/llm/service";
import { getMemory } from "@/lib/agent/memory";

function SectionTitle({
  label,
  color,
}: {
  label: string;
  color?: string;
}) {
  return (
    <Text
      className={`text-[11px] font-bold uppercase tracking-wider mt-6 mb-1 px-1 ${
        color || "text-[#8B949E]"
      }`}
    >
      {label}
    </Text>
  );
}

function SettingRow({
  label,
  description,
  icon,
  children,
}: {
  label: string;
  description?: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-[#21262D]">
      <View className="flex-row items-center gap-3 flex-1">
        <View
          className="items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            backgroundColor: "#161B22",
          }}
        >
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[13px] text-[#C9D1D9] font-medium">
            {label}
          </Text>
          {description && (
            <Text className="text-[11px] text-[#484F58]">{description}</Text>
          )}
        </View>
      </View>
      <View className="ml-3">{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    hapticFeedback,
    setHapticFeedback,
    autoScroll,
    setAutoScroll,
    showTimestamps,
    setShowTimestamps,
    selectedModel,
    setSelectedModel,
    geminiApiKey,
    setGeminiApiKey,
    ollamaUrl,
    setOllamaUrl,
    webrStatus,
  } = useAppContext();

  const [showApiKey, setShowApiKey] = useState(false);
  const [ollamaTestResult, setOllamaTestResult] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [installPkg, setInstallPkg] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{
    pkg: string;
    ok: boolean;
  } | null>(null);

  const handleOllamaTest = useCallback(async () => {
    setOllamaTestResult("testing");
    const llm = getLLMService();
    const ok = await llm.checkOllama();
    setOllamaTestResult(ok ? "ok" : "fail");
  }, []);

  const handleInstallPackage = useCallback(async () => {
    const pkg = installPkg.trim();
    if (!pkg) return;
    setIsInstalling(true);
    setInstallResult(null);
    const webR = getWebRService();
    const result = await webR.installPackage(pkg);
    setIsInstalling(false);
    setInstallResult({ pkg, ok: result.success });
    if (result.success) setInstallPkg("");
  }, [installPkg]);

  const handleClearAll = useCallback(async () => {
    const memory = getMemory();
    await memory.clearAll();
  }, []);

  const webR = getWebRService();
  const installedPackages = webR.getInstalledPackages();

  const statusColor =
    webrStatus.status === "ready"
      ? "#3FB950"
      : webrStatus.status === "error"
        ? "#F85149"
        : webrStatus.status === "loading" || webrStatus.status === "busy"
          ? "#D29922"
          : "#484F58";

  const statusLabel =
    webrStatus.status === "ready"
      ? "Available"
      : webrStatus.status === "loading"
        ? "Loading..."
        : webrStatus.status === "error"
          ? "Error"
          : webrStatus.status === "busy"
            ? "Busy"
            : "Not initialized";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0D1117" }}
      edges={["top"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0D1117" }}
        showsVerticalScrollIndicator={false}
        testID="settings-scroll"
      >
        <View className="px-4 py-4">
          <Text className="text-[20px] font-bold text-[#C9D1D9]" testID="text-settings-title">
            Settings
          </Text>
        </View>

        <View className="px-4 pb-8">
          {/* Terminal Section */}
          <SectionTitle label="Terminal" />
          <SettingRow
            icon="📳"
            label="Haptic Feedback"
            description="Vibrate on key actions"
          >
            <Switch
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
              trackColor={{ false: "#21262D", true: "#58A6FF" }}
              thumbColor="#C9D1D9"
              testID="switch-haptic"
            />
          </SettingRow>
          <SettingRow
            icon="↓"
            label="Auto Scroll"
            description="Scroll to new messages"
          >
            <Switch
              value={autoScroll}
              onValueChange={setAutoScroll}
              trackColor={{ false: "#21262D", true: "#58A6FF" }}
              thumbColor="#C9D1D9"
              testID="switch-autoscroll"
            />
          </SettingRow>
          <SettingRow
            icon="🕐"
            label="Show Timestamps"
            description="Display message times"
          >
            <Switch
              value={showTimestamps}
              onValueChange={setShowTimestamps}
              trackColor={{ false: "#21262D", true: "#58A6FF" }}
              thumbColor="#C9D1D9"
              testID="switch-timestamps"
            />
          </SettingRow>

          {/* AI Model Section */}
          <SectionTitle label="AI Model" />
          <View className="py-3 border-b border-[#21262D]">
            <Text className="text-[13px] text-[#C9D1D9] font-medium mb-2">
              Active Model
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
                { id: "claude-3.5", label: "Claude 3.5" },
                { id: "local-slm", label: "Local SLM" },
              ].map((model) => (
                <TouchableOpacity
                  key={model.id}
                  onPress={() => setSelectedModel(model.id)}
                  className="px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor:
                      selectedModel === model.id ? "#58A6FF20" : "#161B22",
                    borderColor:
                      selectedModel === model.id ? "#58A6FF" : "#30363D",
                  }}
                  activeOpacity={0.7}
                  testID={`model-${model.id}`}
                >
                  <Text
                    className="text-[12px] font-medium"
                    style={{
                      color:
                        selectedModel === model.id ? "#58A6FF" : "#8B949E",
                    }}
                  >
                    {model.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* API Keys Section */}
          <SectionTitle label="API Keys" />
          <View className="py-3 gap-4">
            {/* Gemini API Key */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-2">
                <Text className="text-[12px] text-[#C9D1D9] font-medium">
                  🔑 Gemini API Key
                </Text>
                {geminiApiKey ? (
                  <View
                    className="px-1.5 rounded border border-[#3FB950]"
                    style={{ paddingVertical: 1 }}
                  >
                    <Text className="text-[9px] text-[#3FB950]">Set</Text>
                  </View>
                ) : null}
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={geminiApiKey}
                  onChangeText={(t) => setGeminiApiKey(t)}
                  secureTextEntry={!showApiKey}
                  placeholder="Enter Gemini API key..."
                  placeholderTextColor="#484F58"
                  className="flex-1 font-mono text-[12px] text-[#C9D1D9] rounded-lg px-3"
                  style={{
                    backgroundColor: "#161B22",
                    borderWidth: 1,
                    borderColor: "#30363D",
                    height: 34,
                    paddingVertical: 0,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-gemini-key"
                />
                <TouchableOpacity
                  onPress={() => setShowApiKey(!showApiKey)}
                  className="items-center justify-center rounded-lg"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "#161B22",
                    borderWidth: 1,
                    borderColor: "#30363D",
                  }}
                  activeOpacity={0.7}
                  testID="button-toggle-key-visibility"
                >
                  <Text style={{ fontSize: 16 }}>
                    {showApiKey ? "🙈" : "👁"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Ollama URL */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-2">
                <Text className="text-[12px] text-[#C9D1D9] font-medium">
                  🌐 Ollama URL
                </Text>
                {ollamaTestResult === "ok" && (
                  <View
                    className="px-1.5 rounded border border-[#3FB950]"
                    style={{ paddingVertical: 1 }}
                  >
                    <Text className="text-[9px] text-[#3FB950]">
                      Connected
                    </Text>
                  </View>
                )}
                {ollamaTestResult === "fail" && (
                  <View
                    className="px-1.5 rounded border border-[#F85149]"
                    style={{ paddingVertical: 1 }}
                  >
                    <Text className="text-[9px] text-[#F85149]">
                      Unreachable
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={ollamaUrl}
                  onChangeText={setOllamaUrl}
                  placeholder="http://localhost:11434"
                  placeholderTextColor="#484F58"
                  className="flex-1 font-mono text-[12px] text-[#C9D1D9] rounded-lg px-3"
                  style={{
                    backgroundColor: "#161B22",
                    borderWidth: 1,
                    borderColor: "#30363D",
                    height: 34,
                    paddingVertical: 0,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-ollama-url"
                />
                <TouchableOpacity
                  onPress={handleOllamaTest}
                  disabled={ollamaTestResult === "testing"}
                  className="items-center justify-center rounded-lg px-3"
                  style={{
                    height: 34,
                    backgroundColor: "#161B22",
                    borderWidth: 1,
                    borderColor: "#30363D",
                  }}
                  activeOpacity={0.7}
                  testID="button-test-ollama"
                >
                  {ollamaTestResult === "testing" ? (
                    <ActivityIndicator size="small" color="#8B949E" />
                  ) : (
                    <Text className="text-[12px] text-[#8B949E]">Test</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* R Environment Section */}
          <SectionTitle label="R Environment" />
          <View className="py-3 gap-3">
            {/* Status */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: statusColor,
                  }}
                />
                <Text className="text-[13px] text-[#C9D1D9]">
                  {statusLabel}
                </Text>
              </View>
              <View
                className="px-2 rounded border border-[#30363D]"
                style={{ paddingVertical: 2 }}
              >
                <Text className="text-[10px] text-[#8B949E]">
                  WebR (WASM)
                </Text>
              </View>
            </View>

            {/* Loading detail */}
            {webrStatus.status === "loading" && webrStatus.detail && (
              <Text className="text-[11px] font-mono text-[#D29922]">
                ⏳ {webrStatus.detail}
              </Text>
            )}

            {/* Installed packages */}
            <View>
              <Text className="text-[12px] text-[#8B949E] mb-1.5">
                Packages
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {installedPackages.length > 0 ? (
                  installedPackages.map((pkg) => (
                    <View
                      key={pkg}
                      className="flex-row items-center gap-1 px-2 rounded-md border border-[#30363D]"
                      style={{
                        backgroundColor: "#161B22",
                        paddingVertical: 2,
                      }}
                    >
                      <Text className="text-[10px] text-[#A371F7]">📦</Text>
                      <Text className="text-[11px] font-mono text-[#C9D1D9]">
                        {pkg}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-[11px] text-[#484F58] font-mono">
                    {webrStatus.status === "loading"
                      ? "Loading..."
                      : "None installed"}
                  </Text>
                )}
              </View>
            </View>

            {/* Install Package */}
            {webrStatus.status === "ready" && (
              <View className="gap-1.5">
                <Text className="text-[12px] text-[#8B949E]">
                  Install Package
                </Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={installPkg}
                    onChangeText={(t) => {
                      setInstallPkg(t);
                      setInstallResult(null);
                    }}
                    placeholder="Package name..."
                    placeholderTextColor="#484F58"
                    className="flex-1 font-mono text-[12px] text-[#C9D1D9] rounded-lg px-3"
                    style={{
                      backgroundColor: "#161B22",
                      borderWidth: 1,
                      borderColor: "#30363D",
                      height: 34,
                      paddingVertical: 0,
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleInstallPackage}
                    testID="input-install-package"
                  />
                  <TouchableOpacity
                    onPress={handleInstallPackage}
                    disabled={!installPkg.trim() || isInstalling}
                    className="items-center justify-center rounded-lg px-3"
                    style={{
                      height: 34,
                      backgroundColor: "#161B22",
                      borderWidth: 1,
                      borderColor: "#30363D",
                      opacity: !installPkg.trim() || isInstalling ? 0.5 : 1,
                    }}
                    activeOpacity={0.7}
                    testID="button-install-package"
                  >
                    {isInstalling ? (
                      <ActivityIndicator size="small" color="#8B949E" />
                    ) : (
                      <Text className="text-[12px] text-[#8B949E]">
                        Install
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {installResult && (
                  <Text
                    className="text-[11px] font-mono"
                    style={{
                      color: installResult.ok ? "#3FB950" : "#F85149",
                    }}
                  >
                    {installResult.ok
                      ? `✅ ${installResult.pkg} installed`
                      : `❌ Failed to install ${installResult.pkg}`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* About Section */}
          <SectionTitle label="About" />
          <View className="py-3 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-[#8B949E]">Version</Text>
              <Text className="text-[13px] font-mono text-[#C9D1D9]" testID="text-version">
                3.0.0
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-[#8B949E]">Platform</Text>
              <Text className="text-[13px] font-mono text-[#C9D1D9]">
                React Native / Expo
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-[#8B949E]">SDK</Text>
              <Text className="text-[13px] font-mono text-[#C9D1D9]">
                Meta Agent v3.0
              </Text>
            </View>
          </View>

          {/* Danger Zone */}
          <SectionTitle label="Danger Zone" color="text-[#F85149]" />
          <View className="py-3">
            <TouchableOpacity
              onPress={handleClearAll}
              className="items-center justify-center rounded-lg py-2.5"
              style={{
                borderWidth: 1,
                borderColor: "rgba(248, 81, 73, 0.25)",
                backgroundColor: "rgba(248, 81, 73, 0.06)",
              }}
              activeOpacity={0.7}
              testID="button-clear-all"
            >
              <Text className="text-[13px] text-[#F85149] font-medium">
                ⚠️ Clear All Data
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-8 items-center">
            <Text className="text-[13px] font-bold text-[#8B949E]">
              Meta Agent Mobile
            </Text>
            <Text className="text-[11px] text-[#484F58] mt-0.5">
              AI-Powered Agent SDK
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
