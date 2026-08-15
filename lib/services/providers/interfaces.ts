export interface SpeechRecognitionProvider {
  isAvailable(): boolean;
  requestPermissions?(): Promise<ProviderPermissionResult>;
  startListening(options: SpeechRecognitionOptions, signal?: AbortSignal): Promise<SpeechRecognitionResult>;
  stopListening(): Promise<void>;
  abortListening?(): Promise<void>;
  cleanup?(): void;
}

export interface LanguageDetectionProvider {
  detectLanguage(text: string, signal?: AbortSignal): Promise<string>;
}

export interface TranslationProvider {
  translate(text: string, sourceLanguage: string, targetLanguage: string, signal?: AbortSignal, options?: TranslationOptions): Promise<string>;
}

export interface TextToSpeechProvider {
  isAvailable(): boolean;
  speak(text: string, language: string, options?: TextToSpeechOptions, signal?: AbortSignal): Promise<void>;
  stop(): Promise<void>;
  repeatLast?(): Promise<void>;
}

export interface ProviderFactoryConfig {
  apiBaseUrl?: string;
  speechProvider?: "mock" | "native";
  textToSpeechProvider?: "mock" | "native";
  translationProvider?: "mock" | "backend";
  speechRate?: number;
  timeout?: number;
  retryAttempts?: number;
}

export interface TranslationOptions {
  style?: "natural" | "literal" | "formal";
}

export interface ProviderPermissionResult {
  granted: boolean;
  canAskAgain?: boolean;
  reason?: string;
}

export interface SpeechRecognitionOptions {
  locale: string;
  interimResults?: boolean;
  silenceTimeoutMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface SpeechRecognitionResult {
  text: string;
  locale: string;
  isFinal: boolean;
  interimText?: string;
  confidence?: number;
}

export interface TextToSpeechOptions {
  rate?: number;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}
