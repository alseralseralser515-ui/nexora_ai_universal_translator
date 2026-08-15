import { getLanguageLocale, normalizeLanguageCode } from "@/lib/config/languages";
import { createRuntimeId } from "@/lib/utils/runtime-id";
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
  const user = userLanguage === "auto" ? "uk" : userLanguage;
  const interlocutor = interlocutorLanguage === "auto" ? detected : interlocutorLanguage;

  if (detected === user) {
    return {
      direction: "user_to_interlocutor",
      sourceLanguage: user,
      targetLanguage: interlocutor === user ? "en" : interlocutor,
    };
  }

  return {
    direction: "interlocutor_to_user",
    sourceLanguage: detected,
    targetLanguage: user,
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
    const state = this.store.getState().state;
    if (this.activeRun || state === ConversationState.RECOGNIZING || state === ConversationState.TRANSLATING || state === ConversationState.SPEAKING) {
      return;
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
    if (
      !last ||
      store.playbackActive ||
      (store.state !== ConversationState.IDLE && store.state !== ConversationState.PAUSED)
    ) return;
    const returnState = store.state;
    const operationId = createRuntimeId();
    this.stopped = false;
    store.setActiveOperationId(operationId);
    try {
      await this.speak(last.translatedText, last.targetLanguage, operationId);
      await store.transitionTo(returnState);
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
    const operationId = createRuntimeId();
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
      await this.speak(processed.translatedText, processed.targetLanguage, operationId);
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
      const settingsHint = permission.canAskAgain === false
        ? " Enable microphone and speech recognition access in iOS Settings."
        : "";
      throw new Error("Microphone or speech recognition permission denied." + settingsHint);
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
              silenceTimeoutMs: 1400,
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
    const preferred =
      store.sourceLanguage === "auto"
        ? store.detectedLanguage ?? store.interfaceLanguage
        : store.sourceLanguage;
    const fallbackCodes = [preferred, store.targetLanguage, "uk", "ru", "en"];
    return Array.from(new Set(fallbackCodes.filter(Boolean).map(getLanguageLocale)));
  }

  private async processRecognizedText(operationId: string, recognized: SpeechRecognitionResult) {
    const store = this.store.getState();
    await store.transitionTo(ConversationState.DETECTING_LANGUAGE);
    const detectController = store.startOperation("detect");
    const detectedLanguage = await this.providerFactory.getLanguageDetection().detectLanguage(recognized.text, detectController.signal);
    store.completeOperation();
    this.assertFresh(operationId);

    // Normalize detected language
    const detected = normalizeLanguageCode(detectedLanguage);

    // Determine the explicitly selected user language (null if set to auto)
    const explicitUserLang = store.sourceLanguage === "auto" ? null : normalizeLanguageCode(store.sourceLanguage);

    // Determine existing stored interlocutor language (from store.detectedLanguage or session)
    const storedInterlocutor = store.detectedLanguage ?? store.session?.targetLanguage ?? store.targetLanguage;

    // Decide who is speaking based on detected language
    let sourceLanguage: string;
    let targetLanguage: string;
    let direction: SpeakerDirection;

    if (explicitUserLang && detected === explicitUserLang) {
      // Local user is speaking -> translate from user's explicit language to interlocutor's language (if known)
      direction = "user_to_interlocutor";
      sourceLanguage = explicitUserLang;
      // Prefer previously detected interlocutor language; fallback to stored target or default
      targetLanguage = storedInterlocutor ?? (explicitUserLang === "en" ? "ru" : "en");
    } else {
      // Interlocutor is speaking (or user language unknown due to Auto mode)
      direction = "interlocutor_to_user";
      sourceLanguage = detected;
      // If the user has an explicit language selected, translate into it; otherwise use the configured targetLanguage
      targetLanguage = explicitUserLang ?? store.targetLanguage;
      // Persist interlocutor language for the session so future user utterances are translated into it
      store.setDetectedLanguage(detected);
      // Do NOT overwrite user's configured targetLanguage here — keep user's preferences intact
    }

    store.setSpeakerDirection(direction);

    await store.transitionTo(ConversationState.TRANSLATING);
    const translateController = store.startOperation("translate");
    const translatedText = await this.providerFactory
      .getTranslation()
      .translate(recognized.text, sourceLanguage, targetLanguage, translateController.signal);
    store.completeOperation();
    this.assertFresh(operationId);

    store.setTranslatedText(translatedText);
    store.addMessage({
      originalText: recognized.text,
      originalLanguage: sourceLanguage,
      translatedText,
      targetLanguage,
      direction,
      operationId,
    });

    return { translatedText, targetLanguage };
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
          rate: this.config.speechRate,
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
    const normalizedMessage = message.toLowerCase();
    const code =
      normalizedMessage.includes("permission") ||
      normalizedMessage.includes("not-allowed") ||
      normalizedMessage.includes("denied")
        ? ConversationErrorCode.MICROPHONE_PERMISSION_DENIED
        : normalizedMessage.includes("timeout") || normalizedMessage.includes("timed out")
          ? ConversationErrorCode.TIMEOUT
          : normalizedMessage.includes("language") && normalizedMessage.includes("detect")
            ? ConversationErrorCode.LANGUAGE_DETECTION_FAILED
            : normalizedMessage.includes("speech") || normalizedMessage.includes("recogn")
              ? ConversationErrorCode.SPEECH_RECOGNITION_FAILED
              : normalizedMessage.includes("speak") || normalizedMessage.includes("playback")
                ? ConversationErrorCode.TEXT_TO_SPEECH_FAILED
                : normalizedMessage.includes("translation") || normalizedMessage.includes("translate")
                  ? ConversationErrorCode.TRANSLATION_FAILED
                  : ConversationErrorCode.UNKNOWN;

    store.setError(code, message, true, { originalError: message });
    await store.transitionTo(ConversationState.ERROR);
  }
}

export function createConversationEngine(config?: ConversationEngineConfig): ConversationEngine {
  return new ConversationEngine(config);
}
