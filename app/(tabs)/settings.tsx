import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { SUPPORTED_LANGUAGES, getLanguageName, type AppLocale } from "@/lib/config/languages";
import { t } from "@/lib/localization/translations";
import { useConversationStore, useConversationLanguages } from "@/lib/services/conversation/store";

const SETTINGS_KEY = "nexora.settings.v1";
const HISTORY_KEY = "nexora.history.v1";

export default function SettingsScreen() {
  const store = useConversationStore();
  const languages = useConversationLanguages();
  const copy = t(languages.interfaceLanguage);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<typeof store>;
        if (saved.sourceLanguage) store.setSourceLanguage(saved.sourceLanguage);
        if (saved.targetLanguage) store.setTargetLanguage(saved.targetLanguage);
        if (typeof saved.autoDetectLanguage === "boolean") store.setAutoDetectLanguage(saved.autoDetectLanguage);
        if (saved.interfaceLanguage) store.setInterfaceLanguage(saved.interfaceLanguage as AppLocale);
        if (typeof saved.speechRate === "number") store.setSpeechRate(saved.speechRate);
        if (typeof saved.autoTtsPlayback === "boolean") store.setAutoTtsPlayback(saved.autoTtsPlayback);
        if (saved.translationStyle) store.setTranslationStyle(saved.translationStyle);
        if (typeof saved.phraseEndPauseMs === "number") store.setPhraseEndPauseMs(saved.phraseEndPauseMs);
        if (typeof saved.localHistorySaving === "boolean") store.setLocalHistorySaving(saved.localHistorySaving);
        if (typeof saved.privacyMode === "boolean") store.setPrivacyMode(saved.privacyMode);
      } catch {
        // Ignore malformed local settings and retain safe defaults.
      } finally {
        setHydrated(true);
      }
    });
    void AsyncStorage.getItem(SETTINGS_KEY).then((raw) => { if (!raw) setHydrated(true); });
  // The full store object is intentionally used for one-time settings hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (store.privacyMode) void AsyncStorage.removeItem(HISTORY_KEY);
    const { session: _session, ...settings } = store;
    void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // Store actions are stable; the listed state fields intentionally control persistence.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sourceLanguage, store.targetLanguage, store.autoDetectLanguage, store.interfaceLanguage, store.speechRate, store.autoTtsPlayback, store.translationStyle, store.phraseEndPauseMs, store.localHistorySaving, store.privacyMode, hydrated]);

  const clearLocalData = async () => {
    await AsyncStorage.multiRemove([SETTINGS_KEY, HISTORY_KEY]);
    store.clearMessages();
    store.setRecognizedText("");
    store.setTranslatedText("");
    store.setDetectedLanguage(null);
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-3xl font-bold text-foreground">{copy.settings}</Text>
        <Text className="text-sm text-muted">{copy.settingsDescription}</Text>
        <SettingRow label={copy.interfaceLanguage}>
          <ChoiceRow options={["uk", "ru", "en"]} selected={languages.interfaceLanguage} onSelect={(value) => store.setInterfaceLanguage(value as AppLocale)} />
        </SettingRow>
        <SettingRow label={copy.userLanguage}>
          <ChoiceRow options={SUPPORTED_LANGUAGES.filter((language) => language.code !== "auto").map((language) => language.code)} selected={store.sourceLanguage} onSelect={store.setSourceLanguage} />
        </SettingRow>
        <SettingRow label={copy.interlocutorLanguage}>
          <ChoiceRow options={SUPPORTED_LANGUAGES.filter((language) => language.code !== "auto").map((language) => language.code)} selected={store.targetLanguage} onSelect={store.setTargetLanguage} />
        </SettingRow>
        <ToggleRow label={copy.autoDetect} value={store.autoDetectLanguage} onValueChange={store.setAutoDetectLanguage} />
        <ToggleRow label={copy.automaticTts} value={store.autoTtsPlayback} onValueChange={store.setAutoTtsPlayback} />
        <SettingRow label={`${copy.speechSpeed}: ${store.speechRate.toFixed(2)}`}>
          <ChoiceRow options={["0.75", "0.95", "1.15", "1.35"]} selected={store.speechRate.toFixed(2)} onSelect={(value) => store.setSpeechRate(Number(value))} />
        </SettingRow>
        <SettingRow label={copy.translationStyle}>
          <ChoiceRow options={["natural", "literal", "formal"]} selected={store.translationStyle} onSelect={(value) => store.setTranslationStyle(value as "natural" | "literal" | "formal")} />
        </SettingRow>
        <SettingRow label={`${copy.phrasePause}: ${store.phraseEndPauseMs} ms`}>
          <ChoiceRow options={["800", "1400", "2200"]} selected={String(store.phraseEndPauseMs)} onSelect={(value) => store.setPhraseEndPauseMs(Number(value))} />
        </SettingRow>
        <ToggleRow label={copy.localHistory} value={store.localHistorySaving} onValueChange={store.setLocalHistorySaving} />
        <ToggleRow label={copy.privacyMode} value={store.privacyMode} onValueChange={store.setPrivacyMode} />
        <Pressable onPress={() => void clearLocalData()} className="bg-error rounded-lg p-4 items-center">
          <Text className="text-background font-semibold">{copy.clearLocalData}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <View className="bg-surface rounded-lg p-4 gap-3"><Text className="text-sm font-semibold text-foreground">{label}</Text>{children}</View>;
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View className="bg-surface rounded-lg p-4 flex-row justify-between items-center"><Text className="text-sm font-semibold text-foreground flex-1">{label}</Text><Switch value={value} onValueChange={onValueChange} /></View>;
}

function ChoiceRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (value: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{options.map((option) => <Pressable key={option} onPress={() => onSelect(option)} className={`px-3 py-2 rounded-md ${selected === option ? "bg-primary" : "bg-background border border-border"}`}><Text className={selected === option ? "text-background font-semibold" : "text-foreground"}>{getLanguageName(option) === option.toUpperCase() ? option : getLanguageName(option)}</Text></Pressable>)}</ScrollView>;
}
