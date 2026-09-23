import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService, MfaChallenge } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { FeedbackService } from '../core/feedback.service';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { OneTimeCodeComponent } from '../components/one-time-code.component';
import { PasswordFieldComponent } from '../components/password-field.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, LanguagePickerComponent, OneTimeCodeComponent, PasswordFieldComponent],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <img class="auth-logo" src="icons/rubrica-brand/source/rubrica-lockup-primary.png" alt="Rubrica Signature" />
      <div class="auth-language"><app-language-picker /></div>
      <div class="auth-heading"><h1>{{ i18n.text('login') }}</h1>
      <p class="muted">{{ i18n.text('loginHelp') }}</p></div>
      <form class="form" (ngSubmit)="submit()" #form="ngForm">
        @if (!mfaTicket()) {
          <label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <app-password-field name="password" [(ngModel)]="password" [label]="i18n.text('password')" autocomplete="current-password" required />
        } @else {
          <span class="field-label">{{ i18n.text('authenticatorCode') }}</span>
          <app-one-time-code [(value)]="code" [label]="i18n.text('authenticatorCode')" (completed)="completeMfa($event)" />
          <p class="muted">{{ i18n.text('authenticatorHelp') }}</p>
        }
        <button class="button" [disabled]="loading() || (mfaTicket() ? code.length !== 6 : form.invalid || verificationLoading() || verificationError() || (verificationRequired() && !turnstileToken()))">{{ loading() ? '…' : i18n.text(mfaTicket() ? 'confirmAuthenticatorCode' : 'enter') }}</button>
      </form>
      @if (!mfaTicket()) {
        <div class="auth-actions">
          <a class="auth-action" routerLink="/forgot-password" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-key"></i><span>{{ i18n.text('forgotPassword') }}</span></a>
          <a class="auth-action primary" routerLink="/register" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-person-plus"></i><span>{{ i18n.text('createAccount') }}</span><i class="bi bi-arrow-right"></i></a>
        </div>
        <div #turnstileContainer class="login-turnstile"></div>
        @if (verificationError()) { <div class="notice warning" role="alert">{{ i18n.text('serviceUnavailable') }} <button type="button" class="button secondary compact" (click)="retryVerification()">{{ i18n.text('retryVerification') }}</button></div> }
      }
    </section></main>
  `,
  styles: [`
    .auth-logo{display:block;width:175px;height:70px;margin:0 auto 1rem;object-fit:contain;object-position:center}
    .auth-heading{margin-top:1.35rem}
    .auth-heading h1{margin-bottom:.55rem}
    .login-turnstile{display:flex;width:100%;min-height:0;margin:1rem 0 0;justify-content:center}
  `],
})
export class LoginPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('turnstileContainer') turnstileContainer?: ElementRef<HTMLElement>;
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private widgetId?: string;
  private destroyed = false;
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly mfaTicket = signal('');
  readonly verificationLoading = signal(true);
  readonly verificationRequired = signal(false);
  readonly verificationError = signal(false);
  readonly turnstileToken = signal('');
  code = '';
  readonly returnUrl: string | null;

  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly feedback: FeedbackService, readonly i18n: I18nService) {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = candidate?.startsWith('/signing/') ? candidate : null;
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.browser) return;
    try {
      const config = await firstValueFrom(this.http.get<{ site_key: string; required: boolean }>('/auth/turnstile/config'));
      if (this.destroyed) return;
      this.verificationRequired.set(config.required);
      if (config.required && !config.site_key) throw new Error('Turnstile is not configured');
      if (config.site_key) this.renderTurnstile(config.site_key);
      else this.verificationLoading.set(false);
    } catch {
      if (!this.destroyed) { this.verificationError.set(true); this.verificationLoading.set(false); }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) (window as TurnstileWindow).turnstile?.remove(this.widgetId);
  }

  private renderTurnstile(siteKey: string): void {
    const render = () => {
      if (this.destroyed || !this.turnstileContainer || !(window as TurnstileWindow).turnstile) return;
      this.widgetId = (window as TurnstileWindow).turnstile!.render(this.turnstileContainer.nativeElement, {
        sitekey: siteKey,
        action: 'login',
        theme: 'light',
        appearance: 'interaction-only',
        size: 'flexible',
        callback: token => this.zone.run(() => this.turnstileToken.set(token)),
        'expired-callback': () => this.zone.run(() => this.turnstileToken.set('')),
        'error-callback': () => this.zone.run(() => { this.turnstileToken.set(''); this.verificationError.set(true); }),
      });
      this.verificationLoading.set(false);
    };
    if ((window as TurnstileWindow).turnstile) { render(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', render, { once: true });
    script.addEventListener('error', () => { script.remove(); this.verificationError.set(true); this.verificationLoading.set(false); }, { once: true });
    if (!existing) { script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.appendChild(script); }
  }

  private resetTurnstile(): void {
    this.turnstileToken.set('');
    if (this.widgetId && this.turnstileContainer) (window as TurnstileWindow).turnstile?.reset(this.widgetId);
  }

  retryVerification(): void {
    this.verificationError.set(false);
    this.turnstileToken.set('');
    if (this.widgetId) (window as TurnstileWindow).turnstile?.reset(this.widgetId);
    else { this.verificationLoading.set(true); void this.ngAfterViewInit(); }
  }

  async submit(): Promise<void> {
    if (this.loading() || (this.mfaTicket() ? this.code.length !== 6 : this.verificationLoading() || this.verificationError() || (this.verificationRequired() && !this.turnstileToken()))) return;
    this.loading.set(true);
    try {
      if (this.mfaTicket()) {
        await this.auth.completeMfa(this.mfaTicket(), this.code);
      } else {
        const result = await this.auth.login(this.email, this.password, this.turnstileToken());
        if ('mfa_required' in result) {
          this.mfaTicket.set((result as MfaChallenge).mfa_ticket);
          return;
        }
      }
      if (this.auth.context()?.mfa_setup_required) {
        await this.router.navigate(['/security'], { queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : {} });
        return;
      }
      await this.router.navigateByUrl(this.returnUrl || await this.auth.dashboardUrl());
    } catch (error) { await this.feedback.error(error, this.i18n.text('loginFailed')); }
    finally { if (!this.mfaTicket()) this.resetTurnstile(); this.loading.set(false); }
  }

  completeMfa(code: string): void {
    this.code = code;
    void this.submit();
  }
}

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (element: HTMLElement, options: { sitekey: string; action: string; theme: 'light'; appearance: 'interaction-only'; size: 'flexible'; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
  };
}
