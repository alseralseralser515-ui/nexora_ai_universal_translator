import { BackendLanguageDetectionProvider } from "./backend-language-detection";
import { BackendTranslationProvider } from "./backend-translation";
import type {
  LanguageDetectionProvider,
  ProviderFactoryConfig,
  SpeechRecognitionProvider,
  TextToSpeechProvider,
  TranslationProvider,
} from "./interfaces";
import {
  MockLanguageDetectionProvider,
  MockSpeechRecognitionProvider,
  MockTextToSpeechProvider,
  MockTranslationProvider,
} from "./mock";

export class ProviderFactory {
  private static instance: ProviderFactory | null = null;
  private config: ProviderFactoryConfig = { translationProvider: "mock" };
  private speechRecognition: SpeechRecognitionProvider = new MockSpeechRecognitionProvider();
  private languageDetection: LanguageDetectionProvider = new MockLanguageDetectionProvider();
  private translation: TranslationProvider = new MockTranslationProvider();
  private textToSpeech: TextToSpeechProvider = new MockTextToSpeechProvider();

  static getInstance(): ProviderFactory {
    ProviderFactory.instance ??= new ProviderFactory();
    return ProviderFactory.instance;
  }

  initialize(config: ProviderFactoryConfig = {}): void {
    this.config = {
      speechProvider: "mock",
      textToSpeechProvider: "mock",
      translationProvider: "mock",
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    this.speechRecognition = new MockSpeechRecognitionProvider();
    if (this.config.speechProvider === "native") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeSpeechRecognitionProvider } = require("./native-speech-recognition");
        const nativeSpeech = new NativeSpeechRecognitionProvider();
        if (nativeSpeech.isAvailable()) {
          this.speechRecognition = nativeSpeech;
        }
      } catch {
        this.speechRecognition = new MockSpeechRecognitionProvider();
      }
    }
    this.languageDetection =
      this.config.translationProvider === "backend"
        ? new BackendLanguageDetectionProvider(this.config.apiBaseUrl)
        : new MockLanguageDetectionProvider();
    this.textToSpeech = new MockTextToSpeechProvider();
    if (this.config.textToSpeechProvider === "native") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeTextToSpeechProvider } = require("./native-text-to-speech");
        const nativeTts = new NativeTextToSpeechProvider();
        if (nativeTts.isAvailable()) {
          this.textToSpeech = nativeTts;
        }
      } catch {
        this.textToSpeech = new MockTextToSpeechProvider();
      }
    }
    this.translation =
      this.config.translationProvider === "backend"
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

  getSpeechRecognition(): SpeechRecognitionProvider {
    return this.speechRecognition;
  }

  getLanguageDetection(): LanguageDetectionProvider {
    return this.languageDetection;
  }

  getTranslation(): TranslationProvider {
    return this.translation;
  }

  getTextToSpeech(): TextToSpeechProvider {
    return this.textToSpeech;
  }
}

export function getProviderFactory(): ProviderFactory {
  return ProviderFactory.getInstance();
}
