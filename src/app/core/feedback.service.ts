import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { setAccessToken } from './api-auth.interceptor';
import { I18nService, MessageKey } from './i18n.service';

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private handlingUnauthorized = false;

  constructor(private readonly router: Router, private readonly i18n: I18nService) {}

  async error(error: unknown, title = this.i18n.text('genericErrorTitle')): Promise<void> {
    const unauthorized = this.status(error) === 401;
    if (unauthorized && this.handlingUnauthorized) return;
    if (unauthorized) this.handlingUnauthorized = true;
    await Swal.fire({
      icon: 'error',
      title,
      text: this.message(error),
      confirmButtonText: this.i18n.text('understood'),
      confirmButtonColor: '#a82035',
    });
    if (unauthorized) {
      const returnUrl = this.router.url;
      setAccessToken(null);
      await this.router.navigate(['/login'], { queryParams: returnUrl.startsWith('/login') ? undefined : { returnUrl } });
      this.handlingUnauthorized = false;
    }
  }

  async warning(message: string, title = this.i18n.text('attention')): Promise<void> {
    await this.show('warning', title, message);
  }

  async success(message: string, title = this.i18n.text('success')): Promise<void> {
    await this.show('success', title, message);
  }

  async info(message: string, title: string): Promise<void> {
    await this.show('info', title, message);
  }

  message(error: unknown, fallback = this.i18n.text('unexpectedError')): string {
    if (typeof error === 'string') return this.translate(error);
    if (!(error instanceof HttpErrorResponse) && !this.isHttpLike(error)) return fallback;

    const response = error as HttpErrorResponse;
    const detail = response.error?.detail;
    if (Array.isArray(detail)) return detail.map(issue => this.validationMessage(issue)).join('\n');
    if (typeof detail === 'string') return this.translate(detail, response.status);
    if (typeof response.error?.message === 'string') return this.translate(response.error.message, response.status);

    return this.statusMessage(response.status) || fallback;
  }

  private async show(icon: SweetAlertIcon, title: string, text: string): Promise<void> {
    await Swal.fire({ icon, title, text, confirmButtonText: this.i18n.text('understood'), confirmButtonColor: '#a82035' });
  }

  private validationMessage(issue: ValidationIssue): string {
    const rawField = String(issue.loc?.at(-1) || 'campo');
    const fields: Record<string, string> = {
      cpf: 'CPF', email: this.i18n.text('email'), password: this.i18n.text('password'), name: this.i18n.text('name'), role: this.i18n.text('profile'),
      expires_at: this.i18n.text('expirationDate'), document_id: this.i18n.text('document'), stamp: this.i18n.text('stamp'),
      page: this.i18n.text('page'), x: this.i18n.text('horizontalPosition'), y: this.i18n.text('verticalPosition'),
    };
    const message = (issue.msg || this.i18n.text('invalidValue'))
      .replace('Field required', this.i18n.text('fieldRequired'))
      .replace('Value error, ', '')
      .replace('String should have at least', 'deve ter pelo menos')
      .replace('characters', 'caracteres');
    return `${fields[rawField] || rawField}: ${message}`;
  }

  private translate(message: string, status = 0): string {
    const translations: Record<string, MessageKey> = {
      'authentication required': 'sessionExpired',
      'invalid or expired access token': 'sessionExpired',
      'invalid credentials': 'invalidCredentials',
      'forbidden': 'forbidden',
      'signing link is invalid': 'invalidInvite',
      'signature request has expired': 'linkGone',
      'signature request is not open': 'conflict',
      'authenticated user does not match a signer for this request': 'notSigner',
      'signing access has been revoked': 'linkGone',
      'signer has already signed': 'signedDocument',
      'signer already answered': 'conflict',
      'explicit consent is required': 'consentRequired',
      'a document linked to an active signature request cannot be deleted': 'conflict',
      'email already registered': 'conflict',
      'cpf already registered': 'conflict',
    };
    const translated = translations[message.trim().toLowerCase()];
    return translated ? this.i18n.text(translated) : (status ? this.statusMessage(status) : '') || message;
  }

  private statusMessage(status: number): string {
    const messages: Record<number, MessageKey> = { 0:'connectionError', 400:'invalidData', 401:'sessionExpired', 403:'forbidden', 404:'notFound', 409:'conflict', 410:'linkGone', 413:'tooLarge', 422:'invalidFields', 500:'serverError', 502:'serviceUnavailable', 503:'serviceUnavailable' };
    return messages[status] ? this.i18n.text(messages[status]) : '';
  }

  private isHttpLike(error: unknown): error is { error?: unknown; status: number } {
    return typeof error === 'object' && error !== null && 'status' in error;
  }

  private status(error: unknown): number {
    return this.isHttpLike(error) ? Number(error.status) : 0;
  }
}
