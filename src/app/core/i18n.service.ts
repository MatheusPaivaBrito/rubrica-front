import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Locale = 'pt-BR' | 'en' | 'ja-JP';

const messages = {
  'pt-BR': { login: 'Entre para assinar', email: 'E-mail', password: 'Senha', enter: 'Entrar' },
  en: { login: 'Sign in to sign', email: 'Email', password: 'Password', enter: 'Sign in' },
  'ja-JP': { login: '署名するためにログイン', email: 'メール', password: 'パスワード', enter: 'ログイン' },
} as const;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly locale = signal<Locale>(this.initialLocale());

  text(key: keyof typeof messages.en): string { return messages[this.locale()][key]; }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    if (this.browser) localStorage.setItem('rubrica_locale', locale);
  }

  private initialLocale(): Locale {
    if (!this.browser) return 'en';
    const stored = localStorage.getItem('rubrica_locale');
    if (stored === 'pt-BR' || stored === 'en' || stored === 'ja-JP') return stored;
    const language = navigator.language.toLowerCase();
    if (language.startsWith('pt')) return 'pt-BR';
    if (language.startsWith('ja')) return 'ja-JP';
    return 'en';
  }
}
