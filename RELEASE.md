# NEXORA AI Universal Translator — native release workflow

The mobile client must never contain an OpenAI or other private API key. Development, preview, and production translation are routed through `EXPO_PUBLIC_API_BASE_URL`; the secure backend owns provider credentials. Mock mode is reserved for explicit automated tests or local provider-development work.

## Development builds

```sh
EXPO_PUBLIC_SPEECH_PROVIDER=native EXPO_PUBLIC_TTS_PROVIDER=native EXPO_PUBLIC_TRANSLATION_PROVIDER=backend eas build --profile development --platform ios
EXPO_PUBLIC_SPEECH_PROVIDER=native EXPO_PUBLIC_TTS_PROVIDER=native EXPO_PUBLIC_TRANSLATION_PROVIDER=backend eas build --profile development --platform android
```

## Installable Android preview APK

```sh
EXPO_PUBLIC_SPEECH_PROVIDER=native EXPO_PUBLIC_TTS_PROVIDER=native EXPO_PUBLIC_TRANSLATION_PROVIDER=backend eas build --profile preview --platform android
```

## Local device fallback

```sh
npx expo run:ios --device
npx expo run:android --device
```

iOS local builds require macOS, Xcode, CocoaPods, an attached device, and Apple signing. Android local builds require Android Studio/SDK, an attached device or emulator, and USB debugging for physical devices.

## Future store release

1. Replace the placeholder privacy and terms URLs with published legal pages.
2. Supply final App Store and Google Play screenshots, descriptions, support URL, privacy disclosures, and content ratings.
3. Configure Apple distribution signing and Google Play upload credentials in EAS.
4. Set the production backend URL and validate the complete voice cycle on physical iOS and Android devices.
5. Run `eas build --profile production --platform ios` and `eas build --profile production --platform android`.
6. Increment `ios.buildNumber` and `android.versionCode` for every submitted build.
7. Submit only after device QA; this repository does not perform store submission automatically.
