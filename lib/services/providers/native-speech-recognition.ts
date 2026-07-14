import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

import type {
  ProviderPermissionResult,
  SpeechRecognitionOptions,
  SpeechRecognitionProvider,
  SpeechRecognitionResult,
} from "./interfaces";

type Subscription = { remove: () => void };

export class NativeSpeechRecognitionProvider implements SpeechRecognitionProvider {
  private active = false;
  private subscriptions: Subscription[] = [];
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  isAvailable(): boolean {
    try {
      return Platform.OS !== "web" && ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<ProviderPermissionResult> {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return {
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
        reason: permission.granted ? undefined : permission.status,
      };
    } catch (error) {
      return { granted: false, canAskAgain: false, reason: (error as Error).message };
    }
  }

  async startListening(options: SpeechRecognitionOptions, signal?: AbortSignal): Promise<SpeechRecognitionResult> {
    if (this.active) {
      throw new Error("Speech recognition is already active");
    }
    if (!this.isAvailable()) {
      throw new Error("Native speech recognition is unavailable");
    }

    this.active = true;

    return new Promise<SpeechRecognitionResult>((resolve, reject) => {
      let settled = false;
      let lastText = "";
      let interimText = "";
      let confidence: number | undefined;
      const abort = () => {
        ExpoSpeechRecognitionModule.abort();
        finish(undefined, new Error("Speech recognition cancelled"));
      };

      const finish = (result?: SpeechRecognitionResult, error?: Error) => {
        if (settled) return;
        settled = true;
        this.clearTimers();
        this.cleanup();
        this.active = false;
        signal?.removeEventListener("abort", abort);
        if (error) {
          reject(error);
        } else if (result?.text.trim()) {
          resolve(result);
        } else {
          reject(new Error("No speech recognized"));
        }
      };

      const resetSilenceTimer = () => {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          if (lastText.trim()) {
            ExpoSpeechRecognitionModule.stop();
          }
        }, options.silenceTimeoutMs ?? 1400);
      };

      const onResult = (event: ExpoSpeechRecognitionResultEvent) => {
        const best = event.results[0];
        const transcript = best?.transcript?.trim() ?? "";
        if (transcript) {
          confidence = best.confidence >= 0 ? best.confidence : confidence;
          if (event.isFinal) {
            lastText = transcript;
          } else {
            interimText = transcript;
            lastText = transcript;
          }
          resetSilenceTimer();
        }

        if (event.isFinal) {
          finish({
            text: transcript || lastText,
            locale: options.locale,
            isFinal: true,
            interimText,
            confidence,
          });
        }
      };

      const onError = (event: ExpoSpeechRecognitionErrorEvent) => {
        if (event.error === "aborted") {
          finish(undefined, new Error("Speech recognition cancelled"));
          return;
        }
        finish(undefined, new Error(event.message || event.error));
      };

      this.subscriptions = [
        ExpoSpeechRecognitionModule.addListener("result", onResult),
        ExpoSpeechRecognitionModule.addListener("error", onError),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          if (lastText.trim()) {
            finish({ text: lastText, locale: options.locale, isFinal: true, interimText, confidence });
          } else {
            finish(undefined, new Error("No speech recognized"));
          }
        }),
      ];

      signal?.addEventListener("abort", abort, { once: true });

      this.timeoutTimer = setTimeout(() => {
        ExpoSpeechRecognitionModule.abort();
        finish(undefined, new Error("Speech recognition timed out"));
      }, options.timeoutMs ?? 15000);

      try {
        ExpoSpeechRecognitionModule.start({
          lang: options.locale,
          interimResults: options.interimResults ?? true,
          continuous: false,
          addsPunctuation: true,
          iosVoiceProcessingEnabled: true,
        });
      } catch (error) {
        finish(undefined, error as Error);
      }
    });
  }

  async stopListening(): Promise<void> {
    if (this.active) {
      ExpoSpeechRecognitionModule.stop();
    }
  }

  async abortListening(): Promise<void> {
    if (this.active) {
      ExpoSpeechRecognitionModule.abort();
    }
    this.cleanup();
    this.active = false;
  }

  cleanup(): void {
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.silenceTimer = null;
    this.timeoutTimer = null;
  }
}
