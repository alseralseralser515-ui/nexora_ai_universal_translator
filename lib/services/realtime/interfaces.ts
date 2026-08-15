export type RealtimeParticipantId = string;
export type RealtimeSessionId = string;

export interface RealtimeParticipantProfile {
  id: RealtimeParticipantId;
  displayName?: string;
  preferredLanguage: string;
  spokenLanguage?: string;
  listeningLanguages: string[];
}

export interface RealtimeAudioFrame {
  participantId: RealtimeParticipantId;
  sessionId: RealtimeSessionId;
  timestamp: number;
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
}

export interface RealtimeTranscriptSegment {
  participantId: RealtimeParticipantId;
  sessionId: RealtimeSessionId;
  text: string;
  language: string;
  isFinal: boolean;
  startedAt: number;
  endedAt?: number;
}

export interface RealtimeTranslatedSegment extends RealtimeTranscriptSegment {
  targetLanguage: string;
  translatedText: string;
  listenerId?: RealtimeParticipantId;
}

export interface RealtimeVoiceVideoTransport {
  join(sessionId: RealtimeSessionId, participant: RealtimeParticipantProfile): Promise<void>;
  leave(): Promise<void>;
  publishAudio(frame: RealtimeAudioFrame): Promise<void>;
  subscribeToParticipant(participantId: RealtimeParticipantId): Promise<void>;
  unsubscribeFromParticipant(participantId: RealtimeParticipantId): Promise<void>;
}

export interface StreamingSpeechToTextProvider {
  start(sessionId: RealtimeSessionId, participant: RealtimeParticipantProfile): Promise<void>;
  pushAudio(frame: RealtimeAudioFrame): Promise<void>;
  stop(): Promise<void>;
}

export interface StreamingTranslationProvider {
  translateSegment(segment: RealtimeTranscriptSegment, targetLanguage: string): Promise<RealtimeTranslatedSegment>;
}

export interface StreamingTextToSpeechProvider {
  synthesize(segment: RealtimeTranslatedSegment): AsyncIterable<RealtimeAudioFrame>;
  stop(participantId?: RealtimeParticipantId): Promise<void>;
}

export interface TranslatedAudioRouter {
  route(segment: RealtimeTranslatedSegment, audio: AsyncIterable<RealtimeAudioFrame>): Promise<void>;
}

export interface RealtimeSubtitleSink {
  publish(segment: RealtimeTranslatedSegment): Promise<void>;
}
