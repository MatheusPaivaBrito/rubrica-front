import { Component, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { AuthService, MfaChallenge } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { FeedbackService } from '../core/feedback.service';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { OneTimeCodeComponent } from '../components/one-time-code.component';
import { PasswordFieldComponent } from '../components/password-field.component';
import { TurnstileState, TurnstileWidgetComponent } from '../components/turnstile-widget.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, LanguagePickerComponent, OneTimeCodeComponent, PasswordFieldComponent, TurnstileWidgetComponent],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <a class="auth-logo-link" routerLink="/" [attr.aria-label]="i18n.text('backToHome')"><img class="auth-logo" src="icons/rubrica-brand/source/rubrica-lockup-primary.png" alt="Rubrica Signature" /></a>
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
          <a class="auth-action" routerLink="/register" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-person-plus"></i><span>{{ i18n.text('createAccount') }}</span></a>
        </div>
        <app-turnstile-widget class="login-turnstile" action="login" (tokenChange)="turnstileToken.set($event)" (stateChange)="verificationStateChanged($event)" />
        <a class="auth-home-link" routerLink="/"><i class="bi bi-arrow-left"></i>{{ i18n.text('backToHome') }}</a>
      }
    </section></main>
  `,
  styles: [`
    .auth-logo-link{display:block;width:max-content;margin:0 auto 1rem;line-height:0}
    .auth-logo{display:block;width:175px;height:70px;object-fit:contain;object-position:center}
    .auth-heading{margin-top:1.35rem}
    .auth-heading h1{margin-bottom:.55rem}
    .login-turnstile{display:block;margin:1rem 0 0}
    .auth-home-link{display:flex;align-items:center;justify-content:center;gap:.4rem;margin-top:1rem;color:#7f3440;font-size:.88rem;font-weight:700;text-decoration:none}
    .auth-home-link:hover{text-decoration:underline}
  `],
})
export class LoginPageComponent {
  @ViewChild(TurnstileWidgetComponent) turnstile?: TurnstileWidgetComponent;
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

  verificationStateChanged(state: TurnstileState): void {
    this.verificationLoading.set(state.loading);
    this.verificationRequired.set(state.required);
    this.verificationError.set(state.error);
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
    finally { if (!this.mfaTicket()) this.turnstile?.reset(); this.loading.set(false); }
  }

  completeMfa(code: string): void {
    this.code = code;
    void this.submit();
  }
}
