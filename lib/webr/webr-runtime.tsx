/**
 * WebR Runtime Component
 *
 * Hidden WebView that loads and runs WebR (R via WebAssembly).
 * Communicates with WebRService via postMessage/onMessage.
 */

import { useRef, useEffect, useCallback } from "react";
import { View, Platform } from "react-native";
import { getWebRService } from "./service";

let WebView: any = null;

// Dynamic import for WebView — not available on web
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").default;
  } catch {
    // WebView not available
  }
}

interface WebRRuntimeProps {
  onStatusChange?: (status: string, message?: string) => void;
}

export function WebRRuntime({ onStatusChange }: WebRRuntimeProps) {
  const webViewRef = useRef<any>(null);
  const service = getWebRService();

  const sendMessage = useCallback(
    (message: string) => {
      if (webViewRef.current) {
        if (Platform.OS === "web") {
          // For web, post to the iframe
          webViewRef.current?.postMessage?.(message, "*");
        } else {
          webViewRef.current.postMessage(message);
        }
      }
    },
    []
  );

  useEffect(() => {
    service.setSendMessage(sendMessage);

    const unsubscribe = service.onStatusChange((status, message) => {
      onStatusChange?.(status, message);
    });

    return () => {
      unsubscribe();
    };
  }, [service, sendMessage, onStatusChange]);

  const handleMessage = useCallback(
    (event: any) => {
      const data =
        typeof event.nativeEvent?.data === "string"
          ? event.nativeEvent.data
          : event.data;
      if (data) {
        service.handleWebViewMessage(data);
      }
    },
    [service]
  );

  // On web, use an iframe instead of WebView
  if (Platform.OS === "web") {
    return (
      <View style={{ width: 0, height: 0, overflow: "hidden" }}>
        <iframe
          ref={webViewRef as any}
          srcDoc={service.getWebViewHtml()}
          style={{ width: 0, height: 0, border: "none" }}
          sandbox="allow-scripts allow-same-origin"
          title="WebR Runtime"
        />
      </View>
    );
  }

  if (!WebView) {
    return null;
  }

  return (
    <View
      style={{ width: 0, height: 0, overflow: "hidden", position: "absolute" }}
      pointerEvents="none"
    >
      <WebView
        ref={webViewRef}
        source={{ html: service.getWebViewHtml() }}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        onMessage={handleMessage}
        style={{ width: 0, height: 0 }}
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}
