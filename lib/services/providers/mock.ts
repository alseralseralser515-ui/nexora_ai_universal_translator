import type {
  LanguageDetectionProvider,
  SpeechRecognitionOptions,
  SpeechRecognitionResult,
  SpeechRecognitionProvider,
  TextToSpeechProvider,
  TextToSpeechOptions,
  TranslationProvider,
} from "./interfaces";

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Operation cancelled");
  }
}

export class MockSpeechRecognitionProvider implements SpeechRecognitionProvider {
  isAvailable(): boolean {
    return true;
  }

  async requestPermissions() {
    return { granted: true, canAskAgain: true };
  }

  async startListening(options: SpeechRecognitionOptions, signal?: AbortSignal): Promise<SpeechRecognitionResult> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    throwIfAborted(signal);
    return {
      text: "Привіт, як справи?",
      locale: options.locale,
      isFinal: true,
      interimText: "Привіт",
      confidence: 1,
    };
  }

  async stopListening(): Promise<void> {
    return Promise.resolve();
  }

  async abortListening(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockLanguageDetectionProvider implements LanguageDetectionProvider {
  async detectLanguage(text: string, signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal);
    if (/[іїєґ]/i.test(text)) return "uk";
    if (/[а-яё]/i.test(text)) return "ru";
    return "en";
  }
}

export class MockTranslationProvider implements TranslationProvider {
  async translate(text: string, sourceLanguage: string, targetLanguage: string, signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal);
    const dictionary: Record<string, Record<string, string>> = {
      "Привіт, як справи?": {
        en: "Hello, how are you?",
        ru: "Привет, как дела?",
        uk: "Привіт, як справи?",
      },
      "Hello, how are you?": {
        uk: "Привіт, як справи?",
        ru: "Привет, как дела?",
        en: "Hello, how are you?",
      },
    };

    return dictionary[text]?.[targetLanguage] ?? `[${sourceLanguage} -> ${targetLanguage}] ${text}`;
  }
}

export class MockTextToSpeechProvider implements TextToSpeechProvider {
  private lastUtterance: { text: string; language: string; options?: TextToSpeechOptions } | null = null;

  isAvailable(): boolean {
    return true;
  }

  async speak(text: string, language: string, options?: TextToSpeechOptions, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    this.lastUtterance = { text, language, options };
    options?.onStart?.();
    console.info(`[mock-tts:${language}] ${text}`);
    options?.onDone?.();
  }

  async stop(): Promise<void> {
    this.lastUtterance?.options?.onStopped?.();
    return Promise.resolve();
  }

  async repeatLast(): Promise<void> {
    if (!this.lastUtterance) return;
    await this.speak(this.lastUtterance.text, this.lastUtterance.language, this.lastUtterance.options);
  }
}
