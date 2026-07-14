export type AudioSessionMode = "idle" | "recording" | "playback";

export class AudioSessionManager {
  private mode: AudioSessionMode = "idle";
  private microphoneEnabled = false;

  getMode(): AudioSessionMode {
    return this.mode;
  }

  async prepareForRecording(): Promise<void> {
    this.mode = "recording";
    this.microphoneEnabled = true;
  }

  async prepareForPlayback(): Promise<void> {
    this.mode = "playback";
    this.microphoneEnabled = false;
  }

  async reset(): Promise<void> {
    this.mode = "idle";
    this.microphoneEnabled = false;
  }

  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }
}

export const audioSessionManager = new AudioSessionManager();
