import type { Locale, MessageKey } from './i18n.service';

export interface CountryOption {
  readonly code: string;
  readonly nameKey: MessageKey;
}

export interface LanguageOption {
  readonly locale: Locale;
  readonly label: string;
  readonly countryCode: string;
}

// This is the single list used by account and identity country selectors.
// Add a country here once its billing and legal rules are supported by Rubrica.
export const SUPPORTED_COUNTRIES: readonly CountryOption[] = [
  { code: 'US', nameKey: 'unitedStates' },
  { code: 'BR', nameKey: 'brazil' },
  { code: 'ES', nameKey: 'spain' },
  { code: 'JP', nameKey: 'japan' },
  { code: 'PT', nameKey: 'portugal' },
];

// A language has a presentation flag, while the account country remains an
// independent choice. Portugal can later receive pt-PT without changing BR.
export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { locale: 'en', label: 'English', countryCode: 'US' },
  { locale: 'pt-BR', label: 'Português', countryCode: 'BR' },
  { locale: 'es', label: 'Español', countryCode: 'ES' },
  { locale: 'ja-JP', label: '日本語', countryCode: 'JP' },
];

export function countryFlag(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return [...code].map(character => String.fromCodePoint(127397 + character.charCodeAt(0))).join('');
}
