import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { AuthService, MfaChallenge } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { FeedbackService } from '../core/feedback.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <div class="auth-language"><select [ngModel]="i18n.locale()" (ngModelChange)="i18n.setLocale($event)" aria-label="Language"><option value="pt-BR">Português</option><option value="en">English</option><option value="ja-JP">日本語</option></select></div>
      <p class="eyebrow">Rubrica</p><h1>{{ i18n.text('login') }}</h1>
      <p class="muted">{{ i18n.text('loginHelp') }}</p>
      <form class="form" (ngSubmit)="submit()" #form="ngForm">
        @if (!mfaTicket()) {
          <label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <label>{{ i18n.text('password') }} <input name="password" type="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        } @else {
          <label>{{ i18n.text('authenticatorCode') }} <input name="code" inputmode="numeric" [(ngModel)]="code" required autocomplete="one-time-code" /></label>
          <p class="muted">{{ i18n.text('authenticatorHelp') }}</p>
        }
        <button class="button" [disabled]="form.invalid || loading()">{{ loading() ? '…' : i18n.text('enter') }}</button>
      </form>
      <p><a routerLink="/forgot-password">{{ i18n.text('forgotPassword') }}</a> · <a routerLink="/register">{{ i18n.text('createAccount') }}</a></p>
    </section></main>
  `,
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly mfaTicket = signal('');
  code = '';

  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly feedback: FeedbackService, readonly i18n: I18nService) {}

  async submit(): Promise<void> {
    this.loading.set(true);
    try {
      if (this.mfaTicket()) {
        await this.auth.completeMfa(this.mfaTicket(), this.code);
      } else {
        const result = await this.auth.login(this.email, this.password);
        if ('mfa_required' in result) {
          this.mfaTicket.set((result as MfaChallenge).mfa_ticket);
          return;
        }
      }
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl || await this.auth.dashboardUrl());
    } catch { await this.feedback.error(this.i18n.text('invalidCredentials'), this.i18n.text('loginFailed')); }
    finally { this.loading.set(false); }
  }
}
