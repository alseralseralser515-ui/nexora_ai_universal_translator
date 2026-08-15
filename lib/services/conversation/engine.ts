import { createLocalId } from "@/lib/utils";

import { getLanguageLocale, isSupportedLanguage, normalizeLanguageCode } from "@/lib/config/languages";
import { audioSessionManager } from "../audio/audio-session-manager";
import { getProviderFactory, ProviderFactory } from "../providers/factory";
import type { SpeechRecognitionResult } from "../providers/interfaces";
import { useConversationStore } from "./store";
import { ConversationErrorCode, ConversationState, type SpeakerDirection } from "./types";

export interface ConversationEngineConfig {
  timeout?: number;
  maxRetries?: number;
  speechRate?: number;
  providerFactory?: ProviderFactory;
}

export interface TranslationDirection {
  direction: SpeakerDirection;
  sourceLanguage: string;
  targetLanguage: string;
}

export function resolveTranslationDirection(
  detectedLanguage: string,
  userLanguage: string,
  interlocutorLanguage: string,
): TranslationDirection {
  const detected = normalizeLanguageCode(detectedLanguage);
  const user = normalizeLanguageCode(userLanguage === "auto" ? "uk" : userLanguage);
  const interlocutor = normalizeLanguageCode(interlocutorLanguage === "auto" ? "en" : interlocutorLanguage);

  if (detected === user) {
    return {
      direction: "user_to_interlocutor",
      sourceLanguage: detected,
      targetLanguage: interlocutor,
    };
  }

  if (detected === interlocutor) {
    return {
      direction: "interlocutor_to_user",
      sourceLanguage: detected,
      targetLanguage: user,
    };
  }

  // For an unexpected third language, preserve the selected conversation pair:
  // unknown speech is translated to the interlocutor language by default.
  return {
    direction: "user_to_interlocutor",
    sourceLanguage: detected,
    targetLanguage: interlocutor,
  };
}

export class ConversationEngine {
  private store = useConversationStore;
  private providerFactory: ProviderFactory;
  private config: Required<Omit<ConversationEngineConfig, "providerFactory">>;
  private activeRun: Promise<void> | null = null;
  private stopped = false;

  constructor(config: ConversationEngineConfig = {}) {
    this.providerFactory = config.providerFactory ?? getProviderFactory();
    this.config = {
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      speechRate: config.speechRate ?? 0.95,
    };
  }

  async startConversation(): Promise<void> {
    let state = this.store.getState().state;
    if (this.activeRun || state === ConversationState.RECOGNIZING || state === ConversationState.TRANSLATING || state === ConversationState.SPEAKING) {
      return;
    }
    if (state === ConversationState.ERROR) {
      await this.store.getState().transitionTo(ConversationState.RETRYING);
      await this.store.getState().transitionTo(ConversationState.IDLE);
      state = ConversationState.IDLE;
    } else if (state === ConversationState.STOPPED) {
      await this.store.getState().transitionTo(ConversationState.IDLE);
      state = ConversationState.IDLE;
    }
    this.stopped = false;
    this.activeRun = this.runConversationLoop();
    try {
      await this.activeRun;
    } finally {
      this.activeRun = null;
    }
  }

  private async runConversationLoop(): Promise<void> {
    const continuousNativeListening = this.providerFactory.getMode().speech === "native";
    do {
      await this.runUtterance();
    } while (
      continuousNativeListening &&
      !this.stopped &&
      this.store.getState().state === ConversationState.LISTENING
    );
  }

  async pauseConversation(): Promise<void> {
    const store = this.store.getState();
    this.stopped = true;
    await this.cancelProviders();
    await store.cancelCurrentOperation();
    store.setMicrophoneEnabled(false);
    store.setPlaybackActive(false);
    await audioSessionManager.reset();
    await store.transitionTo(ConversationState.PAUSED);
  }

  async resumeConversation(): Promise<void> {
    const store = this.store.getState();
    if (store.state !== ConversationState.PAUSED) return;
    await store.transitionTo(ConversationState.IDLE);
    await this.startConversation();
  }

  async stopConversation(): Promise<void> {
    const store = this.store.getState();
    this.stopped = true;
    await this.cancelProviders();
    await store.cancelCurrentOperation();
    store.setActiveOperationId(null);
    store.setMicrophoneEnabled(false);
    store.setPlaybackActive(false);
    store.endSession();
    await audioSessionManager.reset();
    if (store.state !== ConversationState.IDLE) {
      await store.transitionTo(ConversationState.STOPPED);
      await store.transitionTo(ConversationState.IDLE);
    }
  }

  async repeatLast(): Promise<void> {
    const store = this.store.getState();
    const last = store.session?.messages.at(-1);
    if (!last || store.playbackActive) return;
    const operationId = createLocalId("operation");
    this.stopped = false;
    store.setActiveOperationId(operationId);
    try {
      await this.speak(last.translatedText, last.targetLanguage, operationId);
      await store.transitionTo(ConversationState.IDLE);
    } catch (error) {
      await this.handleConversationError(error as Error);
    } finally {
      if (this.store.getState().activeOperationId === operationId) {
        this.store.getState().setActiveOperationId(null);
      }
    }
  }

  async cleanup(): Promise<void> {
    await this.stopConversation();
    this.providerFactory.getSpeechRecognition().cleanup?.();
  }

  private async runUtterance(): Promise<void> {
    const operationId = createLocalId("operation");
    const store = this.store.getState();
    store.setActiveOperationId(operationId);
    store.clearError();

    try {
      if (store.state === ConversationState.IDLE) {
        await this.requestMicrophonePermission(operationId);
      }
      if (!store.session) {
        store.createSession(store.sourceLanguage, store.targetLanguage);
      }
      const recognized = await this.listen(operationId);
      const processed = await this.processRecognizedText(operationId, recognized);
      if (this.store.getState().autoTtsPlayback) {
        await this.speak(processed.translatedText, processed.targetLanguage, operationId);
      }
      this.assertFresh(operationId);
      if (!this.stopped) {
        await this.store.getState().transitionTo(ConversationState.LISTENING);
      }
    } catch (error) {
      if ((error as Error).message.includes("stale") || (error as Error).message.includes("cancelled")) {
        return;
      }
      await this.handleConversationError(error as Error);
    } finally {
      const latest = this.store.getState();
      if (latest.activeOperationId === operationId) {
        latest.setActiveOperationId(null);
      }
      latest.setMicrophoneEnabled(false);
      latest.setPlaybackActive(false);
      await audioSessionManager.reset();
    }
  }

  private async requestMicrophonePermission(operationId: string): Promise<void> {
    const store = this.store.getState();
    await store.transitionTo(ConversationState.REQUESTING_PERMISSION);
    this.assertFresh(operationId);

    const provider = this.providerFactory.getSpeechRecognition();
    if (!provider.isAvailable()) {
      throw new Error("Speech recognition not available on this platform");
    }
    const permission = await provider.requestPermissions?.();
    if (permission && !permission.granted) {
      throw new Error(permission.reason ?? "Microphone or speech recognition permission denied");
    }
  }

  private async listen(operationId: string): Promise<SpeechRecognitionResult> {
    const store = this.store.getState();
    if (store.state !== ConversationState.LISTENING) {
      await store.transitionTo(ConversationState.LISTENING);
    }
    await audioSessionManager.prepareForRecording();
    store.setMicrophoneEnabled(true);
    await store.transitionTo(ConversationState.RECOGNIZING);
    this.assertFresh(operationId);

    const controller = store.startOperation("listen");
    try {
      const locales = this.getRecognitionLocales();
      let lastError: Error | null = null;
      for (const locale of locales) {
        try {
          const result = await this.providerFactory.getSpeechRecognition().startListening(
            {
              locale,
              interimResults: true,
              silenceTimeoutMs: this.store.getState().phraseEndPauseMs,
              timeoutMs: this.config.timeout,
              maxRetries: this.config.maxRetries,
            },
            controller.signal,
          );
          this.assertFresh(operationId);
          if (!result.text.trim()) {
            throw new Error("No speech recognized");
          }
          store.setRecognizedText(result.text);
          store.completeOperation();
          return result;
        } catch (error) {
          lastError = error as Error;
          if (
            (error as Error).message.includes("cancelled") ||
            (error as Error).message.includes("stale") ||
            (error as Error).message.includes("permission") ||
            (error as Error).message.includes("not-allowed")
          ) {
            throw error;
          }
          // On unsupported locale or no recognition, try the next candidate.
        }
      }
      if (lastError) {
        throw lastError;
      }
      throw new Error("No speech recognized");
    } catch (error) {
      store.completeOperation();
      throw error;
    } finally {
      store.setMicrophoneEnabled(false);
      await audioSessionManager.reset();
    }
  }

  private getRecognitionLocales(): string[] {
    const store = this.store.getState();
    // The two selected conversation languages must be attempted first.
    // This avoids listening to Ukrainian/Russian speech with an English recognizer
    // merely because English is the interlocutor language.
    const userLanguage = store.sourceLanguage === "auto" ? "uk" : store.sourceLanguage;
    const interlocutorLanguage = store.targetLanguage === "auto" ? "en" : store.targetLanguage;
    const fallbackCodes = [userLanguage, interlocutorLanguage, "uk", "ru", "en"];
    return Array.from(new Set(fallbackCodes.filter(Boolean).map(getLanguageLocale)));
  }

  private async processRecognizedText(operationId: string, recognized: SpeechRecognitionResult) {
    const store = this.store.getState();
    await store.transitionTo(ConversationState.DETECTING_LANGUAGE);
    const detectController = store.startOperation("detect");
    let detectedLanguage: string;
    try {
      detectedLanguage = store.autoDetectLanguage
        ? await this.providerFactory.getLanguageDetection().detectLanguage(recognized.text, detectController.signal)
        : normalizeLanguageCode(recognized.locale || store.sourceLanguage);
      store.completeOperation();
    } catch (error) {
      store.completeOperation();
      throw new Error(`Language detection failed: ${(error as Error).message}`);
    }
    this.assertFresh(operationId);
    if (!isSupportedLanguage(detectedLanguage) || detectedLanguage === "auto") {
      throw new Error(`Unsupported detected language: ${detectedLanguage}`);
    }
    store.setDetectedLanguage(detectedLanguage);

    const direction = resolveTranslationDirection(detectedLanguage, store.sourceLanguage, store.targetLanguage);
    store.setSpeakerDirection(direction.direction);

    await store.transitionTo(ConversationState.TRANSLATING);
    const translateController = store.startOperation("translate");
    const translatedText = await this.providerFactory
      .getTranslation()
      .translate(recognized.text, direction.sourceLanguage, direction.targetLanguage, translateController.signal, {
        style: store.translationStyle,
      });
    store.completeOperation();
    this.assertFresh(operationId);

    store.setTranslatedText(translatedText);
    store.addMessage({
      originalText: recognized.text,
      originalLanguage: direction.sourceLanguage,
      translatedText,
      targetLanguage: direction.targetLanguage,
      direction: direction.direction,
      operationId,
    });

    return { translatedText, targetLanguage: direction.targetLanguage };
  }

  private async speak(text: string, language: string, operationId: string): Promise<void> {
    const store = this.store.getState();
    await store.transitionTo(ConversationState.SPEAKING);
    this.assertFresh(operationId);
    await this.providerFactory.getSpeechRecognition().abortListening?.();
    await audioSessionManager.prepareForPlayback();
    store.setMicrophoneEnabled(false);
    store.setPlaybackActive(true);

    const controller = store.startOperation("speak");
    try {
      await this.providerFactory.getTextToSpeech().speak(
        text,
        language,
        {
          rate: this.store.getState().speechRate || this.config.speechRate,
          onStart: () => store.setPlaybackActive(true),
          onDone: () => store.setPlaybackActive(false),
          onStopped: () => store.setPlaybackActive(false),
          onError: () => store.setPlaybackActive(false),
        },
        controller.signal,
      );
      this.assertFresh(operationId);
      store.completeOperation();
    } catch (error) {
      store.completeOperation();
      throw error;
    } finally {
      store.setPlaybackActive(false);
      await audioSessionManager.reset();
    }
  }

  private assertFresh(operationId: string): void {
    if (this.stopped || this.store.getState().activeOperationId !== operationId) {
      throw new Error("stale operation result rejected");
    }
  }

  private async cancelProviders(): Promise<void> {
    await this.providerFactory.getSpeechRecognition().abortListening?.();
    await this.providerFactory.getTextToSpeech().stop();
  }

  private async handleConversationError(error: Error): Promise<void> {
    const store = this.store.getState();
    const message = error.message || "Conversation failed";
    const lower = message.toLowerCase();
    const code = lower.includes("permission") || lower.includes("microphone")
      ? ConversationErrorCode.MICROPHONE_PERMISSION_DENIED
      : lower.includes("detection") || lower.includes("language")
        ? ConversationErrorCode.LANGUAGE_DETECTION_FAILED
        : lower.includes("timeout") || lower.includes("timed out")
          ? ConversationErrorCode.TIMEOUT
          : lower.includes("speech") || lower.includes("recogn")
            ? ConversationErrorCode.SPEECH_RECOGNITION_FAILED
            : lower.includes("speak") || lower.includes("playback") || lower.includes("tts")
              ? ConversationErrorCode.TEXT_TO_SPEECH_FAILED
              : lower.includes("translation") || lower.includes("translate") || lower.includes("network") || lower.includes("request failed")
                ? ConversationErrorCode.TRANSLATION_FAILED
                : ConversationErrorCode.UNKNOWN;

    store.setError(code, message, true, { originalError: message });
    await store.transitionTo(ConversationState.ERROR);
  }
}

export function createConversationEngine(config?: ConversationEngineConfig): ConversationEngine {
  return new ConversationEngine(config);
}
