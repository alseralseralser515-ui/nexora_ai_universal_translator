export enum ConversationState {
  IDLE = "idle",
  REQUESTING_PERMISSION = "requesting_permission",
  LISTENING = "listening",
  RECOGNIZING = "recognizing",
  DETECTING_LANGUAGE = "detecting_language",
  TRANSLATING = "translating",
  SPEAKING = "speaking",
  PAUSED = "paused",
  RETRYING = "retrying",
  ERROR = "error",
  STOPPED = "stopped",
}

export enum ConversationErrorCode {
  MICROPHONE_PERMISSION_DENIED = "microphone_permission_denied",
  SPEECH_RECOGNITION_FAILED = "speech_recognition_failed",
  LANGUAGE_DETECTION_FAILED = "language_detection_failed",
  TRANSLATION_FAILED = "translation_failed",
  TEXT_TO_SPEECH_FAILED = "text_to_speech_failed",
  TIMEOUT = "timeout",
  UNKNOWN = "unknown",
}

export type ConversationOperationType = "permission" | "listen" | "detect" | "translate" | "speak";

export interface ConversationOperation {
  id: string;
  type: ConversationOperationType;
  startTime: number;
  controller: AbortController;
  timeout?: NodeJS.Timeout;
}

export interface ConversationError {
  code: ConversationErrorCode;
  message: string;
  timestamp: number;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  timestamp: number;
  originalText: string;
  originalLanguage: string;
  translatedText: string;
  targetLanguage: string;
  direction: SpeakerDirection;
  operationId: string;
}

export interface ConversationSession {
  id: string;
  startTime: number;
  endTime?: number;
  messages: ConversationMessage[];
  sourceLanguage: string;
  targetLanguage: string;
  isActive: boolean;
}

export interface ConversationStore {
  state: ConversationState;
  previousState: ConversationState;
  session: ConversationSession | null;
  currentOperation: ConversationOperation | null;
  error: ConversationError | null;
  sourceLanguage: string;
  targetLanguage: string;
  autoDetectLanguage: boolean;
  interfaceLanguage: "uk" | "ru" | "en";
  detectedLanguage: string | null;
  recognizedText: string;
  translatedText: string;
  speakerDirection: SpeakerDirection;
  activeOperationId: string | null;
  providerMode: ProviderMode;
  microphoneEnabled: boolean;
  playbackActive: boolean;
  isLoading: boolean;
  retryCount: number;
  maxRetries: number;
}

export type SpeakerDirection = "user_to_interlocutor" | "interlocutor_to_user";

export interface ProviderMode {
  speech: "mock" | "native";
  textToSpeech: "mock" | "native";
  translation: "mock" | "backend";
}

export const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.IDLE]: [
    ConversationState.REQUESTING_PERMISSION,
    ConversationState.LISTENING,
    ConversationState.STOPPED,
    ConversationState.ERROR,
  ],
  [ConversationState.REQUESTING_PERMISSION]: [ConversationState.LISTENING, ConversationState.ERROR, ConversationState.IDLE],
  [ConversationState.LISTENING]: [
    ConversationState.RECOGNIZING,
    ConversationState.PAUSED,
    ConversationState.STOPPED,
    ConversationState.ERROR,
  ],
  [ConversationState.RECOGNIZING]: [
    ConversationState.DETECTING_LANGUAGE,
    ConversationState.PAUSED,
    ConversationState.STOPPED,
    ConversationState.ERROR,
  ],
  [ConversationState.DETECTING_LANGUAGE]: [ConversationState.TRANSLATING, ConversationState.PAUSED, ConversationState.STOPPED, ConversationState.ERROR],
  [ConversationState.TRANSLATING]: [ConversationState.SPEAKING, ConversationState.PAUSED, ConversationState.STOPPED, ConversationState.ERROR],
  [ConversationState.SPEAKING]: [ConversationState.LISTENING, ConversationState.PAUSED, ConversationState.IDLE, ConversationState.STOPPED, ConversationState.ERROR],
  [ConversationState.PAUSED]: [ConversationState.LISTENING, ConversationState.STOPPED, ConversationState.IDLE],
  [ConversationState.RETRYING]: [ConversationState.REQUESTING_PERMISSION, ConversationState.LISTENING, ConversationState.IDLE, ConversationState.ERROR],
  [ConversationState.ERROR]: [ConversationState.RETRYING, ConversationState.IDLE, ConversationState.STOPPED],
  [ConversationState.STOPPED]: [ConversationState.IDLE],
};

export function isValidTransition(from: ConversationState, to: ConversationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
