type Listener = (...args: never[]) => void;

export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: () => false,
  requestPermissionsAsync: async () => ({ granted: false, canAskAgain: true, status: "denied" }),
  start: () => undefined,
  stop: () => undefined,
  abort: () => undefined,
  addListener: (_event: string, _listener: Listener) => ({ remove: () => undefined }),
};
