import { TestBed } from '@angular/core/testing';

import { I18nService, Locale, MessageKey } from './i18n.service';

describe('I18nService', () => {
  const representativeKeys: MessageKey[] = ['login', 'billing', 'security', 'signDocument', 'genericErrorTitle'];

  it('resolves the main product areas in every supported locale', () => {
    const service = TestBed.inject(I18nService);
    for (const locale of ['pt-BR', 'en', 'ja-JP'] satisfies Locale[]) {
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
