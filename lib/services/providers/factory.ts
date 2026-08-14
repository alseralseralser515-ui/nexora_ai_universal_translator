import { BackendLanguageDetectionProvider, BackendTranslationProvider } from "./backend-translation";
import type {
  LanguageDetectionProvider,
  ProviderFactoryConfig,
  SpeechRecognitionProvider,
  SpeechRecognitionResult,
  TextToSpeechProvider,
  TranslationProvider,
} from "./interfaces";
import {
  MockLanguageDetectionProvider,
  MockSpeechRecognitionProvider,
  MockTextToSpeechProvider,
  MockTranslationProvider,
} from "./mock";

class UnavailableSpeechRecognitionProvider implements SpeechRecognitionProvider {
  isAvailable() { return false; }
  async requestPermissions() { return { granted: false, reason: "Native speech recognition is unavailable. Install and run the native build." }; }
  async startListening(): Promise<SpeechRecognitionResult> { throw new Error("Native speech recognition is unavailable"); }
  async stopListening() { return undefined; }
  async abortListening() { return undefined; }
}

class UnavailableTextToSpeechProvider implements TextToSpeechProvider {
  isAvailable() { return false; }
  async speak() { throw new Error("Native text-to-speech is unavailable"); }
  async stop() { return undefined; }
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.EXPO_PUBLIC_USE_MOCKS === "true";
}

export class ProviderFactory {
  private static instance: ProviderFactory | null = null;
  private config: ProviderFactoryConfig = {};
  private speechRecognition: SpeechRecognitionProvider = new UnavailableSpeechRecognitionProvider();
  private languageDetection: LanguageDetectionProvider = new MockLanguageDetectionProvider();
  private translation: TranslationProvider = new MockTranslationProvider();
  private textToSpeech: TextToSpeechProvider = new UnavailableTextToSpeechProvider();

  static getInstance(): ProviderFactory {
    ProviderFactory.instance ??= new ProviderFactory();
    return ProviderFactory.instance;
  }

  initialize(config: ProviderFactoryConfig = {}): void {
    const mocks = isTestRuntime();
    this.config = {
      speechProvider: mocks ? "mock" : "native",
      textToSpeechProvider: mocks ? "mock" : "native",
      translationProvider: mocks ? "mock" : "backend",
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    this.speechRecognition = new UnavailableSpeechRecognitionProvider();
    if (this.config.speechProvider === "mock") {
      this.speechRecognition = new MockSpeechRecognitionProvider();
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeSpeechRecognitionProvider } = require("./native-speech-recognition");
        const nativeSpeech = new NativeSpeechRecognitionProvider();
        this.speechRecognition = nativeSpeech.isAvailable() ? nativeSpeech : new UnavailableSpeechRecognitionProvider();
      } catch {
        this.speechRecognition = new UnavailableSpeechRecognitionProvider();
      }
    }

    this.languageDetection = this.config.translationProvider === "backend"
      ? new BackendLanguageDetectionProvider(this.config.apiBaseUrl)
      : new MockLanguageDetectionProvider();

    this.textToSpeech = new UnavailableTextToSpeechProvider();
    if (this.config.textToSpeechProvider === "mock") {
      this.textToSpeech = new MockTextToSpeechProvider();
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeTextToSpeechProvider } = require("./native-text-to-speech");
        const nativeTts = new NativeTextToSpeechProvider();
        this.textToSpeech = nativeTts.isAvailable() ? nativeTts : new UnavailableTextToSpeechProvider();
      } catch {
        this.textToSpeech = new UnavailableTextToSpeechProvider();
      }
    }

    this.translation = this.config.translationProvider === "backend"
      ? new BackendTranslationProvider(this.config.apiBaseUrl)
      : new MockTranslationProvider();
  }

  getMode() {
    return {
      speech: this.speechRecognition instanceof MockSpeechRecognitionProvider ? "mock" : "native",
      textToSpeech: this.textToSpeech instanceof MockTextToSpeechProvider ? "mock" : "native",
      translation: this.translation instanceof MockTranslationProvider ? "mock" : "backend",
    } as const;
  }

  getSpeechRecognition(): SpeechRecognitionProvider { return this.speechRecognition; }
  getLanguageDetection(): LanguageDetectionProvider { return this.languageDetection; }
  getTranslation(): TranslationProvider { return this.translation; }
  getTextToSpeech(): TextToSpeechProvider { return this.textToSpeech; }
}

export function getProviderFactory(): ProviderFactory { return ProviderFactory.getInstance(); }
