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
export const DEFAULT_SOURCE_LANGUAGE = "auto";
export const DEFAULT_TARGET_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "auto", nativeName: "Автовизначення", englishName: "Auto detect", locale: "uk-UA", supportsSpeech: true, supportsTts: false },
  { code: "uk", nativeName: "Українська", englishName: "Ukrainian", locale: "uk-UA", supportsSpeech: true, supportsTts: true },
  { code: "en", nativeName: "English", englishName: "English", locale: "en-US", supportsSpeech: true, supportsTts: true },
  { code: "ru", nativeName: "Русский", englishName: "Russian", locale: "ru-RU", supportsSpeech: true, supportsTts: true },
  { code: "pl", nativeName: "Polski", englishName: "Polish", locale: "pl-PL", supportsSpeech: true, supportsTts: true },
  { code: "de", nativeName: "Deutsch", englishName: "German", locale: "de-DE", supportsSpeech: true, supportsTts: true },
  { code: "fr", nativeName: "Francais", englishName: "French", locale: "fr-FR", supportsSpeech: true, supportsTts: true },
  { code: "es", nativeName: "Espanol", englishName: "Spanish", locale: "es-ES", supportsSpeech: true, supportsTts: true },
  { code: "it", nativeName: "Italiano", englishName: "Italian", locale: "it-IT", supportsSpeech: true, supportsTts: true },
  { code: "tr", nativeName: "Turkce", englishName: "Turkish", locale: "tr-TR", supportsSpeech: true, supportsTts: true },
];

export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.nativeName ?? code.toUpperCase();
}

export function isSupportedLanguage(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

export function getLanguageLocale(code: string): string {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.locale ?? code;
}

export function normalizeLanguageCode(localeOrCode: string): string {
  const lower = localeOrCode.toLowerCase();
  return SUPPORTED_LANGUAGES.find((language) => lower === language.code || lower.startsWith(`${language.code}-`))?.code ?? lower.slice(0, 2);
}
