import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, MessageKey } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { countryFlag, SUPPORTED_COUNTRIES } from '../core/countries';

interface IdentityOption { value: string; label: MessageKey }

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, LanguagePickerComponent],
  template: `
    <main class="login-layout account-layout"><section class="card auth-card account-card">
      <header class="account-heading">
        <a class="account-brand" routerLink="/"><img src="icons/rubrica-mark.png" alt="" /><span>Rubrica</span></a>
        <app-language-picker />
      </header>
      <div class="account-title"><p class="eyebrow">{{ i18n.text('secureAccess') }}</p><h1>{{ i18n.text(titleKey) }}</h1>@if (mode === 'register') { <p class="muted">{{ i18n.text('registerHelp') }}</p> }</div>
      @if (mode === 'register') {
        <form class="form" (ngSubmit)="register()">
          <label>{{ i18n.text('name') }} <input name="name" [(ngModel)]="name" required autocomplete="name" /></label>
          <label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <fieldset class="form identity-fieldset"><legend>{{ i18n.text('optionalIdentity') }}</legend><p class="field-help">{{ i18n.text('identityLater') }}</p>
            <label>{{ i18n.text('documentCountry') }} <span class="country-code-field"><span class="country-flag" aria-hidden="true">{{ countryFlag(country) || '🌐' }}</span><input name="country" [(ngModel)]="country" (ngModelChange)="countryChanged()" list="country-options" maxlength="2" placeholder="BR, JP, PT…" autocomplete="country" /></span></label>
            <datalist id="country-options">@for (item of supportedCountries; track item.code) { <option [value]="item.code" [label]="countryFlag(item.code) + ' ' + i18n.text(item.nameKey)"></option> }</datalist>
            @if (country) {
              <label>{{ i18n.text('documentType') }} <select name="type" [ngModel]="documentType" (ngModelChange)="documentTypeChanged($event)">@for (option of documentOptions(); track option.value) { <option [value]="option.value">{{ i18n.text(option.label) }}</option> }</select></label>
              <label>{{ i18n.text('documentNumber') }} <input name="document" [ngModel]="documentValue" (ngModelChange)="documentValueChanged($event)" [placeholder]="documentPlaceholder()" [maxlength]="documentMaxLength()" [attr.inputmode]="documentInputMode()" minlength="4" required autocomplete="off" /></label>
            }
          </fieldset>
          <button class="button">{{ i18n.text('createAccount') }}</button>
        </form>
      } @else if (mode === 'forgot-password') {
        <form class="form" (ngSubmit)="requestReset()"><label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required /></label><button class="button">{{ i18n.text('sendRecovery') }}</button></form>
      } @else if (mode === 'reset-password') {
        <form class="form" (ngSubmit)="resetPassword()"><label>{{ i18n.text('newPassword') }} <input name="password" type="password" [(ngModel)]="password" minlength="8" required /></label><button class="button">{{ i18n.text('changePassword') }}</button></form>
      } @else {
        <form class="form" (ngSubmit)="activateAccount()">
          <p class="muted">{{ i18n.text('activationHelp') }}</p>
          <label>{{ i18n.text('newPassword') }} <input name="password" type="password" [(ngModel)]="password" minlength="8" required autocomplete="new-password" /></label>
          <label>{{ i18n.text('confirmPassword') }} <input name="passwordConfirmation" type="password" [(ngModel)]="passwordConfirmation" minlength="8" required autocomplete="new-password" /></label>
          <button class="button">{{ i18n.text('activateAccount') }}</button>
        </form>
      }
      <p class="account-back"><a routerLink="/login" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-arrow-left"></i> {{ i18n.text('backToLogin') }}</a></p>
    </section></main>
  `,
})
export class AccountPageComponent implements OnInit {
  readonly supportedCountries = SUPPORTED_COUNTRIES;
  readonly countryFlag = countryFlag;
  titleKey: MessageKey = 'account';
  mode = '';
  name = ''; email = ''; password = ''; passwordConfirmation = ''; country = ''; documentType = 'PASSPORT'; documentValue = '';
  returnUrl: string | null = null;
  private token = '';

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly api: ApiService, private readonly feedback: FeedbackService, readonly i18n: I18nService) {}

  async ngOnInit(): Promise<void> {
    this.mode = this.route.snapshot.routeConfig?.path ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = candidate?.startsWith('/signing/') ? candidate : null;
    const titleKeys: Record<string, MessageKey> = { register: 'createAccount', 'forgot-password': 'recovery', 'reset-password': 'newPassword', 'verify-email': 'verifyEmail' };
    this.titleKey = titleKeys[this.mode] ?? 'account';
  }

  documentOptions(): IdentityOption[] {
    if (this.country === 'BR') return [{ value: 'BR_CPF', label: 'cpf' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'PT') return [{ value: 'PT_NIF', label: 'nif' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'JP') return [{ value: 'PASSPORT', label: 'passport' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'OTHER', label: 'other' }];
    return [{ value: 'PASSPORT', label: 'passport' }, { value: 'NATIONAL_ID', label: 'nationalId' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'TAX_ID', label: 'taxId' }, { value: 'OTHER', label: 'other' }];
  }

  countryChanged(): void { this.country = this.country.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); this.documentType = this.documentOptions()[0]?.value ?? 'PASSPORT'; this.documentValue = ''; }
  documentTypeChanged(type: string): void { this.documentType = type; this.documentValue = ''; }
  documentValueChanged(value: string): void {
    if (this.documentType === 'BR_CPF') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      this.documentValue = digits.replace(/(\d{3})(?=\d)/g, '$1.').replace(/\.(\d{3})\.(\d{3})\.(\d{1,2})$/, '.$1.$2-$3');
      return;
    }
    if (this.documentType === 'PT_NIF') {
      this.documentValue = value.replace(/\D/g, '').slice(0, 9).replace(/(\d{3})(?=\d)/g, '$1 ').trimEnd();
      return;
    }
    this.documentValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, this.documentType === 'PASSPORT' ? 12 : 30);
  }
  documentPlaceholder(): string { return this.documentType === 'BR_CPF' ? '000.000.000-00' : this.documentType === 'PT_NIF' ? '000 000 000' : this.documentType === 'PASSPORT' ? 'AB1234567' : ''; }
  documentMaxLength(): number { return this.documentType === 'BR_CPF' ? 14 : this.documentType === 'PT_NIF' ? 11 : this.documentType === 'PASSPORT' ? 12 : 30; }
  documentInputMode(): string { return this.documentType === 'BR_CPF' || this.documentType === 'PT_NIF' ? 'numeric' : 'text'; }
  async register(): Promise<void> { const accepted = await this.action('/auth/register', { name: this.name, email: this.email, preferred_locale: this.i18n.locale(), return_url: this.returnUrl, identity_document_type: this.country ? this.documentType : null, identity_document_country: this.country || null, identity_document_value: this.country ? this.documentValue : null }, this.i18n.text('registrationSent')); if (accepted) await this.router.navigate(['/']); }
  async activateAccount(): Promise<void> {
    if (!this.token || this.password !== this.passwordConfirmation) { await this.feedback.error(this.i18n.text('passwordMismatch')); return; }
    const activated = await this.action('/auth/verify-email', { token: this.token, new_password: this.password }, this.i18n.text('emailVerified'));
    if (activated) await this.router.navigate(['/login'], { queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined });
  }
  requestReset() { return this.action('/auth/password-recovery', { email: this.email, return_url: this.returnUrl }, this.i18n.text('recoverySent')); }
  async resetPassword(): Promise<void> { const reset = await this.action('/auth/password-reset', { token: this.token, new_password: this.password }, this.i18n.text('passwordChanged')); if (reset) await this.router.navigate(['/login'], { queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined }); }
  private async action(path: string, body: unknown, message: string): Promise<boolean> {
    try { await firstValueFrom(this.api.post(path, body)); await this.feedback.success(message); return true; }
    catch { await this.feedback.error(this.i18n.text('reviewData')); return false; }
  }
}
