import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { SUPPORTED_LANGUAGES } from '../core/countries';
import { I18nService, Locale } from '../core/i18n.service';

@Component({
  selector: 'app-language-picker',
  standalone: true,
  template: `
    <details class="language-picker" #menu>
      <summary [attr.aria-label]="i18n.text('language')">
        <img class="language-flag" [src]="flagAsset(currentLanguage()?.countryCode)" alt="" />
        <span>{{ languageName() }}</span>
        <i class="bi bi-chevron-down picker-chevron"></i>
      </summary>
      <div class="language-options" role="menu">
        @for (language of languages; track language.locale) {
          <button type="button" role="menuitem" [class.active]="activeLocale() === language.locale" (click)="change(language.locale, menu)">
            <span class="language-option-label"><img class="language-flag" [src]="flagAsset(language.countryCode)" alt="" />{{ language.label }}</span>
            @if (activeLocale() === language.locale) { <i class="bi bi-check2"></i> }
          </button>
        }
      </div>
    </details>
  `,
})
export class LanguagePickerComponent {
  @Input() value?: Locale;
  @Output() readonly valueChange = new EventEmitter<Locale>();
  readonly i18n = inject(I18nService);
  readonly languages = SUPPORTED_LANGUAGES;

  languageName(): string { return this.currentLanguage()?.label ?? 'English'; }
  activeLocale(): Locale { return this.value ?? this.i18n.locale(); }
  flagAsset(countryCode = 'US'): string { return `icons/flags/${countryCode.toLowerCase()}.svg`; }
  change(locale: Locale, menu: HTMLDetailsElement): void { if (this.value === undefined) this.i18n.setLocale(locale); else this.valueChange.emit(locale); menu.removeAttribute('open'); }
  currentLanguage() { return this.languages.find(language => language.locale === this.activeLocale()); }
}
