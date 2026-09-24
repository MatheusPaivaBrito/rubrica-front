import { Component, OnInit, ViewChild, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, MessageKey } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { PasswordFieldComponent } from '../components/password-field.component';
import { TurnstileState, TurnstileWidgetComponent } from '../components/turnstile-widget.component';
import { SUPPORTED_COUNTRIES } from '../core/countries';

interface IdentityOption { value: string; label: MessageKey }

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet, LanguagePickerComponent, PasswordFieldComponent, TurnstileWidgetComponent],
  template: `
    <main class="login-layout account-layout"><section class="card auth-card account-card" [class.account-card-compact]="mode === 'forgot-password'">
      <header class="account-heading">
        <a class="account-brand" routerLink="/" aria-label="Rubrica"><img src="icons/rubrica-brand/source/rubrica-lockup-primary.png" alt="Rubrica Signature" /></a>
        <app-language-picker />
      </header>
      <div class="account-title"><p class="eyebrow">{{ i18n.text('secureAccess') }}</p><h1>{{ i18n.text(titleKey) }}</h1>@if (mode === 'register') { <p class="muted">{{ i18n.text('registerHelp') }}</p> } @else if (mode === 'forgot-password') { <p class="muted">{{ i18n.text('recoveryHelp') }}</p> }</div>
      @if (mode === 'register') {
        <form class="form" (ngSubmit)="register()">
          <label>{{ i18n.text('name') }} <input name="name" [(ngModel)]="name" required autocomplete="name" /></label>
          <label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
          <fieldset class="form identity-fieldset"><legend>{{ i18n.text('optionalIdentity') }}</legend><p class="field-help">{{ i18n.text('identityLater') }}</p>
            <span class="field-label">{{ i18n.text('documentCountry') }}</span>
            <details class="country-picker" #countryMenu (toggle)="pickerToggled($event)">
              <summary [attr.aria-label]="i18n.text('documentCountry')">
                <span class="country-picker-value">
                  <strong>{{ selectedCountryName() }}</strong>
                </span>
                <i class="bi bi-chevron-down picker-chevron" aria-hidden="true"></i>
              </summary>
              <div class="country-options" role="listbox" [attr.aria-label]="i18n.text('documentCountry')">
                <label class="country-search"><i class="bi bi-search" aria-hidden="true"></i><input name="countrySearch" [(ngModel)]="countrySearch" [placeholder]="i18n.text('searchCountry')" autocomplete="off" (click)="$event.stopPropagation()" (keydown.enter)="$event.preventDefault()" /></label>
                <button type="button" role="option" [attr.aria-selected]="!country" [class.active]="!country" (click)="selectCountry('', countryMenu)">
                  <span class="country-option-label"><strong>{{ i18n.text('doNotProvide') }}</strong></span>
                  @if (!country) { <i class="bi bi-check2" aria-hidden="true"></i> }
                </button>
                @for (item of filteredCountries(); track item.code) {
                  <button type="button" role="option" [attr.aria-selected]="country === item.code" [class.active]="country === item.code" (click)="selectCountry(item.code, countryMenu)">
                    <span class="country-option-label"><strong>{{ i18n.text(item.nameKey) }}</strong></span>
                    @if (country === item.code) { <i class="bi bi-check2" aria-hidden="true"></i> }
                  </button>
                }
              </div>
            </details>
            @if (country) {
              <span class="field-label">{{ i18n.text('documentType') }}</span>
              <details class="country-picker document-type-picker" #documentTypeMenu (toggle)="pickerToggled($event)">
                <summary [attr.aria-label]="i18n.text('documentType')">
                  <i [class]="'bi ' + documentTypeIcon(documentType) + ' country-picker-mark'" aria-hidden="true"></i>
                  <span class="country-picker-value"><strong>{{ selectedDocumentTypeName() }}</strong></span>
                  <i class="bi bi-chevron-down picker-chevron" aria-hidden="true"></i>
                </summary>
                <div class="country-options" role="listbox" [attr.aria-label]="i18n.text('documentType')">
                  @for (option of documentOptions(); track option.value) {
                    <button type="button" role="option" [attr.aria-selected]="documentType === option.value" [class.active]="documentType === option.value" (click)="selectDocumentType(option.value, documentTypeMenu)">
                      <i [class]="'bi ' + documentTypeIcon(option.value) + ' country-option-mark'" aria-hidden="true"></i>
                      <span><strong>{{ i18n.text(option.label) }}</strong></span>
                      @if (documentType === option.value) { <i class="bi bi-check2" aria-hidden="true"></i> }
                    </button>
                  }
                </div>
              </details>
              <label>{{ i18n.text('documentNumber') }} <input name="document" [ngModel]="documentValue" (ngModelChange)="documentValueChanged($event)" [placeholder]="documentPlaceholder()" [maxlength]="documentMaxLength()" [attr.inputmode]="documentInputMode()" minlength="4" required autocomplete="off" /></label>
            }
          </fieldset>
          <app-turnstile-widget class="account-turnstile" action="register" (tokenChange)="turnstileToken.set($event)" (stateChange)="turnstileStateChanged($event)" />
          <button class="button" [disabled]="verificationBlocked()">{{ i18n.text('createAccount') }}</button>
        </form>
      } @else if (mode === 'forgot-password') {
        <form class="form" (ngSubmit)="requestReset()"><label>{{ i18n.text('email') }} <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label><app-turnstile-widget class="account-turnstile" action="password_recovery" (tokenChange)="turnstileToken.set($event)" (stateChange)="turnstileStateChanged($event)" /><button class="button" [disabled]="verificationBlocked()">{{ i18n.text('sendRecovery') }}</button></form>
      } @else if (mode === 'reset-password') {
        <form class="form" (ngSubmit)="resetPassword()">
          <app-password-field name="password" [(ngModel)]="password" [label]="i18n.text('newPassword')" autocomplete="new-password" [minlength]="8" [maxlength]="128" [pattern]="passwordPattern" required />
          <ng-container [ngTemplateOutlet]="passwordRules" />
          <button class="button" [disabled]="!passwordMeetsPolicy()">{{ i18n.text('changePassword') }}</button>
        </form>
      } @else {
        <form class="form" (ngSubmit)="activateAccount()">
          <p class="muted">{{ i18n.text('activationHelp') }}</p>
          <app-password-field name="password" [(ngModel)]="password" [label]="i18n.text('newPassword')" autocomplete="new-password" [minlength]="8" [maxlength]="128" [pattern]="passwordPattern" required />
          <ng-container [ngTemplateOutlet]="passwordRules" />
          <app-password-field name="passwordConfirmation" [(ngModel)]="passwordConfirmation" [label]="i18n.text('confirmPassword')" autocomplete="new-password" [minlength]="8" [maxlength]="128" required />
          <p class="password-match" [class.met]="passwordsMatch()"><i class="bi" [class.bi-check-circle-fill]="passwordsMatch()" [class.bi-circle]="!passwordsMatch()"></i>{{ i18n.text('passwordsMustMatch') }}</p>
          <button class="button" [disabled]="!passwordMeetsPolicy() || !passwordsMatch()">{{ i18n.text('activateAccount') }}</button>
        </form>
      }
      <ng-template #passwordRules>
        <section class="password-rules" aria-live="polite">
          <strong>{{ i18n.text('passwordRequirements') }}</strong>
          <ul>
            <li [class.met]="password.length >= 8"><i class="bi" [class.bi-check-circle-fill]="password.length >= 8" [class.bi-circle]="password.length < 8"></i>{{ i18n.text('passwordMinLength') }}</li>
            <li [class.met]="hasUppercase()"><i class="bi" [class.bi-check-circle-fill]="hasUppercase()" [class.bi-circle]="!hasUppercase()"></i>{{ i18n.text('passwordUppercase') }}</li>
            <li [class.met]="hasLowercase()"><i class="bi" [class.bi-check-circle-fill]="hasLowercase()" [class.bi-circle]="!hasLowercase()"></i>{{ i18n.text('passwordLowercase') }}</li>
            <li [class.met]="hasNumber()"><i class="bi" [class.bi-check-circle-fill]="hasNumber()" [class.bi-circle]="!hasNumber()"></i>{{ i18n.text('passwordNumber') }}</li>
            <li [class.met]="hasSpecialCharacter()"><i class="bi" [class.bi-check-circle-fill]="hasSpecialCharacter()" [class.bi-circle]="!hasSpecialCharacter()"></i>{{ i18n.text('passwordSpecial') }}</li>
          </ul>
        </section>
      </ng-template>
      <nav class="account-navigation" [attr.aria-label]="i18n.text('account')"><a routerLink="/"><i class="bi bi-house"></i> {{ i18n.text('backToHome') }}</a><a routerLink="/login" [queryParams]="returnUrl ? { returnUrl } : undefined"><i class="bi bi-arrow-left"></i> {{ i18n.text('backToLogin') }}</a></nav>
    </section></main>
  `,
})
export class AccountPageComponent implements OnInit {
  @ViewChild(TurnstileWidgetComponent) turnstile?: TurnstileWidgetComponent;
  readonly supportedCountries = SUPPORTED_COUNTRIES;
  titleKey: MessageKey = 'account';
  mode = '';
  name = ''; email = ''; password = ''; passwordConfirmation = ''; country = ''; countrySearch = ''; documentType = 'PASSPORT'; documentValue = '';
  readonly turnstileToken = signal('');
  readonly verificationLoading = signal(true);
  readonly verificationRequired = signal(false);
  readonly verificationError = signal(false);
  readonly passwordPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,128}';
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
    if (this.country === 'BR') return [{ value: 'BR_CPF', label: 'cpf' }, { value: 'BR_CNPJ', label: 'cnpj' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'PT') return [{ value: 'PT_NIF', label: 'nif' }, { value: 'PASSPORT', label: 'passport' }, { value: 'OTHER', label: 'other' }];
    if (this.country === 'JP') return [{ value: 'PASSPORT', label: 'passport' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'OTHER', label: 'other' }];
    return [{ value: 'PASSPORT', label: 'passport' }, { value: 'NATIONAL_ID', label: 'nationalId' }, { value: 'RESIDENCE_CARD', label: 'residenceCard' }, { value: 'DRIVER_LICENSE', label: 'driverLicense' }, { value: 'TAX_ID', label: 'taxId' }, { value: 'OTHER', label: 'other' }];
  }

  selectedCountryName(): string {
    const selected = this.supportedCountries.find(item => item.code === this.country);
    return selected ? this.i18n.text(selected.nameKey) : this.i18n.text('chooseCountry');
  }
  filteredCountries() {
    const query = this.countrySearch.trim().toLocaleLowerCase(this.i18n.locale());
    if (!query) return this.supportedCountries;
    return this.supportedCountries.filter(item =>
      item.code.toLowerCase().includes(query)
      || this.i18n.text(item.nameKey).toLocaleLowerCase(this.i18n.locale()).includes(query)
    );
  }
  selectCountry(country: string, menu: HTMLDetailsElement): void {
    this.country = country;
    this.documentType = this.documentOptions()[0]?.value ?? 'PASSPORT';
    this.documentValue = '';
    this.countrySearch = '';
    menu.removeAttribute('open');
  }
  pickerToggled(event: Event): void {
    const current = event.target as HTMLDetailsElement;
    if (!current.open) return;
    current.closest('form')?.querySelectorAll<HTMLDetailsElement>('details.country-picker[open]').forEach(menu => {
      if (menu !== current) menu.removeAttribute('open');
    });
  }
  selectedDocumentTypeName(): string {
    const selected = this.documentOptions().find(option => option.value === this.documentType);
    return selected ? this.i18n.text(selected.label) : '';
  }
  selectDocumentType(type: string, menu: HTMLDetailsElement): void {
    this.documentType = type;
    this.documentValue = '';
    menu.removeAttribute('open');
  }
  documentTypeIcon(type: string): string {
    if (type === 'PASSPORT') return 'bi-passport';
    if (type === 'DRIVER_LICENSE') return 'bi-car-front';
    if (type === 'TAX_ID' || type === 'BR_CPF' || type === 'BR_CNPJ' || type === 'PT_NIF') return 'bi-person-vcard';
    if (type === 'RESIDENCE_CARD') return 'bi-house-check';
    if (type === 'NATIONAL_ID') return 'bi-card-text';
    return 'bi-file-earmark-person';
  }
  documentValueChanged(value: string): void {
    if (this.documentType === 'BR_CPF') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      this.documentValue = digits.replace(/(\d{3})(?=\d)/g, '$1.').replace(/\.(\d{3})\.(\d{3})\.(\d{1,2})$/, '.$1.$2-$3');
      return;
    }
    if (this.documentType === 'BR_CNPJ') {
      const digits = value.replace(/\D/g, '').slice(0, 14);
      this.documentValue = digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
      return;
    }
    if (this.documentType === 'PT_NIF') {
      this.documentValue = value.replace(/\D/g, '').slice(0, 9).replace(/(\d{3})(?=\d)/g, '$1 ').trimEnd();
      return;
    }
    this.documentValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, this.documentType === 'PASSPORT' ? 12 : 30);
  }
  documentPlaceholder(): string { return this.documentType === 'BR_CPF' ? '000.000.000-00' : this.documentType === 'BR_CNPJ' ? '00.000.000/0000-00' : this.documentType === 'PT_NIF' ? '000 000 000' : this.documentType === 'PASSPORT' ? 'AB1234567' : ''; }
  documentMaxLength(): number { return this.documentType === 'BR_CPF' ? 14 : this.documentType === 'BR_CNPJ' ? 18 : this.documentType === 'PT_NIF' ? 11 : this.documentType === 'PASSPORT' ? 12 : 30; }
  documentInputMode(): string { return this.documentType === 'BR_CPF' || this.documentType === 'BR_CNPJ' || this.documentType === 'PT_NIF' ? 'numeric' : 'text'; }
  hasUppercase(): boolean { return /[A-Z]/.test(this.password); }
  hasLowercase(): boolean { return /[a-z]/.test(this.password); }
  hasNumber(): boolean { return /\d/.test(this.password); }
  hasSpecialCharacter(): boolean { return /[^A-Za-z0-9\s]/.test(this.password); }
  passwordMeetsPolicy(): boolean { return this.password.length >= 8 && this.password.length <= 128 && this.hasUppercase() && this.hasLowercase() && this.hasNumber() && this.hasSpecialCharacter(); }
  passwordsMatch(): boolean { return this.password.length > 0 && this.password === this.passwordConfirmation; }
  async register(): Promise<void> {
    if (this.verificationBlocked()) return;
    const accepted = await this.action('/auth/register', { name: this.name, email: this.email, preferred_locale: this.i18n.locale(), return_url: this.returnUrl, identity_document_type: this.country ? this.documentType : null, identity_document_country: this.country || null, identity_document_value: this.country ? this.documentValue : null, turnstile_token: this.turnstileToken() || null }, this.i18n.text('registrationSent'));
    if (accepted) await this.router.navigate(['/']);
    else this.turnstile?.reset();
  }
  async activateAccount(): Promise<void> {
    if (!this.token || !this.passwordMeetsPolicy() || this.password !== this.passwordConfirmation) { await this.feedback.error(this.i18n.text('reviewData')); return; }
    const activated = await this.action('/auth/verify-email', { token: this.token, new_password: this.password }, this.i18n.text('emailVerified'));
    if (activated) await this.router.navigate(['/login'], { queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined });
  }
  async requestReset(): Promise<boolean> {
    try {
      if (this.verificationBlocked()) return false;
      await firstValueFrom(this.api.post('/auth/password-recovery', { email: this.email, return_url: this.returnUrl, turnstile_token: this.turnstileToken() || null }));
      await this.feedback.info(this.i18n.text('recoverySent'), this.i18n.text('recoveryNoticeTitle'));
      return true;
    } catch (error) {
      await this.feedback.error(error);
      return false;
    } finally {
      this.turnstile?.reset();
    }
  }
  turnstileStateChanged(state: TurnstileState): void {
    this.verificationLoading.set(state.loading);
    this.verificationRequired.set(state.required);
    this.verificationError.set(state.error);
  }
  verificationBlocked(): boolean { return this.verificationLoading() || this.verificationError() || (this.verificationRequired() && !this.turnstileToken()); }
  async resetPassword(): Promise<void> { if (!this.passwordMeetsPolicy()) { await this.feedback.error(this.i18n.text('reviewData')); return; } const reset = await this.action('/auth/password-reset', { token: this.token, new_password: this.password }, this.i18n.text('passwordChanged')); if (reset) await this.router.navigate(['/login'], { queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : undefined }); }
  private async action(path: string, body: unknown, message: string): Promise<boolean> {
    try { await firstValueFrom(this.api.post(path, body)); await this.feedback.success(message); return true; }
    catch { await this.feedback.error(this.i18n.text('reviewData')); return false; }
  }
}
