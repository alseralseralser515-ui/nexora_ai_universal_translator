import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES, getLanguageLocale, normalizeLanguageCode } from "../lib/config/languages";
import { resolveTranslationDirection } from "../lib/services/conversation/engine";

describe("configured languages", () => {
  it("includes the required baseline languages", () => {
    const required = ["uk", "ru", "en", "de", "pl", "fr", "es", "it", "pt", "tr", "ar", "zh", "ja", "ko"];
    expect(required.every((code) => SUPPORTED_LANGUAGES.some((language) => language.code === code))).toBe(true);
  });

  it("normalizes provider locales without changing configured language state", () => {
    expect(normalizeLanguageCode("ru-RU")).toBe("ru");
    expect(normalizeLanguageCode("zh_CN")).toBe("zh");
    expect(getLanguageLocale("ja")).toBe("ja-JP");
  });
});

describe("two-way direction", () => {
  it.each([
    ["ru-RU", "ru", "en", "user_to_interlocutor", "ru", "en"],
    ["en-US", "ru", "en", "interlocutor_to_user", "en", "ru"],
    ["de-DE", "de", "pl", "user_to_interlocutor", "de", "pl"],
    ["pl-PL", "de", "pl", "interlocutor_to_user", "pl", "de"],
  ])("resolves %s in a %s/%s conversation", (detected, user, interlocutor, direction, source, target) => {
    expect(resolveTranslationDirection(detected, user, interlocutor)).toEqual({ direction, sourceLanguage: source, targetLanguage: target });
  });
});
