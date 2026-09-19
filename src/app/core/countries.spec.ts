import { countryFlag, SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from './countries';

describe('countryFlag', () => {
  it.each([['JP', '🇯🇵'], ['BR', '🇧🇷'], ['pt', '🇵🇹']])('renders %s as a flag', (code, flag) => {
    expect(countryFlag(code)).toBe(flag);
  });

  it('rejects incomplete and non-ISO-like values', () => {
    expect(countryFlag('J')).toBe('');
    expect(countryFlag('日本')).toBe('');
  });
});

describe('country catalog', () => {
  it('associates the four current languages with their market flags', () => {
    expect(SUPPORTED_LANGUAGES.map(language => [language.locale, countryFlag(language.countryCode)])).toEqual([
      ['en', '🇺🇸'],
      ['pt-BR', '🇧🇷'],
      ['es', '🇪🇸'],
      ['ja-JP', '🇯🇵'],
    ]);
  });

  it('already exposes Portugal as a supported account country', () => {
    expect(SUPPORTED_COUNTRIES.some(country => country.code === 'PT')).toBe(true);
  });
});
