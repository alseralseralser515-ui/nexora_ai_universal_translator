import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DEFAULT_TARGET_LANGUAGE, SUPPORTED_LANGUAGES, getLanguageName, type AppLocale } from "@/lib/config/languages";
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
  const historyKey = "nexora.history.v1";

  useEffect(() => {
    void AsyncStorage.getItem(historyKey).then((raw) => {
      if (!raw || store.privacyMode) return;
      try { store.restoreSession(JSON.parse(raw)); } catch { /* Ignore malformed local history. */ }
    });

    ProviderFactory.getInstance().initialize({
      speechProvider: process.env.EXPO_PUBLIC_SPEECH_PROVIDER === "mock" ? "mock" : "native",
      textToSpeechProvider: process.env.EXPO_PUBLIC_TTS_PROVIDER === "mock" ? "mock" : "native",
      translationProvider: process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER === "mock" ? "mock" : "backend",
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

  useEffect(() => {
    if (!store.localHistorySaving || store.privacyMode || !session) return;
    void AsyncStorage.setItem(historyKey, JSON.stringify(session));
  }, [session, store.localHistorySaving, store.privacyMode]);

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

  const stateDisplay = getStateDisplay(state, copy, colors);

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 gap-6 p-6">
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground text-center">{copy.appTitle}</Text>
            <Text className="text-base text-muted text-center">{copy.subtitle}</Text>
            <Text className="text-xs text-muted">
              {copy.providerMode}: speech {telemetry.providerMode.speech}, tts {telemetry.providerMode.textToSpeech}, translation {telemetry.providerMode.translation}
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 gap-4">
            <LanguageSelector
              label={copy.interfaceLanguage}
              selected={languages.interfaceLanguage}
              options={["uk", "ru", "en"]}
              onSelect={(value) => store.setInterfaceLanguage(value as AppLocale)}
            />
            <LanguageSelector
              label={copy.userLanguage}
              selected={languages.source}
              options={SUPPORTED_LANGUAGES.filter((language) => language.supportsSpeech).map((language) => language.code)}
              onSelect={(value) => {
                store.setSourceLanguage(value);
                store.setAutoDetectLanguage(value === "auto");
              }}
            />
            <LanguageSelector
              label={copy.targetLanguage}
              selected={languages.target || DEFAULT_TARGET_LANGUAGE}
              options={SUPPORTED_LANGUAGES.filter((language) => language.code !== "auto" && language.supportsTts).map(
                (language) => language.code,
              )}
              onSelect={store.setTargetLanguage}
            />
          </View>

          <View className="items-center gap-2">
            <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: `${stateDisplay.color}20` }}>
              <View className="w-12 h-12 rounded-full" style={{ backgroundColor: stateDisplay.color }} />
            </View>
            <Text className="text-lg font-semibold text-center" style={{ color: stateDisplay.color }}>
              {stateDisplay.text}
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-4 gap-2">
            <View className="flex-row justify-between items-center gap-4">
              <Text className="text-sm text-muted">{copy.userLanguage}</Text>
              <Text className="text-base font-semibold text-foreground">{getLanguageName(languages.source)}</Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row justify-between items-center gap-4">
              <Text className="text-sm text-muted">{copy.interlocutorLanguage}</Text>
              <Text className="text-base font-semibold text-foreground">{getLanguageName(languages.target)}</Text>
            </View>
          </View>

          <View className="bg-surface rounded-lg p-4 gap-2">
            <InfoRow label={copy.microphone} value={telemetry.microphoneEnabled ? "ON" : "OFF"} />
            <InfoRow label={copy.detectedLanguage} value={telemetry.detectedLanguage ? getLanguageName(telemetry.detectedLanguage) : "-"} />
            <InfoRow label={copy.sourceText} value={telemetry.recognizedText || "-"} />
            <InfoRow label={copy.translatedText} value={telemetry.translatedText || "-"} />
            <InfoRow
              label={copy.speakerDirection}
              value={telemetry.speakerDirection === "user_to_interlocutor" ? "User -> Interlocutor" : "Interlocutor -> User"}
            />
          </View>

          {error && (
            <View className="bg-error/10 border border-error rounded-lg p-4 gap-3">
              <View className="flex-row items-start gap-3">
                <Ionicons name="alert-circle" size={24} color={colors.error} />
                <View className="flex-1 gap-1">
                  <Text className="font-semibold text-foreground">{error.code}</Text>
                  <Text className="text-sm text-muted">{error.message}</Text>
                </View>
              </View>
              {error.recoverable && (
                <TouchableOpacity onPress={handleRetryPress} className="bg-error px-4 py-2 rounded-lg items-center">
                  <Text className="font-semibold text-background">{copy.retry}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {session && session.messages.length > 0 && (
            <View className="bg-surface rounded-lg p-4 gap-3 max-h-64">
              <Text className="text-sm font-semibold text-muted">{copy.conversation}</Text>
              <ScrollView>
                {session.messages.map((message) => (
                  <View key={message.id} className="gap-1 pb-2 mb-2 border-b border-border">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-muted">{getLanguageName(message.originalLanguage)}</Text>
                      <Text className="text-xs text-muted">{new Date(message.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <Text className="text-sm text-foreground">{message.originalText}</Text>
                    <View className="h-px bg-border my-1" />
                    <Text className="text-xs text-muted">{getLanguageName(message.targetLanguage)}</Text>
                    <Text className="text-sm text-primary font-medium">{message.translatedText}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View className="gap-3 mt-auto pb-4">
            <View className="flex-row flex-wrap gap-2 justify-center">
              <ActionButton label={copy.startConversation} onPress={handleMicrophonePress} disabled={!isInitialized || state !== ConversationState.IDLE} />
              <ActionButton label={copy.pause} onPress={() => void engineRef.current?.pauseConversation()} disabled={state === ConversationState.IDLE || state === ConversationState.PAUSED} />
              <ActionButton label={copy.resume} onPress={() => void engineRef.current?.resumeConversation()} disabled={state !== ConversationState.PAUSED} />
              <ActionButton label={copy.stop} onPress={handleStopPress} disabled={state === ConversationState.IDLE} />
              <ActionButton label={copy.repeatLast} onPress={handleRepeatLastPress} disabled={!session?.messages.length || telemetry.playbackActive} />
              <ActionButton label={copy.clearConversation} onPress={handleClearConversationPress} disabled={!session?.messages.length} />
            </View>
            <View className="flex-row gap-4 items-center justify-center">
            <Pressable
              onPress={handleMicrophonePress}
              disabled={!isInitialized}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              className="w-20 h-20 rounded-full items-center justify-center"
            >
              <Ionicons
                name={state === ConversationState.LISTENING || state === ConversationState.RECOGNIZING ? "mic" : "mic-off"}
                size={32}
                color={colors.background}
              />
            </Pressable>

            {state !== ConversationState.IDLE && (
              <Pressable
                onPress={handleStopPress}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
                className="w-16 h-16 rounded-full items-center justify-center"
              >
                <Ionicons name="stop" size={24} color={colors.background} />
              </Pressable>
            )}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm text-foreground font-medium flex-1 text-right">{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} className={`px-3 py-2 rounded-md ${disabled ? "bg-border" : "bg-primary"}`}>
      <Text className={disabled ? "text-muted font-semibold" : "text-background font-semibold"}>{label}</Text>
    </TouchableOpacity>
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

interface LanguageSelectorProps {
  label: string;
  selected: string;
  options: string[];
  onSelect: (value: string) => void;
}

function LanguageSelector({ label, selected, options, onSelect }: LanguageSelectorProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((code) => {
          const isSelected = selected === code;
          return (
            <Pressable
              key={code}
              onPress={() => onSelect(code)}
              className={`px-3 py-2 rounded-md border ${isSelected ? "bg-primary border-primary" : "bg-background border-border"}`}
            >
              <Text className={isSelected ? "text-background font-semibold" : "text-foreground"}>{getLanguageName(code)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
