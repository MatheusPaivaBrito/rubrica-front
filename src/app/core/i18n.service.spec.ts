import { TestBed } from '@angular/core/testing';

import { I18nService, Locale, MessageKey, resolvePreferredLocale } from './i18n.service';

describe('I18nService', () => {
  const representativeKeys: MessageKey[] = ['login', 'billing', 'security', 'signDocument', 'genericErrorTitle'];

  it('resolves the main product areas in every supported locale', () => {
    const service = TestBed.inject(I18nService);
    for (const locale of ['pt-BR', 'en', 'es', 'ja-JP'] satisfies Locale[]) {
      service.setLocale(locale);
      for (const key of representativeKeys) expect(service.text(key)).toBeTruthy();
    }
  });

  it('interpolates variables', () => {
    const service = TestBed.inject(I18nService);
    service.setLocale('en');
    expect(service.text('hello', { name: 'Aiko' })).toContain('Aiko');
  });
});


describe('resolvePreferredLocale', () => {
  it.each([
    [null, ['pt-BR'], 'pt-BR'],
    [null, ['en-US'], 'en'],
    [null, ['es-ES'], 'es'],
    [null, ['ja-JP'], 'ja-JP'],
    [null, ['fr-FR', 'ja-JP'], 'ja-JP'],
    [null, ['fr-FR'], 'en'],
  ] as const)('maps browser languages without inferring country', (stored, languages, expected) => {
    expect(resolvePreferredLocale(stored, languages)).toBe(expected);
  });

  it('keeps the explicit stored choice ahead of browser preferences', () => {
    expect(resolvePreferredLocale('es', ['ja-JP'])).toBe('es');
  });
});
