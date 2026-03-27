import { View, Text } from "react-native";
import type { WebRStatus } from "@/lib/webr/service";

interface StatusBarProps {
  webrStatus: WebRStatus;
  webrDetail?: string;
  sessionId: string;
  isThinking: boolean;
}

const STATUS_CONFIG: Record<
  WebRStatus,
  { color: string; label: string; pulse?: boolean }
> = {
  uninitialized: { color: "#484F58", label: "R: Init" },
  loading: { color: "#D29922", label: "R: Loading", pulse: true },
  ready: { color: "#3FB950", label: "R: Ready" },
  error: { color: "#F85149", label: "R: Error" },
  busy: { color: "#D29922", label: "R: Busy" },
};

export function StatusBar({
  webrStatus,
  webrDetail,
  sessionId,
  isThinking,
}: StatusBarProps) {
  const cfg = STATUS_CONFIG[webrStatus];
  const connColor =
    webrStatus === "ready" || webrStatus === "busy"
      ? "#3FB950"
      : webrStatus === "error"
        ? "#F85149"
        : "#D29922";

  return (
    <View>
      {/* Main status bar */}
      <View
        className="flex-row items-center justify-between px-4 border-b border-[#21262D]"
        style={{ height: 36, backgroundColor: "#0D1117" }}
      >
        {/* Connection indicator */}
        <View className="flex-row items-center gap-2">
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: connColor,
            }}
          />
          <Text className="text-[11px] font-mono text-[#8B949E]">
            {webrStatus === "ready"
              ? "Connected"
              : webrStatus === "error"
                ? "Error"
                : "Initializing"}
          </Text>
        </View>

        {/* WebR status pill */}
        <View
          className="flex-row items-center gap-1 px-2 rounded-full border border-[#30363D]"
          style={{ paddingVertical: 2 }}
          testID="webr-status-pill"
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: cfg.color,
              opacity: cfg.pulse ? 0.8 : 1,
            }}
          />
          <Text className="text-[10px] font-mono text-[#8B949E]">
            {cfg.label}
          </Text>
        </View>

        {/* Session + thinking */}
        <View className="flex-row items-center gap-2">
          <Text className="text-[11px] font-mono text-[#484F58]">
            {sessionId.slice(0, 12)}
          </Text>
          {isThinking && (
            <Text className="text-[11px] font-mono text-[#D29922]">
              Processing...
            </Text>
          )}
        </View>
      </View>

      {/* WebR loading detail */}
      {webrStatus === "loading" && webrDetail ? (
        <View
          className="px-4 py-1.5 border-b border-[#21262D]"
          style={{ backgroundColor: "#161B22" }}
        >
          <Text className="text-[11px] font-mono text-[#D29922]">
            ⏳ {webrDetail}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
