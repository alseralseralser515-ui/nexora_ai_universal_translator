import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TouchableOpacity, View, StyleSheet, Dimensions, Animated } from "react-native";
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

  const stateDisplay = getStateDisplay(state, copy, colors);

  const styles = StyleSheet.create({
    // background removed - using native dark background colors and neon styles
    overlay: { backgroundColor: 'transparent' },
    topRow: { marginTop: 44, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
    header: { alignItems: 'center', marginTop: 8 },
    logoText: { color: '#9bd6ff', fontSize: 42, fontWeight: '800', letterSpacing: 4 },
    subtitle: { color: 'rgba(255,255,255,0.7)', marginTop: 6 },
    centerCircleWrap: { paddingHorizontal: 20, marginTop: 8, alignItems: 'center' },
    // readyCard and large header are part of the background art and must not be duplicated in the overlay
    langRow: { width: '92%', marginTop: 6, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth:1, borderColor:'rgba(100,120,255,0.06)' },
    langCard: { flex: 1 },
    langLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
    langValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
    langSwap: { paddingHorizontal: 12, paddingVertical: 6 },
    micRow: { width: '100%', marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sideColumn: { width: 84, alignItems: 'center' },
    smallCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth:1, borderColor:'rgba(255,255,255,0.02)' },
    smallLabel: { color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 12 },
    bigMic: { alignItems: 'center', justifyContent: 'center' },
    micOuter: { width: 180, height: 180, borderRadius: 90, borderWidth: 6, borderColor: 'rgba(123,70,255,0.7)', shadowColor: '#7be3ff', shadowOpacity: 0.9, alignItems:'center', justifyContent:'center' },
    micInner: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(123,70,255,0.95)' },
    tapLabel: { color: 'rgba(255,255,255,0.9)', marginTop: 14, fontWeight: '800' },
    actionRow: { width: '100%', marginTop: 22, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 18 },
    actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    actionText: { color: '#fff', fontWeight: '700' },
  });

  return (
    <ScreenContainer style={{ backgroundColor: '#06040a' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topRow}>
            <Pressable style={styles.iconButton} onPress={() => { /* open menu */ }} accessibilityLabel="menu-button"><Ionicons name="menu" size={24} color="#a9c8ff" /></Pressable>
            <View style={{alignItems:'center'}}>
              <Text style={{color:'#9bd6ff', fontSize:20, fontWeight:'900', letterSpacing:2}}>NEXORA</Text>
              <Text style={{color:'#ffd6f8', fontSize:11, fontWeight:'700'}}>AI TRANSLATOR</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={() => { /* open settings */ }} accessibilityLabel="settings-button"><Ionicons name="settings" size={22} color="#ffb3ff" /></Pressable>
          </View>

          {/* Decorative artwork underneath - use image as decorative layer only */}

          <View style={{height: 10}} />

          {/* READY TO TRANSLATE - prominent title */}
          <View style={{marginTop: 8, alignItems:'center'}}>
            <Text style={{color:'#7be3ff', fontSize:18, fontWeight:'900', letterSpacing:2}}>{(copy.ready ?? 'READY').toUpperCase()} TO TRANSLATE</Text>
            <Text style={{color:'rgba(255,255,255,0.65)', marginTop:6}}>{copy.subtitle}</Text>
          </View>

          {/* Language selector row (YOU SPEAK ↔ INTERLOCUTOR / AI Detect) */}
          <View style={[styles.langRow, {alignSelf:'center', marginTop:12}]}> 
            <View style={{flex:1}}>
              <Text style={styles.langLabel}>{copy.sourceLanguage}</Text>
              <Text style={styles.langValue}>{getLanguageName(languages.source)}</Text>
            </View>
            <Pressable onPress={() => {
              const s = languages.source;
              store.setSourceLanguage(languages.target || DEFAULT_TARGET_LANGUAGE);
              store.setTargetLanguage(s);
            }} style={styles.langSwap} accessibilityLabel="swap-languages">
              <Ionicons name="swap-horizontal" size={28} color="#6be7ff" />
            </Pressable>
            <View style={{flex:1, alignItems:'flex-end'}}>
              <Text style={styles.langLabel}>{copy.targetLanguage}</Text>
              <Text style={styles.langValue}>{languages.autoDetect ? 'AI Detect' : getLanguageName(languages.target)}</Text>
            </View>
          </View>

          {/* Central area with side action buttons and big neon mic */}
          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: 16}}>
            <View style={{width:82, alignItems:'center'}}>
              <Pressable onPress={() => { /* open history */ }} style={styles.smallCircle}><Ionicons name="time" size={22} color="#dfe9ff" /></Pressable>
              <Text style={styles.smallLabel}>{copy.conversation}</Text>
              <Pressable onPress={() => void handleRepeatLastPress()} style={[styles.smallCircle, {marginTop:12}]}><Ionicons name="repeat" size={22} color="#dfe9ff" /></Pressable>
              <Text style={styles.smallLabel}>{copy.repeatLast}</Text>
            </View>

            <View style={{flex:1, alignItems:'center'}}>
              <View style={[styles.micOuter, {shadowColor: '#7be3ff'}]}>
                <Pressable onPress={handleMicrophonePress} accessibilityLabel="tap-to-speak">
                  <View style={styles.micInner}>
                    <Ionicons name={(state === ConversationState.LISTENING || state === ConversationState.RECOGNIZING) ? 'mic' : 'mic-outline'} size={46} color="#fff" />
                  </View>
                </Pressable>
              </View>
              <Text style={styles.tapLabel}>TAP TO SPEAK</Text>
            </View>

            <View style={{width:82, alignItems:'center'}}>
              <Pressable onPress={() => { /* open settings */ }} style={styles.smallCircle}><Ionicons name="settings" size={22} color="#dfe9ff" /></Pressable>
              <Text style={styles.smallLabel}>Settings</Text>
              <Pressable onPress={() => { /* open help */ }} style={[styles.smallCircle, {marginTop:12}]}><Ionicons name="help-circle" size={22} color="#dfe9ff" /></Pressable>
              <Text style={styles.smallLabel}>Help</Text>
            </View>
          </View>

          {/* Action buttons row */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleMicrophonePress} disabled={!isInitialized || state !== ConversationState.IDLE} style={[styles.actionBtn, {backgroundColor: colors.primary}]}> 
              <Text style={styles.actionText}>{copy.startConversation}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void engineRef.current?.pauseConversation()} style={[styles.actionBtn, {backgroundColor: '#2d2d35'}]}>
              <Text style={styles.actionText}>{copy.pause}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void engineRef.current?.resumeConversation()} style={[styles.actionBtn, {backgroundColor: '#2d2d35'}]}>
              <Text style={styles.actionText}>{copy.resume}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleStopPress} style={[styles.actionBtn, {backgroundColor: colors.error}]}>
              <Text style={styles.actionText}>{copy.stop}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void handleRepeatLastPress()} style={[styles.actionBtn, {backgroundColor: '#2d2d35'}]}>
              <Text style={styles.actionText}>{copy.repeatLast}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearConversationPress} style={[styles.actionBtn, {backgroundColor: '#2d2d35'}]}>
              <Text style={styles.actionText}>{copy.clearConversation}</Text>
            </TouchableOpacity>
          </View>

          <View style={{height:120}} />

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
