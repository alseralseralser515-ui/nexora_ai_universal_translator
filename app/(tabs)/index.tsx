import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { getLanguageName } from "@/lib/config/languages";
import { ConversationEngine } from "@/lib/services/conversation/engine";
import {
  useConversationError,
  useConversationLanguages,
  useConversationSession,
  useConversationState,
  useConversationStore,
  useConversationTelemetry,
} from "@/lib/services/conversation/store";
import { ConversationState } from "@/lib/services/conversation/types";
import { ProviderFactory } from "@/lib/services/providers/factory";
import { t } from "@/lib/localization/translations";
import { useColors } from "@/hooks/use-colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type NavigationKey = "translator" | "conversation" | "history" | "saved" | "profile";


const LANGUAGE_CYCLE = ["en", "uk", "ru"];

export default function HomeScreen() {
  const colors = useColors();
  const state = useConversationState();
  const error = useConversationError();
  const session = useConversationSession();
  const languages = useConversationLanguages();
  const telemetry = useConversationTelemetry();
  const store = useConversationStore();
  const setProviderMode = useConversationStore((state) => state.setProviderMode);
  const copy = t(languages.interfaceLanguage);
  const engineRef = useRef<ConversationEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeNavigation, setActiveNavigation] = useState<NavigationKey>("translator");
  const [localSourceLanguage, setLocalSourceLanguage] = useState(languages.source);
  const [localTargetLanguage, setLocalTargetLanguage] = useState(languages.target);
  const [localAutoDetect, setLocalAutoDetect] = useState(languages.autoDetect);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLocalSourceLanguage(languages.source);
    setLocalTargetLanguage(languages.target);
    setLocalAutoDetect(languages.autoDetect);
  }, [languages.source, languages.target, languages.autoDetect]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    ProviderFactory.getInstance().initialize({
      speechProvider: process.env.EXPO_PUBLIC_SPEECH_PROVIDER === "native" ? "native" : "mock",
      textToSpeechProvider: process.env.EXPO_PUBLIC_TTS_PROVIDER === "native" ? "native" : "mock",
      translationProvider: process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER === "backend" ? "backend" : "mock",
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      speechRate: Number(process.env.EXPO_PUBLIC_SPEECH_RATE ?? 0.95),
      timeout: 30000,
      retryAttempts: 3,
    });
    setProviderMode(ProviderFactory.getInstance().getMode());

    engineRef.current = new ConversationEngine({
      timeout: 30000,
      maxRetries: 3,
      speechRate: Number(process.env.EXPO_PUBLIC_SPEECH_RATE ?? 0.95),
    });
    setIsInitialized(true);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void engineRef.current?.cleanup();
      }
    });

    return () => {
      appStateSubscription.remove();
      void engineRef.current?.cleanup();
    };
  }, [setProviderMode]);

  const handleMicrophonePress = async () => {
    if (!engineRef.current) return;

    if (state === ConversationState.IDLE) {
      await engineRef.current.startConversation();
    } else if (state === ConversationState.PAUSED) {
      await engineRef.current.resumeConversation();
    } else if (state === ConversationState.LISTENING || state === ConversationState.RECOGNIZING) {
      await engineRef.current.pauseConversation();
    } else if (state === ConversationState.ERROR && store.canRetry()) {
      store.incrementRetry();
      await engineRef.current.startConversation();
    }
  };

  const handleStopPress = async () => {
    await engineRef.current?.stopConversation();
  };

  const handleRetryPress = async () => {
    if (!engineRef.current) return;
    store.clearError();
    store.resetRetry();
    await engineRef.current.startConversation();
  };

  const handleRepeatLastPress = async () => {
    await engineRef.current?.repeatLast();
  };

  const handleClearConversationPress = () => {
    store.clearMessages();
    store.setRecognizedText("");
    store.setTranslatedText("");
    store.setDetectedLanguage(null);
  };

  const localized = (key: string, fallback: string) =>
    (copy as unknown as Record<string, string>)[key] ?? fallback;
  const stateDisplay = getStateDisplay(state, copy, colors);
  const isActive = state === ConversationState.LISTENING || state === ConversationState.RECOGNIZING;

  

  const getNextLanguage = (currentLanguage: string) => {
    const currentIndex = LANGUAGE_CYCLE.indexOf(currentLanguage);
    return LANGUAGE_CYCLE[(currentIndex + 1) % LANGUAGE_CYCLE.length];
  };

  const handleSourceLanguagePress = () => {
    const nextLanguage = getNextLanguage(String(languages.source));
    setLocalSourceLanguage(nextLanguage);
    store.setSourceLanguage(nextLanguage);
  };

  const handleInterlocutorPress = () => {
    const nextAutoDetect = !localAutoDetect;
    setLocalAutoDetect(nextAutoDetect);
    store.setAutoDetectLanguage(nextAutoDetect);

    if (!nextAutoDetect) {
      const nextLanguage = getNextLanguage(String(languages.target));
      setLocalTargetLanguage(nextLanguage);
      store.setTargetLanguage(nextLanguage);
    }
  };

  const handleNavigationPress = (navigationKey: NavigationKey) => {
    setActiveNavigation(navigationKey);

    if (navigationKey === "translator") return;

    const labels: Record<Exclude<NavigationKey, "translator">, string> = {
      conversation: localized("conversation", "Conversation"),
      history: localized("history", "History"),
      saved: localized("saved", "Saved"),
      profile: localized("profile", "Profile"),
    };

    Alert.alert(
      labels[navigationKey],
      localized("screenUnavailable", `${labels[navigationKey]} is not available yet.`)
    );
  };

  const handleSideAction = (action: "history" | "settings" | "help") => {
    if (action === "history") {
      handleNavigationPress("history");
      return;
    }

    const title = localized(action, action[0].toUpperCase() + action.slice(1));
    Alert.alert(title, localized("screenUnavailable", `${title} is not available yet.`));
  };

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#05030a" },
    container: { flex: 1, backgroundColor: "#05030a", paddingTop: 28, paddingHorizontal: 16 },
    header: { alignItems: "center", paddingBottom: 18 },
    titleMain: { color: "#a7f1ff", fontSize: 24, fontWeight: "900", letterSpacing: 5 },
    titleSub: { color: "#e4b6ff", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: 3 },
    languageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    languageCard: { width: "46%", minHeight: 62, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", backgroundColor: "#0d0a16", borderWidth: 1, borderColor: "#24203a" },
    languageLabel: { color: "#85809a", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
    languageValue: { color: "#f7f3ff", fontSize: 16, fontWeight: "800", marginTop: 4 },
    languageRight: { alignItems: "flex-end" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
    sideActions: { position: "absolute", top: 30, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sideGroup: { alignItems: "center", gap: 8 },
    sideButton: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#0d0a16", borderWidth: 1, borderColor: "#292241" },
    sideLabel: { color: "#aaa4bd", fontSize: 10, fontWeight: "700" },
    micArea: { alignItems: "center", justifyContent: "center" },
    micGlow: { width: 166, height: 166, borderRadius: 83, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0714", borderWidth: 2, borderColor: "#a66cff", shadowColor: "#78e8ff", shadowOpacity: 0.55, shadowRadius: 24, elevation: 14 },
    micButton: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: "#161126", borderWidth: 1, borderColor: "#72eaff" },
    micHint: { color: "#ded9ec", fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 16 },
    status: { color: stateDisplay.color, fontSize: 12, fontWeight: "700", marginTop: 6 },
    controls: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22 },
    controlButton: { minWidth: 82, height: 42, paddingHorizontal: 11, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0e0b18", borderWidth: 1, borderColor: "#28213f" },
    controlText: { color: "#d9d3e8", fontSize: 11, fontWeight: "800" },
    nav: { height: 70, marginBottom: 12, borderRadius: 20, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#0c0914", borderWidth: 1, borderColor: "#201a35" },
    navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
    navText: { color: "#767086", fontSize: 10, fontWeight: "700" },
    navTextActive: { color: "#8deaff" },
  });

  const navItems: Array<[keyof typeof Ionicons.glyphMap, NavigationKey, string]> = [
    ["mic-outline", "translator", "Translator"],
    ["chatbubbles-outline", "conversation", "Conversation"],
    ["time-outline", "history", "History"],
    ["bookmark-outline", "saved", "Saved"],
    ["person-outline", "profile", "Profile"],
  ];

  return (
    <ScreenContainer style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.titleMain}>NEXORA</Text>
          <Text style={styles.titleSub}>{localized("aiTranslator", "AI TRANSLATOR")}</Text>
        </View>

        <View style={styles.languageRow}>
          <Pressable onPress={handleSourceLanguagePress} style={styles.languageCard} accessibilityRole="button" accessibilityLabel={localized("myLanguage", "My Language")}>
            <Text style={styles.languageLabel}>{localized("myLanguage", "My Language")}</Text>
            <Text style={styles.languageValue}>{getLanguageName(localSourceLanguage as never)}</Text>
          </Pressable>
          <Pressable onPress={handleInterlocutorPress} style={[styles.languageCard, styles.languageRight]} accessibilityRole="button" accessibilityLabel={localized("interlocutor", "Interlocutor")}>
            <Text style={styles.languageLabel}>{localized("interlocutor", "Interlocutor")}</Text>
            <Text style={styles.languageValue}>
              {localAutoDetect ? localized("aiDetect", "AI Detect") : getLanguageName(localTargetLanguage as never)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.center}>
          <View style={styles.sideActions}>
            <View style={styles.sideGroup}>
              <Pressable onPress={() => handleSideAction("history")} style={styles.sideButton} accessibilityRole="button" accessibilityLabel={localized("history", "History")}>
                <Ionicons name="time-outline" size={22} color="#83e8ff" />
              </Pressable>
              <Text style={styles.sideLabel}>{localized("history", "History")}</Text>
              <Pressable onPress={() => void handleRepeatLastPress()} style={styles.sideButton} accessibilityRole="button" accessibilityLabel={localized("repeat", "Repeat")}>
                <Ionicons name="repeat-outline" size={22} color="#c7a4ff" />
              </Pressable>
              <Text style={styles.sideLabel}>{localized("repeat", "Repeat")}</Text>
            </View>
            <View style={styles.sideGroup}>
              <Pressable onPress={() => handleSideAction("settings")} style={styles.sideButton} accessibilityRole="button" accessibilityLabel={localized("settings", "Settings")}>
                <Ionicons name="settings-outline" size={22} color="#ff9bdc" />
              </Pressable>
              <Text style={styles.sideLabel}>{localized("settings", "Settings")}</Text>
              <Pressable onPress={() => handleSideAction("help")} style={styles.sideButton} accessibilityRole="button" accessibilityLabel={localized("help", "Help")}>
                <Ionicons name="help-circle-outline" size={22} color="#83e8ff" />
              </Pressable>
              <Text style={styles.sideLabel}>{localized("help", "Help")}</Text>
            </View>
          </View>

          <View style={styles.micArea}>
            <Animated.View style={[styles.micGlow, { shadowOpacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.72] }) }]}>
              <Pressable onPress={handleMicrophonePress} accessibilityRole="button" accessibilityLabel={localized("microphone", "Microphone")} style={styles.micButton}>
                <Ionicons name={isActive ? "mic" : "mic-outline"} size={52} color="#f8f5ff" />
              </Pressable>
            </Animated.View>
            <Text style={styles.micHint}>{localized("tapToSpeak", "Tap to speak")}</Text>
            <Text style={styles.status}>{stateDisplay.text}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable onPress={handleMicrophonePress} style={styles.controlButton} accessibilityLabel={localized("start", "Start")}><Ionicons name="play" size={16} color="#83e8ff" /><Text style={styles.controlText}>{localized("start", "Start")}</Text></Pressable>
            <Pressable onPress={() => void engineRef.current?.pauseConversation()} style={styles.controlButton} accessibilityLabel={localized("pause", "Pause")}><Ionicons name="pause" size={16} color="#c7a4ff" /><Text style={styles.controlText}>{localized("pause", "Pause")}</Text></Pressable>
            <Pressable onPress={() => void engineRef.current?.resumeConversation()} style={styles.controlButton} accessibilityLabel={localized("resume", "Resume")}><Ionicons name="play-forward" size={16} color="#9be7ff" /><Text style={styles.controlText}>{localized("resume", "Resume")}</Text></Pressable>
            <Pressable onPress={handleStopPress} style={styles.controlButton} accessibilityLabel={localized("stop", "Stop")}><Ionicons name="stop" size={16} color="#ff709d" /><Text style={styles.controlText}>{localized("stop", "Stop")}</Text></Pressable>
            <Pressable onPress={() => void handleRepeatLastPress()} style={styles.controlButton} accessibilityLabel={localized("repeatLast", "Repeat Last")}><Ionicons name="repeat" size={16} color="#d0a9ff" /><Text style={styles.controlText}>{localized("repeatLast", "Repeat Last")}</Text></Pressable>
            <Pressable onPress={handleClearConversationPress} style={styles.controlButton} accessibilityLabel={localized("clear", "Clear")}><Ionicons name="trash-outline" size={16} color="#82e7ff" /><Text style={styles.controlText}>{localized("clear", "Clear")}</Text></Pressable>
          </View>
        </View>

        <View style={styles.nav}>
          {navItems.map(([icon, key, fallback]) => {
            const isSelected = activeNavigation === key;
            return (
              <Pressable key={key} onPress={() => handleNavigationPress(key)} style={styles.navItem} accessibilityRole="button" accessibilityLabel={localized(key, fallback)}>
                <Ionicons name={icon} size={21} color={isSelected ? "#8deaff" : "#777087"} />
                <Text style={[styles.navText, isSelected && styles.navTextActive]}>{localized(key, fallback)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

function getStateDisplay(state: ConversationState, copy: ReturnType<typeof t>, colors: ReturnType<typeof useColors>) {
  switch (state) {
    case ConversationState.REQUESTING_PERMISSION:
      return { text: copy.requestingPermission, color: colors.warning };
    case ConversationState.LISTENING:
      return { text: copy.listening, color: colors.primary };
    case ConversationState.RECOGNIZING:
      return { text: copy.recognizing, color: colors.primary };
    case ConversationState.DETECTING_LANGUAGE:
      return { text: copy.detectingLanguage, color: colors.primary };
    case ConversationState.TRANSLATING:
      return { text: copy.translating, color: colors.primary };
    case ConversationState.SPEAKING:
      return { text: copy.speaking, color: colors.primary };
    case ConversationState.PAUSED:
      return { text: copy.paused, color: colors.warning };
    case ConversationState.ERROR:
      return { text: copy.error, color: colors.error };
    case ConversationState.RETRYING:
      return { text: copy.retrying, color: colors.warning };
    default:
      return { text: copy.ready, color: colors.foreground };
  }
}
