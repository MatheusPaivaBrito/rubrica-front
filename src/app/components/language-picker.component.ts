import { Component, inject } from '@angular/core';

import { countryFlag, SUPPORTED_LANGUAGES } from '../core/countries';
import { I18nService, Locale } from '../core/i18n.service';

@Component({
  selector: 'app-language-picker',
  standalone: true,
  template: `
    <details class="language-picker" #menu>
      <summary [attr.aria-label]="i18n.text('language')">
        <span class="language-flag" aria-hidden="true">{{ languageFlag() }}</span>
        <span>{{ languageName() }}</span>
        <i class="bi bi-chevron-down picker-chevron"></i>
      </summary>
      <div class="language-options" role="menu">
        @for (language of languages; track language.locale) {
          <button type="button" role="menuitem" [class.active]="i18n.locale() === language.locale" (click)="change(language.locale, menu)">
            <span class="language-option-label"><span class="language-flag" aria-hidden="true">{{ flag(language.countryCode) }}</span>{{ language.label }}</span>
            @if (i18n.locale() === language.locale) { <i class="bi bi-check2"></i> }
          </button>
        }
      </div>
    </details>
  `,
})
export class LanguagePickerComponent {
  readonly i18n = inject(I18nService);
  readonly languages = SUPPORTED_LANGUAGES;

  languageName(): string { return this.currentLanguage()?.label ?? 'English'; }
  languageFlag(): string { return this.flag(this.currentLanguage()?.countryCode ?? 'US'); }
  flag(countryCode: string): string { return countryFlag(countryCode); }
  change(locale: Locale, menu: HTMLDetailsElement): void { this.i18n.setLocale(locale); menu.removeAttribute('open'); }
  private currentLanguage() { return this.languages.find(language => language.locale === this.i18n.locale()); }
}
