import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Meta Agent",
  slug: "meta-agent-mobile",
  version: "3.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "metaagent",
  userInterfaceStyle: "dark",
  newArchEnabled: false,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0D1117",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.metaagent.mobile",
    backgroundColor: "#0D1117",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0D1117",
    },
    package: "com.metaagent.mobile",
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
    backgroundColor: "#0D1117",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
  ],
  experiments: {
    typedRoutes: true,
  },
});
