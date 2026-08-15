import { createConversationEngine } from '../lib/services/conversation/engine';
import { useConversationStore } from '../lib/services/conversation/store';

// Fake providers similar to unit tests
class FakeSpeech {
  constructor(private result: { text: string; locale: string } ) {}
  isAvailable() { return true }
  async requestPermissions() { return { granted: true } }
  async startListening(_opts: any, _signal?: AbortSignal) { return { text: this.result.text, locale: this.result.locale, isFinal: true } }
  async stopListening() {}
  async abortListening() {}
}

class FakeDetector {
  constructor(private lang: string) {}
  async detectLanguage(_text: string) { return this.lang }
}

class FakeTranslation {
  calls: any[] = []
  constructor(private result: string) {}
  async translate(text: string, sourceLanguage: string, targetLanguage: string) {
    this.calls.push({ text, sourceLanguage, targetLanguage });
    return this.result;
  }
}

class FakeTts {
  calls: { text: string; language: string }[] = []
  isAvailable() { return true }
  async speak(text: string, language: string, _opts?: any) { this.calls.push({ text, language }); }
  async stop() {}
}

function makeFactory(parts: any) {
  return {
    getSpeechRecognition: () => parts.speech,
    getLanguageDetection: () => parts.detector,
    getTranslation: () => parts.translation,
    getTextToSpeech: () => parts.tts,
    getMode: () => ({ speech: 'mock', textToSpeech: 'mock', translation: 'mock' }),
  } as any;
}

async function runScenario(interlocutorLocale: string, interlocutorText: string) {
  // reset store and set My language = Russian
  useConversationStore.getState().reset();
  useConversationStore.getState().setSourceLanguage('ru');
  useConversationStore.getState().setTargetLanguage('en');

  const tts = new FakeTts();
  const translation = new FakeTranslation('[translated]');
  const speech = new FakeSpeech({ text: interlocutorText, locale: interlocutorLocale });
  const detector = new FakeDetector(interlocutorLocale);

  const engine = createConversationEngine({ providerFactory: makeFactory({ speech, detector, translation, tts }) });

  // Run one utterance (interlocutor speaks)
  await engine.startConversation();

  // After interlocutor speaks, store.detectedLanguage should be set to interlocutor language
  const detected = useConversationStore.getState().detectedLanguage;
  const lastMsg = useConversationStore.getState().session?.messages.at(-1);

  // Now simulate user (Russian) reply. Replace providers so speech returns Russian and detector returns 'ru'
  const userSpeech = new FakeSpeech({ text: 'Привет', locale: 'ru-RU' });
  const userDetector = new FakeDetector('ru');
  const userTranslation = new FakeTranslation('[user->interlocutor]');
  const userTts = new FakeTts();
  engine['providerFactory'] = makeFactory({ speech: userSpeech, detector: userDetector, translation: userTranslation, tts: userTts });

  // Run next utterance
  await engine.startConversation();

  const userLastMsg = useConversationStore.getState().session?.messages.at(-1);

  return {
    detected,
    lastMsg,
    userLastMsg,
    ttsCallsAfterInterlocutor: tts.calls,
    ttsCallsAfterUser: userTts.calls,
    translationCallsInterlocutor: translation.calls,
    translationCallsUser: userTranslation.calls,
  };
}

async function main() {
  console.log('Running EN↔RU scenario...');
  const en = await runScenario('en-US', 'Hello');
  console.log('EN result:', JSON.stringify(en, null, 2));

  console.log('Running PL↔RU scenario...');
  const pl = await runScenario('pl-PL', 'Cześć');
  console.log('PL result:', JSON.stringify(pl, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1) });
