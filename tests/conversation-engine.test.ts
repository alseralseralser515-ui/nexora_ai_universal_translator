import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationEngine, resolveTranslationDirection } from "../lib/services/conversation/engine";
import { useConversationStore } from "../lib/services/conversation/store";
import { ConversationState } from "../lib/services/conversation/types";
import type {
  LanguageDetectionProvider,
  SpeechRecognitionProvider,
  SpeechRecognitionResult,
  TextToSpeechProvider,
  TranslationProvider,
} from "../lib/services/providers/interfaces";
import type { ProviderFactory } from "../lib/services/providers/factory";

class FakeSpeech implements SpeechRecognitionProvider {
  aborted = false;
  stopCalls = 0;
  abortCalls = 0;
  constructor(private result: SpeechRecognitionResult | Error = { text: "Hello", locale: "en-US", isFinal: true }) {}
  isAvailable() {
    return true;
  }
  async requestPermissions() {
    return { granted: true };
  }
  async startListening(_options: { locale: string }, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("cancelled");
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
  async stopListening() {
    this.stopCalls += 1;
  }
  async abortListening() {
    this.aborted = true;
    this.abortCalls += 1;
  }
}

class FakeDetector implements LanguageDetectionProvider {
  constructor(private language = "en") {}
  async detectLanguage() {
    return this.language;
  }
}

class FakeTranslation implements TranslationProvider {
  constructor(private result: string | Error = "Привіт") {}
  async translate() {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class FakeTts implements TextToSpeechProvider {
  stopCalls = 0;
  speakCalls = 0;
  microphoneStates: boolean[] = [];
  constructor(private fail = false) {}
  isAvailable() {
    return true;
  }
  async speak(_text: string, _language: string, options?: { onStart?: () => void; onDone?: () => void }) {
    this.speakCalls += 1;
    this.microphoneStates.push(useConversationStore.getState().microphoneEnabled);
    options?.onStart?.();
    if (this.fail) throw new Error("playback failed");
    options?.onDone?.();
  }
  async stop() {
    this.stopCalls += 1;
  }
}

function factory(parts: {
  speech?: SpeechRecognitionProvider;
  detector?: LanguageDetectionProvider;
  translation?: TranslationProvider;
  tts?: TextToSpeechProvider;
}) {
  return {
    getSpeechRecognition: () => parts.speech ?? new FakeSpeech(),
    getLanguageDetection: () => parts.detector ?? new FakeDetector(),
    getTranslation: () => parts.translation ?? new FakeTranslation(),
    getTextToSpeech: () => parts.tts ?? new FakeTts(),
    getMode: () => ({ speech: "mock", textToSpeech: "mock", translation: "mock" }),
  } as unknown as ProviderFactory;
}

beforeEach(() => {
  useConversationStore.getState().reset();
  useConversationStore.getState().setSourceLanguage("uk");
  useConversationStore.getState().setTargetLanguage("en");
});

describe("ConversationEngine", () => {
  it("runs the real conversation state flow and resumes listening after playback", async () => {
    const tts = new FakeTts();
    const engine = new ConversationEngine({ providerFactory: factory({ tts }) });

    await engine.startConversation();

    const state = useConversationStore.getState();
    expect(state.state).toBe(ConversationState.LISTENING);
    expect(state.session?.messages).toHaveLength(1);
    expect(state.recognizedText).toBe("Hello");
    expect(state.translatedText).toBe("Привіт");
    expect(tts.speakCalls).toBe(1);
  });

  it("prevents duplicate recognition sessions", async () => {
    const speech = new FakeSpeech();
    const engine = new ConversationEngine({ providerFactory: factory({ speech }) });

    await Promise.all([engine.startConversation(), engine.startConversation()]);

    expect(useConversationStore.getState().session?.messages).toHaveLength(1);
  });

  it("keeps microphone disabled during TTS playback", async () => {
    const tts = new FakeTts();
    const engine = new ConversationEngine({ providerFactory: factory({ tts }) });

    await engine.startConversation();

    expect(tts.microphoneStates).toEqual([false]);
  });

  it("supports pause, resume, stop, and cleanup", async () => {
    const speech = new FakeSpeech();
    const tts = new FakeTts();
    const engine = new ConversationEngine({ providerFactory: factory({ speech, tts }) });

    await engine.startConversation();
    await engine.pauseConversation();
    expect(useConversationStore.getState().state).toBe(ConversationState.PAUSED);
    await engine.resumeConversation();
    expect(useConversationStore.getState().state).toBe(ConversationState.LISTENING);
    await engine.stopConversation();
    expect(useConversationStore.getState().state).toBe(ConversationState.IDLE);
    await engine.cleanup();
    expect(speech.abortCalls).toBeGreaterThan(0);
    expect(tts.stopCalls).toBeGreaterThan(0);
  });

  it("rejects stale operation results after stop", async () => {
    let resolveSpeech: (value: SpeechRecognitionResult) => void = () => undefined;
    const speech: SpeechRecognitionProvider = {
      isAvailable: () => true,
      requestPermissions: async () => ({ granted: true }),
      startListening: () => new Promise((resolve) => { resolveSpeech = resolve; }),
      stopListening: async () => undefined,
      abortListening: async () => undefined,
    };
    const engine = new ConversationEngine({ providerFactory: factory({ speech }) });
    const run = engine.startConversation();
    await vi.waitFor(() => expect(useConversationStore.getState().state).toBe(ConversationState.RECOGNIZING));
    await engine.stopConversation();
    resolveSpeech({ text: "late", locale: "en-US", isFinal: true });
    await run;
    expect(useConversationStore.getState().session?.messages ?? []).toHaveLength(0);
  });

  it("surfaces recognition, translation, and TTS failures", async () => {
    await new ConversationEngine({ providerFactory: factory({ speech: new FakeSpeech(new Error("recognition failed")) }) }).startConversation();
    expect(useConversationStore.getState().error?.code).toBe("speech_recognition_failed");

    useConversationStore.getState().reset();
    await new ConversationEngine({ providerFactory: factory({ translation: new FakeTranslation(new Error("translation failed")) }) }).startConversation();
    expect(useConversationStore.getState().error?.code).toBe("translation_failed");

    useConversationStore.getState().reset();
    await new ConversationEngine({ providerFactory: factory({ tts: new FakeTts(true) }) }).startConversation();
    expect(useConversationStore.getState().error?.code).toBe("text_to_speech_failed");
  });
});

describe("conversation recovery", () => {
  it("returns from a recoverable error to a fresh cycle", async () => {
    const engine = new ConversationEngine({ providerFactory: factory({ speech: new FakeSpeech(new Error("recognition failed")) }) });
    await engine.startConversation();
    expect(useConversationStore.getState().state).toBe(ConversationState.ERROR);
    useConversationStore.getState().clearError();
    await engine.startConversation();
    expect(useConversationStore.getState().state).toBe(ConversationState.ERROR);
  });
});

describe("translation direction", () => {
  it("chooses interlocutor to user when detected language differs from user language", () => {
    expect(resolveTranslationDirection("uk", "en", "uk")).toEqual({
      direction: "interlocutor_to_user",
      sourceLanguage: "uk",
      targetLanguage: "en",
    });
  });

  it("chooses user to interlocutor when detected language matches user language", () => {
    expect(resolveTranslationDirection("en-US", "en", "uk")).toEqual({
      direction: "user_to_interlocutor",
      sourceLanguage: "en",
      targetLanguage: "uk",
    });
  });
});
