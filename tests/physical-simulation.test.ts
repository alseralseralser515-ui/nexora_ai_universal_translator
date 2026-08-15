import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationEngine } from '../lib/services/conversation/engine';
import { useConversationStore } from '../lib/services/conversation/store';
import type { SpeechRecognitionResult } from '../lib/services/providers/interfaces';

class FakeSpeech {
  constructor(private result: SpeechRecognitionResult) {}
  isAvailable() { return true }
  async requestPermissions() { return { granted: true } }
  async startListening(_opts: any, _signal?: AbortSignal) { return this.result }
  async stopListening() {}
  async abortListening() {}
}

class FakeDetector {
  constructor(private lang: string) {}
  async detectLanguage(_text: string) { return this.lang }
}

class FakeTranslation {
  calls: { text:string; sourceLanguage:string; targetLanguage:string }[] = [];
  constructor(private out = 'translated') {}
  async translate(text:string, sourceLanguage:string, targetLanguage:string) {
    this.calls.push({ text, sourceLanguage, targetLanguage });
    return this.out;
  }
}

class FakeTts {
  calls: { text:string; language:string }[] = [];
  isAvailable() { return true }
  async speak(text:string, language:string, opts?: any) { this.calls.push({ text, language }); opts?.onStart?.(); opts?.onDone?.(); }
  async stop() {}
}

function factory(parts:any) {
  return {
    getSpeechRecognition: () => parts.speech,
    getLanguageDetection: () => parts.detector,
    getTranslation: () => parts.translation,
    getTextToSpeech: () => parts.tts,
    getMode: () => ({ speech: 'mock', textToSpeech: 'mock', translation: 'mock' }),
  } as any;
}

beforeEach(() => {
  useConversationStore.getState().reset();
});

describe('Physical-like simulation', () => {
  it('EN <-> RU bidirectional', async () => {
    // User sets My language = Russian
    useConversationStore.getState().setSourceLanguage('ru');
    useConversationStore.getState().setTargetLanguage('en');

    // Interlocutor speaks English
    const speech1 = new FakeSpeech({ text: 'Hello', locale: 'en-US', isFinal: true });
    const detector1 = new FakeDetector('en');
    const translation1 = new FakeTranslation('Привет');
    const tts1 = new FakeTts();

    const engine = new ConversationEngine({ providerFactory: factory({ speech: speech1, detector: detector1, translation: translation1, tts: tts1 }) });
    await engine.startConversation();

    // After interlocutor speaks, should detect English and translate to Russian
    expect(useConversationStore.getState().detectedLanguage).toBe('en');
    expect(translation1.calls[0]).toMatchObject({ sourceLanguage: 'en', targetLanguage: 'ru' });
    expect(tts1.calls[0].language).toBe('ru');

    // Now user replies in Russian
    const speech2 = new FakeSpeech({ text: 'Привет', locale: 'ru-RU', isFinal: true });
    const detector2 = new FakeDetector('ru');
    const translation2 = new FakeTranslation('Hello');
    const tts2 = new FakeTts();

    // swap providers in engine
    (engine as any).providerFactory = factory({ speech: speech2, detector: detector2, translation: translation2, tts: tts2 });
    await engine.startConversation();

    // Should translate from Russian to previously detected interlocutor language (English)
    expect(translation2.calls[0]).toMatchObject({ sourceLanguage: 'ru', targetLanguage: 'en' });
    expect(tts2.calls[0].language).toBe('en');
  });

  it('PL <-> RU bidirectional', async () => {
    // Reset and set user language to Russian
    useConversationStore.getState().reset();
    useConversationStore.getState().setSourceLanguage('ru');
    useConversationStore.getState().setTargetLanguage('en');

    // Interlocutor speaks Polish
    const speech1 = new FakeSpeech({ text: 'Cześć', locale: 'pl-PL', isFinal: true });
    const detector1 = new FakeDetector('pl');
    const translation1 = new FakeTranslation('Привіт');
    const tts1 = new FakeTts();

    const engine = new ConversationEngine({ providerFactory: factory({ speech: speech1, detector: detector1, translation: translation1, tts: tts1 }) });
    await engine.startConversation();

    expect(useConversationStore.getState().detectedLanguage).toBe('pl');
    expect(translation1.calls[0]).toMatchObject({ sourceLanguage: 'pl', targetLanguage: 'ru' });
    expect(tts1.calls[0].language).toBe('ru');

    // User replies in Russian
    const speech2 = new FakeSpeech({ text: 'Привіт', locale: 'ru-RU', isFinal: true });
    const detector2 = new FakeDetector('ru');
    const translation2 = new FakeTranslation('Cześć');
    const tts2 = new FakeTts();

    (engine as any).providerFactory = factory({ speech: speech2, detector: detector2, translation: translation2, tts: tts2 });
    await engine.startConversation();

    expect(translation2.calls[0]).toMatchObject({ sourceLanguage: 'ru', targetLanguage: 'pl' });
    expect(tts2.calls[0].language).toBe('pl');
  });
});
