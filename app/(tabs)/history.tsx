import { ScrollView, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { getLanguageName } from "@/lib/config/languages";
import { t } from "@/lib/localization/translations";
import { useConversationLanguages, useConversationSession, useConversationStore } from "@/lib/services/conversation/store";

export default function HistoryScreen() {
  const languages = useConversationLanguages();
  const session = useConversationSession();
  const store = useConversationStore();
  const copy = t(languages.interfaceLanguage);
  const messages = session?.messages ?? [];
  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-3xl font-bold text-foreground">{copy.history}</Text>
        {messages.length === 0 ? <Text className="text-muted">{copy.noHistory}</Text> : messages.map((message) => (
          <View key={message.id} className="bg-surface rounded-lg p-4 gap-2">
            <View className="flex-row justify-between"><Text className="text-xs text-muted">{getLanguageName(message.originalLanguage)} → {getLanguageName(message.targetLanguage)}</Text><Text className="text-xs text-muted">{new Date(message.timestamp).toLocaleTimeString()}</Text></View>
            <Text className="text-foreground">{message.originalText}</Text>
            <Text className="text-primary font-semibold">{message.translatedText}</Text>
            <Text className="text-xs text-muted">{message.direction}</Text>
          </View>
        ))}
        {messages.length > 0 && <Text onPress={store.clearMessages} className="text-error font-semibold text-center">{copy.clearConversation}</Text>}
      </ScrollView>
    </ScreenContainer>
  );
}
