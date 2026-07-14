// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const rawBundleId = "com.nexora.aiuniversaltranslator";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
const env = {
  appName: "NEXORA AI Universal Translator",
  appSlug: "nexora-ai-universal-translator",
  scheme: "nexora-ai-universal-translator",
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  owner: "nexora777s-team",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "1",
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false,
      "NSMicrophoneUsageDescription": "NEXORA AI Universal Translator needs microphone access to listen and translate live conversations.",
      "NSSpeechRecognitionUsageDescription": "NEXORA AI Universal Translator uses speech recognition to convert spoken language into text for translation."
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    versionCode: 1,
    permissions: ["RECORD_AUDIO", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    [
      "expo-speech-recognition",
      {
        microphonePermission: "NEXORA AI Universal Translator needs microphone access to listen and translate live conversations.",
        speechRecognitionPermission: "NEXORA AI Universal Translator uses speech recognition to convert spoken language into text for translation.",
        androidSpeechServicePackages: ["com.google.android.googlequicksearchbox"]
      }
    ],
    [
      "expo-audio",
      {
        microphonePermission: "NEXORA AI Universal Translator needs microphone access to listen and translate live conversations.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://nexora.co.ua/privacy",
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://nexora.co.ua/terms",
    eas: {
      projectId: "a6982667-b92d-441e-a5fe-176c6c23a94b",
    },
  },
};

export default config;
