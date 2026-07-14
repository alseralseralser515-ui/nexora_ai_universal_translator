import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "react-native": path.resolve(__dirname, "tests/mocks/react-native.ts"),
      "expo-constants": path.resolve(__dirname, "tests/mocks/expo-constants.ts"),
      "expo-speech-recognition": path.resolve(__dirname, "tests/mocks/expo-speech-recognition.ts"),
      "expo-speech": path.resolve(__dirname, "tests/mocks/expo-speech.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
