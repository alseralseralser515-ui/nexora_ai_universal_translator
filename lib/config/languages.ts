export type AppLocale = "uk" | "ru" | "en";

export interface SupportedLanguage {
  code: string;
  nativeName: string;
  englishName: string;
  locale: string;
  supportsSpeech: boolean;
  supportsTts: boolean;
}

export const DEFAULT_INTERFACE_LANGUAGE: AppLocale = "uk";
export const DEFAULT_SOURCE_LANGUAGE = "uk";
export const DEFAULT_TARGET_LANGUAGE = "en";

/**
 * The provider capability flags are intentionally data-driven. Adding a
 * provider-supported language only requires adding one record here; the
 * conversation engine and UI do not contain language-specific branches.
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "auto", nativeName: "Автовизначення", englishName: "Auto detect", locale: "uk-UA", supportsSpeech: true, supportsTts: false },
  { code: "uk", nativeName: "Українська", englishName: "Ukrainian", locale: "uk-UA", supportsSpeech: true, supportsTts: true },
  { code: "ru", nativeName: "Русский", englishName: "Russian", locale: "ru-RU", supportsSpeech: true, supportsTts: true },
  { code: "en", nativeName: "English", englishName: "English", locale: "en-US", supportsSpeech: true, supportsTts: true },
  { code: "de", nativeName: "Deutsch", englishName: "German", locale: "de-DE", supportsSpeech: true, supportsTts: true },
  { code: "pl", nativeName: "Polski", englishName: "Polish", locale: "pl-PL", supportsSpeech: true, supportsTts: true },
  { code: "fr", nativeName: "Français", englishName: "French", locale: "fr-FR", supportsSpeech: true, supportsTts: true },
  { code: "es", nativeName: "Español", englishName: "Spanish", locale: "es-ES", supportsSpeech: true, supportsTts: true },
  { code: "it", nativeName: "Italiano", englishName: "Italian", locale: "it-IT", supportsSpeech: true, supportsTts: true },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", locale: "pt-PT", supportsSpeech: true, supportsTts: true },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish", locale: "tr-TR", supportsSpeech: true, supportsTts: true },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", locale: "ar-SA", supportsSpeech: true, supportsTts: true },
  { code: "zh", nativeName: "中文", englishName: "Chinese", locale: "zh-CN", supportsSpeech: true, supportsTts: true },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", locale: "ja-JP", supportsSpeech: true, supportsTts: true },
  { code: "ko", nativeName: "한국어", englishName: "Korean", locale: "ko-KR", supportsSpeech: true, supportsTts: true },
];

export function getLanguage(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((language) => language.code === normalizeLanguageCode(code));
}

export function getLanguageName(code: string): string {
  return getLanguage(code)?.nativeName ?? code.toUpperCase();
}

export function isSupportedLanguage(code: string): boolean {
  return Boolean(getLanguage(code));
}

export function getLanguageLocale(code: string): string {
  return getLanguage(code)?.locale ?? code;
}

export function normalizeLanguageCode(localeOrCode: string): string {
  const lower = localeOrCode.trim().toLowerCase().replace("_", "-");
  const exact = SUPPORTED_LANGUAGES.find((language) => lower === language.code);
  if (exact) return exact.code;
  return SUPPORTED_LANGUAGES.find((language) => lower.startsWith(`${language.code}-`))?.code ?? lower.split("-")[0];
}
