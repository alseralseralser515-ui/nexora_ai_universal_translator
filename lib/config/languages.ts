export type AppLocale = "uk" | "ru" | "en";

export interface SupportedLanguage {
  code: string;
  names: Record<AppLocale, string>;
  locale: string;
  supportsSpeech: boolean;
  supportsTts: boolean;
}

export const DEFAULT_INTERFACE_LANGUAGE: AppLocale = "uk";
export const DEFAULT_SOURCE_LANGUAGE = "auto";
export const DEFAULT_TARGET_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "auto", names: { uk: "Автовизначення", ru: "Автоопределение", en: "Auto Detect" }, locale: "uk-UA", supportsSpeech: true, supportsTts: false },
  { code: "uk", names: { uk: "Українська", ru: "Украинский", en: "Ukrainian" }, locale: "uk-UA", supportsSpeech: true, supportsTts: true },
  { code: "ru", names: { uk: "Російська", ru: "Русский", en: "Russian" }, locale: "ru-RU", supportsSpeech: true, supportsTts: true },
  { code: "en", names: { uk: "Англійська", ru: "Английский", en: "English" }, locale: "en-US", supportsSpeech: true, supportsTts: true },
  { code: "pl", names: { uk: "Польська", ru: "Польский", en: "Polish" }, locale: "pl-PL", supportsSpeech: true, supportsTts: true },
  { code: "de", names: { uk: "Німецька", ru: "Немецкий", en: "German" }, locale: "de-DE", supportsSpeech: true, supportsTts: true },
  { code: "fr", names: { uk: "Французька", ru: "Французский", en: "French" }, locale: "fr-FR", supportsSpeech: true, supportsTts: true },
  { code: "es", names: { uk: "Іспанська", ru: "Испанский", en: "Spanish" }, locale: "es-ES", supportsSpeech: true, supportsTts: true },
  { code: "it", names: { uk: "Італійська", ru: "Итальянский", en: "Italian" }, locale: "it-IT", supportsSpeech: true, supportsTts: true },
  { code: "tr", names: { uk: "Турецька", ru: "Турецкий", en: "Turkish" }, locale: "tr-TR", supportsSpeech: true, supportsTts: true },
];

export function getLanguageName(code: string, interfaceLanguage: AppLocale = DEFAULT_INTERFACE_LANGUAGE): string {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.names[interfaceLanguage] ?? code.toUpperCase();
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
