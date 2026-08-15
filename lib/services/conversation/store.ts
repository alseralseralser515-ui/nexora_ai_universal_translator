/**
 * Conversation Zustand Store
 * 
 * Manages conversation state, session data, and provides actions
 * Integrates with the state machine for state transitions
 */

import { create } from 'zustand';
import { useMemo } from 'react';
import { createLocalId } from '@/lib/utils';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  type AppLocale,
} from '@/lib/config/languages';
import {
  ConversationState,
  ConversationStore,
  ConversationSession,
  ConversationMessage,
  ConversationErrorCode,
  ProviderMode,
  SpeakerDirection,
} from './types';
import { ConversationStateMachine } from './state-machine';
import type { ConversationOperation } from './types';

/**
 * Actions available in the store
 */
export interface ConversationStoreActions {
  // State transitions
  transitionTo: (state: ConversationState) => Promise<boolean>;
  
  // Session management
  createSession: (sourceLanguage: string, targetLanguage: string) => void;
  restoreSession: (session: ConversationSession) => void;
  endSession: () => void;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  
  // Language management
  setSourceLanguage: (language: string) => void;
  setTargetLanguage: (language: string) => void;
  setAutoDetectLanguage: (enabled: boolean) => void;
  setInterfaceLanguage: (language: AppLocale) => void;
  setDetectedLanguage: (language: string | null) => void;
  setRecognizedText: (text: string) => void;
  setTranslatedText: (text: string) => void;
  setSpeakerDirection: (direction: SpeakerDirection) => void;
  setActiveOperationId: (operationId: string | null) => void;
  setProviderMode: (mode: ProviderMode) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
  setPlaybackActive: (active: boolean) => void;
  setSpeechRate: (rate: number) => void;
  setAutoTtsPlayback: (enabled: boolean) => void;
  setTranslationStyle: (style: "natural" | "literal" | "formal") => void;
  setPhraseEndPauseMs: (duration: number) => void;
  setLocalHistorySaving: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  
  // Error handling
  setError: (code: ConversationErrorCode, message: string, recoverable: boolean, details?: Record<string, unknown>) => void;
  clearError: () => void;
  
  // Retry management
  incrementRetry: () => void;
  resetRetry: () => void;
  canRetry: () => boolean;
  
  // Operation management
  startOperation: (type: ConversationOperation['type']) => AbortController;
  completeOperation: () => void;
  cancelCurrentOperation: () => Promise<void>;
  
  // UI state
  setLoading: (loading: boolean) => void;
  
  // Session management
  reset: () => void;
}

export type ConversationStoreType = ConversationStore & ConversationStoreActions;

// Create state machine singleton
const stateMachine = new ConversationStateMachine({
  timeout: 30000,
  maxRetries: 3,
});

/**
 * Create the conversation store
 */
export const useConversationStore = create<ConversationStoreType>((set, get) => {
  // Subscribe to state machine changes
  stateMachine.subscribe((state) => {
    set({ state });
  });

  return {
    // Initial state
    state: ConversationState.IDLE,
    previousState: ConversationState.IDLE,
    session: null,
    currentOperation: null,
    error: null,
    sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    autoDetectLanguage: true,
    interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
    detectedLanguage: null,
    recognizedText: '',
    translatedText: '',
    speakerDirection: 'user_to_interlocutor',
    activeOperationId: null,
    providerMode: { speech: 'mock', textToSpeech: 'mock', translation: 'mock' },
    microphoneEnabled: false,
    playbackActive: false,
    isLoading: false,
    retryCount: 0,
    maxRetries: 3,
    speechRate: 0.95,
    autoTtsPlayback: true,
    translationStyle: "natural",
    phraseEndPauseMs: 1400,
    localHistorySaving: true,
    privacyMode: false,

    // State transitions
    transitionTo: async (newState: ConversationState) => {
      const success = await stateMachine.transitionTo(newState);
      if (success) {
        set(stateMachine.getSnapshot() as any);
      }
      return success;
    },

    // Session management
    createSession: (sourceLanguage: string, targetLanguage: string) => {
      const session: ConversationSession = {
        id: createLocalId('session'),
        startTime: Date.now(),
        messages: [],
        sourceLanguage,
        targetLanguage,
        isActive: true,
      };

      set({
        session,
        sourceLanguage,
        targetLanguage,
      });
    },

    restoreSession: (session: ConversationSession) => set({ session, sourceLanguage: session.sourceLanguage, targetLanguage: session.targetLanguage }),

    endSession: () => {
      const { session } = get();
      if (session) {
        set({ session: { ...session, isActive: false, endTime: Date.now() } });
      }
    },

    addMessage: (messageData: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
      const { session } = get();
      if (!session) return;

      const message: ConversationMessage = {
        ...messageData,
        id: createLocalId('session'),
        timestamp: Date.now(),
      };

      set({ session: { ...session, messages: [...session.messages, message] } });
    },

    clearMessages: () => {
      const { session } = get();
      if (session) {
        set({ session: { ...session, messages: [] } });
      }
    },

    // Language management
    setSourceLanguage: (language: string) => {
      set({ sourceLanguage: language });
    },

    setTargetLanguage: (language: string) => {
      set({ targetLanguage: language });
    },

    setAutoDetectLanguage: (enabled: boolean) => {
      set({ autoDetectLanguage: enabled });
    },

    setInterfaceLanguage: (language: AppLocale) => {
      set({ interfaceLanguage: language });
    },

    setDetectedLanguage: (language: string | null) => set({ detectedLanguage: language }),
    setRecognizedText: (text: string) => set({ recognizedText: text }),
    setTranslatedText: (text: string) => set({ translatedText: text }),
    setSpeakerDirection: (direction: SpeakerDirection) => set({ speakerDirection: direction }),
    setActiveOperationId: (operationId: string | null) => set({ activeOperationId: operationId }),
    setProviderMode: (mode: ProviderMode) => set({ providerMode: mode }),
    setMicrophoneEnabled: (enabled: boolean) => set({ microphoneEnabled: enabled }),
    setPlaybackActive: (active: boolean) => set({ playbackActive: active }),
    setSpeechRate: (rate: number) => set({ speechRate: Math.min(2, Math.max(0.5, rate)) }),
    setAutoTtsPlayback: (enabled: boolean) => set({ autoTtsPlayback: enabled }),
    setTranslationStyle: (style: "natural" | "literal" | "formal") => set({ translationStyle: style }),
    setPhraseEndPauseMs: (duration: number) => set({ phraseEndPauseMs: Math.min(5000, Math.max(0, duration)) }),
    setLocalHistorySaving: (enabled: boolean) => set({ localHistorySaving: enabled }),
    setPrivacyMode: (enabled: boolean) => set({ privacyMode: enabled }),

    // Error handling
    setError: (code: ConversationErrorCode, message: string, recoverable: boolean, details?: Record<string, unknown>) => {
      stateMachine.setError(code, message, recoverable, details);
      set({
        error: stateMachine.getError(),
      });
    },

    clearError: () => {
      stateMachine.clearError();
      set({ error: null });
    },

    // Retry management
    incrementRetry: () => {
      stateMachine.incrementRetry();
      set({ retryCount: stateMachine.getRetryCount() });
    },

    resetRetry: () => {
      stateMachine.resetRetry();
      set({ retryCount: 0 });
    },

    canRetry: () => {
      return stateMachine.canRetry();
    },

    // Operation management
    startOperation: (type: ConversationOperation['type']) => {
      const controller = stateMachine.startOperation(type);
      set({ currentOperation: stateMachine.getCurrentOperation() });
      return controller;
    },

    completeOperation: () => {
      stateMachine.completeOperation();
      set({ currentOperation: null });
    },

    cancelCurrentOperation: async () => {
      await stateMachine.cancelCurrentOperation();
      set({ currentOperation: null });
    },

    // UI state
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    // Reset
    reset: () => {
      stateMachine.reset();
      set({
        state: ConversationState.IDLE,
        previousState: ConversationState.IDLE,
        session: null,
        currentOperation: null,
        error: null,
        sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
        targetLanguage: DEFAULT_TARGET_LANGUAGE,
        autoDetectLanguage: true,
        interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
        detectedLanguage: null,
        recognizedText: '',
        translatedText: '',
        speakerDirection: 'user_to_interlocutor',
        activeOperationId: null,
        providerMode: { speech: 'mock', textToSpeech: 'mock', translation: 'mock' },
        microphoneEnabled: false,
        playbackActive: false,
        isLoading: false,
        retryCount: 0,
        speechRate: 0.95,
        autoTtsPlayback: true,
        translationStyle: "natural",
        phraseEndPauseMs: 1400,
        localHistorySaving: true,
        privacyMode: false,
      });
    },
  };
});

/**
 * Selector hooks for common store queries
 */
export const useConversationState = () => useConversationStore((state: ConversationStoreType) => state.state);
export const useConversationError = () => useConversationStore((state: ConversationStoreType) => state.error);
export const useConversationSession = () => useConversationStore((state: ConversationStoreType) => state.session);
export const useConversationLanguages = () => {
  const source = useConversationStore((state: ConversationStoreType) => state.sourceLanguage);
  const target = useConversationStore((state: ConversationStoreType) => state.targetLanguage);
  const autoDetect = useConversationStore((state: ConversationStoreType) => state.autoDetectLanguage);
  const interfaceLanguage = useConversationStore((state: ConversationStoreType) => state.interfaceLanguage);

  return useMemo(() => ({ source, target, autoDetect, interfaceLanguage }), [source, target, autoDetect, interfaceLanguage]);
};
export const useConversationTelemetry = () => {
  const detectedLanguage = useConversationStore((state: ConversationStoreType) => state.detectedLanguage);
  const recognizedText = useConversationStore((state: ConversationStoreType) => state.recognizedText);
  const translatedText = useConversationStore((state: ConversationStoreType) => state.translatedText);
  const speakerDirection = useConversationStore((state: ConversationStoreType) => state.speakerDirection);
  const activeOperationId = useConversationStore((state: ConversationStoreType) => state.activeOperationId);
  const providerMode = useConversationStore((state: ConversationStoreType) => state.providerMode);
  const microphoneEnabled = useConversationStore((state: ConversationStoreType) => state.microphoneEnabled);
  const playbackActive = useConversationStore((state: ConversationStoreType) => state.playbackActive);

  return useMemo(
    () => ({
      detectedLanguage,
      recognizedText,
      translatedText,
      speakerDirection,
      activeOperationId,
      providerMode,
      microphoneEnabled,
      playbackActive,
    }),
    [detectedLanguage, recognizedText, translatedText, speakerDirection, activeOperationId, providerMode, microphoneEnabled, playbackActive],
  );
};
