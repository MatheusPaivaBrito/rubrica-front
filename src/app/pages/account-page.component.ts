import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, MessageKey } from '../core/i18n.service';

interface IdentityOption { value: string; label: MessageKey }

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-layout account-layout"><section class="card auth-card account-card">
      <header class="account-heading">
        <a class="account-brand" routerLink="/"><img src="icons/rubrica-mark.png" alt="" /><span>Rubrica</span></a>
        <div class="auth-language"><label class="sr-only" for="account-language">{{ i18n.text('language') }}</label><select id="account-language" [ngModel]="i18n.locale()" (ngModelChange)="i18n.setLocale($event)" [attr.aria-label]="i18n.text('language')"><option value="pt-BR">Português</option><option value="en">English</option><option value="ja-JP">日本語</option></select></div>
      </header>
      <div class="account-title"><p class="eyebrow">Acesso seguro</p><h1>{{ i18n.text(titleKey) }}</h1>@if (mode === 'register') { <p class="muted">Comece com 5 assinaturas gratuitas. Nenhum cartão é necessário.</p> }</div>
      @if (mode === 'register') {
        <form class="form" (ngSubmit)="register()">
          <label>{{ i18n.text('name') }} <input name="name" [(ngModel)]="name" required autocomplete="name" /></label>
          <label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <label>{{ i18n.text('password') }} <input name="password" type="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password" /></label>
          <fieldset class="form identity-fieldset"><legend>{{ i18n.text('optionalIdentity') }}</legend><p class="field-help">Você pode informar o documento agora ou completar seu perfil depois.</p>
            <label>{{ i18n.text('documentCountry') }} <input name="country" [(ngModel)]="country" (ngModelChange)="countryChanged()" list="country-options" maxlength="2" placeholder="BR, JP, PT…" autocomplete="country" /></label>
            <datalist id="country-options"><option value="BR">Brasil</option><option value="JP">日本</option><option value="PT">Portugal</option><option value="US">United States</option></datalist>
            @if (country) {
              <label>{{ i18n.text('documentType') }} <select name="type" [(ngModel)]="documentType">@for (option of documentOptions(); track option.value) { <option [value]="option.value">{{ i18n.text(option.label) }}</option> }</select></label>
              <label>{{ i18n.text('documentNumber') }} <input name="document" [(ngModel)]="documentValue" minlength="4" maxlength="80" required autocomplete="off" /></label>
            }
          </fieldset>
          <button class="button">{{ i18n.text('createAccount') }}</button>
        </form>
      } @else if (mode === 'forgot-password') {
        <form class="form" (ngSubmit)="requestReset()"><label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required /></label><button class="button">{{ i18n.text('sendRecovery') }}</button></form>
      } @else if (mode === 'reset-password') {
        <form class="form" (ngSubmit)="resetPassword()"><label>{{ i18n.text('newPassword') }} <input name="password" type="password" [(ngModel)]="password" minlength="8" required /></label><button class="button">{{ i18n.text('changePassword') }}</button></form>
      } @else { <p>{{ i18n.text('verifyingEmail') }}</p> }
      <p class="account-back"><a routerLink="/login"><i class="bi bi-arrow-left"></i> {{ i18n.text('backToLogin') }}</a></p>
    </section></main>
  `,
})
export class AccountPageComponent implements OnInit {
  titleKey: MessageKey = 'account';
  mode = '';
  name = ''; email = ''; password = ''; country = ''; documentType = 'PASSPORT'; documentValue = '';
  private token = '';

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly api: ApiService, private readonly feedback: FeedbackService, readonly i18n: I18nService) {}

  async ngOnInit(): Promise<void> {
    this.mode = this.route.snapshot.routeConfig?.path ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    const titleKeys: Record<string, MessageKey> = { register: 'createAccount', 'forgot-password': 'recovery', 'reset-password': 'newPassword', 'verify-email': 'verifyEmail' };
    this.titleKey = titleKeys[this.mode] ?? 'account';
    if (this.mode === 'verify-email') await this.action('/auth/verify-email', { token: this.token }, this.i18n.text('emailVerified'));
  }

  documentOptions(): IdentityOption[] {
    if (this.country === 'BR') return [{ value: 'BR_CPF', label: 'cpf' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'PT') return [{ value: 'PT_NIF', label: 'nif' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'JP') return [{ value: 'PASSPORT', label: 'passport' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'OTHER', label: 'other' }];
    return [{ value: 'PASSPORT', label: 'passport' }, { value: 'NATIONAL_ID', label: 'nationalId' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'TAX_ID', label: 'taxId' }, { value: 'OTHER', label: 'other' }];
  }

  countryChanged(): void { this.country = this.country.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); this.documentType = this.documentOptions()[0]?.value ?? 'PASSPORT'; this.documentValue = ''; }
  async register(): Promise<void> { const accepted = await this.action('/auth/register', { name: this.name, email: this.email, password: this.password, preferred_locale: this.i18n.locale(), identity_document_type: this.country ? this.documentType : null, identity_document_country: this.country || null, identity_document_value: this.country ? this.documentValue : null }, this.i18n.text('registrationSent')); if (accepted) await this.router.navigate(['/']); }
  requestReset() { return this.action('/auth/password-recovery', { email: this.email }, this.i18n.text('recoverySent')); }
  resetPassword() { return this.action('/auth/password-reset', { token: this.token, new_password: this.password }, this.i18n.text('passwordChanged')); }
  private async action(path: string, body: unknown, message: string): Promise<boolean> {
    try { await firstValueFrom(this.api.post(path, body)); await this.feedback.success(message); return true; }
    catch { await this.feedback.error(this.i18n.text('reviewData')); return false; }
  }
}
