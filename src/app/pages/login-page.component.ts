import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { AuthService, MfaChallenge } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { FeedbackService } from '../core/feedback.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, LanguagePickerComponent],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <div class="auth-language"><app-language-picker /></div>
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
      <div class="auth-actions">
        <a class="auth-action" routerLink="/forgot-password" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-key"></i><span>{{ i18n.text('forgotPassword') }}</span></a>
        <a class="auth-action primary" routerLink="/register" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-person-plus"></i><span>{{ i18n.text('createAccount') }}</span><i class="bi bi-arrow-right"></i></a>
      </div>
    </section></main>
  `,
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly mfaTicket = signal('');
  code = '';
  readonly returnUrl: string | null;

  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly feedback: FeedbackService, readonly i18n: I18nService) {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = candidate?.startsWith('/signing/') ? candidate : null;
  }

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
      await this.router.navigateByUrl(this.returnUrl || await this.auth.dashboardUrl());
    } catch { await this.feedback.error(this.i18n.text('invalidCredentials'), this.i18n.text('loginFailed')); }
    finally { this.loading.set(false); }
  }
}
