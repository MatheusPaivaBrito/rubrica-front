import { Component, inject } from '@angular/core';

import { I18nService, Locale } from '../core/i18n.service';

@Component({
  selector: 'app-language-picker',
  standalone: true,
  template: `
    <details class="language-picker" #menu>
      <summary [attr.aria-label]="i18n.text('language')">
        <i class="bi bi-translate"></i>
        <span>{{ languageName() }}</span>
        <i class="bi bi-chevron-down picker-chevron"></i>
      </summary>
      <div class="language-options" role="menu">
        @for (language of languages; track language.locale) {
          <button type="button" role="menuitem" [class.active]="i18n.locale() === language.locale" (click)="change(language.locale, menu)">
            <span>{{ language.label }}</span>
            @if (i18n.locale() === language.locale) { <i class="bi bi-check2"></i> }
          </button>
        }
      </div>
    </details>
  `,
})
export class LanguagePickerComponent {
  readonly i18n = inject(I18nService);
  readonly languages: readonly { locale: Locale; label: string }[] = [
    { locale: 'pt-BR', label: 'Português' },
    { locale: 'en', label: 'English' },
    { locale: 'es', label: 'Español' },
    { locale: 'ja-JP', label: '日本語' },
  ];

  languageName(): string { return this.languages.find(language => language.locale === this.i18n.locale())?.label ?? 'Português'; }
  change(locale: Locale, menu: HTMLDetailsElement): void { this.i18n.setLocale(locale); menu.removeAttribute('open'); }
}
