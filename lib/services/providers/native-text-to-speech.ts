import * as Speech from "expo-speech";

import { getLanguageLocale } from "@/lib/config/languages";
import type { TextToSpeechOptions, TextToSpeechProvider } from "./interfaces";

export class NativeTextToSpeechProvider implements TextToSpeechProvider {
  private speaking = false;
  private lastUtterance: { text: string; language: string; options?: TextToSpeechOptions } | null = null;

  isAvailable(): boolean {
    return typeof Speech.speak === "function";
  }

  async speak(text: string, language: string, options?: TextToSpeechOptions, signal?: AbortSignal): Promise<void> {
    if (!text.trim()) return;
    await this.stop();
    this.speaking = true;
    this.lastUtterance = { text, language, options };

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => signal?.removeEventListener("abort", abort);
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.speaking = false;
        resolve();
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.speaking = false;
        options?.onError?.(error);
        reject(error);
      };
      const abort = () => {
        void this.stop();
        options?.onStopped?.();
        finish();
      };

      signal?.addEventListener("abort", abort, { once: true });

      Speech.speak(text, {
        language: getLanguageLocale(language),
        rate: options?.rate ?? 0.95,
        onStart: () => options?.onStart?.(),
        onDone: () => {
          options?.onDone?.();
          finish();
        },
        onStopped: () => {
          options?.onStopped?.();
          finish();
        },
        onError: (error) => fail(error),
      });
    });
  }

  async stop(): Promise<void> {
    if (this.speaking || (await Speech.isSpeakingAsync())) {
      await Speech.stop();
    }
    this.speaking = false;
  }

  async repeatLast(): Promise<void> {
    if (!this.lastUtterance) return;
    await this.speak(this.lastUtterance.text, this.lastUtterance.language, this.lastUtterance.options);
  }
}
