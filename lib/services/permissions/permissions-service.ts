import { Platform } from "react-native";

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  reason?: string;
}

export class PermissionsService {
  async requestMicrophonePermission(): Promise<PermissionResult> {
    if (Platform.OS === "web") {
      return { granted: true, canAskAgain: true };
    }

    return {
      granted: true,
      canAskAgain: true,
      reason: "Native microphone permission is stubbed for the MVP mock provider.",
    };
  }
}

export const permissionsService = new PermissionsService();
