/**
 * @file i18n/index.ts
 * @description Extension-host i18n helper.
 *
 * To add a new language:
 *   1. Create `src/i18n/locales/<lang>.json` with all keys from `en.json`.
 *   2. Import it below and add to the `locales` map.
 *   3. The new locale is automatically sent to the webview on `init`.
 */

import en from './locales/en.json';
import zh from './locales/zh.json';

type Locale = Record<string, string>;

const locales: Record<string, Locale> = { en, zh };

/**
 * Returns the locale object for the given language code,
 * falling back to English when the code is unknown.
 */
export function getLocale(lang: string): Locale {
  return locales[lang] ?? locales.en;
}

/**
 * Translates a key with optional positional placeholders (`{0}`, `{1}`, …).
 * Falls back to English when the key is missing in the requested locale.
 */
export function t(lang: string, key: string, ...args: string[]): string {
  const locale = getLocale(lang);
  let str = (locale[key] ?? en[key as keyof typeof en] ?? key) as string;
  args.forEach((arg, i) => {
    str = str.replace(`{${i}}`, arg);
  });
  return str;
}

/**
 * Returns all locale dictionaries for embedding in the webview `init` payload.
 * The webview's `i18n.js` uses this data to translate the UI.
 */
export function getAllLocales(): Record<string, Locale> {
  return locales;
}
