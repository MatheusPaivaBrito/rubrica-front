import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { PdfStampViewerComponent } from '../components/pdf-stamp-viewer.component';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { Signer, SigningContext, StampPosition } from '../core/models';
import { dateTime } from '../core/date-time';
import { I18nService, Locale } from '../core/i18n.service';

@Component({
  standalone: true,
  imports: [PdfStampViewerComponent],
  template: `
    @if (loading()) {
      <main class="signing-state"><section class="card"><h1>{{ i18n.text('loadingInvite') }}</h1><p class="muted">{{ i18n.text('preparingPdf') }}</p></section></main>
    } @else if (error() && !context()) {
      <main class="signing-state"><section class="card"><h1>{{ i18n.text('inviteFailed') }}</h1><p class="error">{{ error() }}</p><button class="button" (click)="login()">{{ i18n.text('enter') }}</button></section></main>
    } @else if (context()) {
      <main class="signing-workspace">
        <section class="signing-document-pane" aria-label="Documento para assinatura">
          <header class="signing-document-header">
            <div><p class="eyebrow">{{ i18n.text('documentForSigning') }}</p><h1>{{ context()!.document_title }}</h1><p>{{ context()!.original_filename }}</p></div>
            <span class="page-hint">{{ pageHint() }}</span>
          </header>
          <app-pdf-stamp-viewer
            [token]="token"
            [documentEndpoint]="documentEndpoint()"
            [signerName]="context()!.signer.name"
            [signerIdentity]="identityLabel()"
            [stampDate]="context()!.signer.signed_at || stampPreviewDate"
            [placement]="placement()"
            [readonly]="completed()"
            (placementChange)="placement.set($event)"
          />
        </section>

        <aside class="signing-actions-pane">
          <div>
            <div class="signing-language"><p class="eyebrow">{{ i18n.text('secureSigning') }}</p><select [value]="i18n.locale()" (change)="changeLocale($any($event.target).value)" [attr.aria-label]="i18n.text('language')"><option value="pt-BR">Português</option><option value="en">English</option><option value="es">Español</option><option value="ja-JP">日本語</option></select></div>
            <h2>{{ administrativeView() ? i18n.text('adminView') : i18n.text('hello', { name: context()!.signer.name }) }}</h2>
            <p class="muted">{{ administrativeView() ? i18n.text('notSigner') : i18n.text('chooseStamp') }}</p>
          </div>

          @if (administrativeView()) {
            <section class="signing-summary">
              <small>{{ i18n.text('currentAccount') }}</small>
              <strong>{{ auth.context()?.subject }}</strong>
              <span>{{ i18n.text('notRegisteredSigner') }}</span>
            </section>
            <p class="notice">{{ i18n.text('adminSignerHelp') }}</p>
          } @else {
            <section class="signing-summary">
              <small>{{ i18n.text('signingAs') }}</small>
              <strong>{{ context()!.signer.name }}</strong>
              <span>{{ context()!.signer.email }}</span>
              @if (context()!.signer.identity_document_masked) { <span><i class="bi bi-person-vcard"></i> {{ identityLabel() }}</span> }
            </section>
          }

          @if (!administrativeView()) { <section class="stamp-instructions" [class.ready]="placement()">
            <div class="mini-stamp"><span>{{ i18n.text('signedBy') }}</span><strong>{{ context()!.signer.name }}</strong>@if (identityLabel()) { <small class="stamp-identity">{{ identityLabel() }}</small> }<small>{{ stampDateLabel() }}</small></div>
            @if (placement()) {
              <p>{{ i18n.text('stampPlaced', { page: placement()!.page }) }}</p>
            } @else {
              <p>{{ i18n.text('clickToPlace') }}</p>
            }
          </section> }

          @if (!administrativeView()) { <p class="notice">{{ i18n.text('evidenceNotice') }}</p> }
          @if (message()) { <p class="notice">{{ message() }}</p> }

          <div class="signing-actions">
            @if (!administrativeView()) { <button class="button" [disabled]="signing() || completed() || !placement()" (click)="sign()">
              {{ signing() ? i18n.text('signing') : completed() ? statusLabel() : i18n.text('signDocument') }}
            </button> }
            <button class="button secondary" [disabled]="signing()" (click)="download()">{{ context()!.request.signed_count > 0 ? i18n.text('downloadSignedPdf') : i18n.text('downloadPdf') }}</button>
            @if (!administrativeView()) { <button class="button subtle" [disabled]="signing() || completed()" (click)="decline()">{{ i18n.text('decline') }}</button> }
            @if (administrativeView()) { <button class="button" (click)="switchAccount()">{{ i18n.text('signInAsSigner') }}</button><button class="button subtle" (click)="goToDashboard()">{{ i18n.text('backDashboard') }}</button> }
          </div>
        </aside>
      </main>
    }
  `,
})
export class SigningPageComponent implements OnInit {
  readonly context = signal<SigningContext | null>(null);
  readonly placement = signal<StampPosition | null>(null);
  readonly loading = signal(true);
  readonly signing = signal(false);
  readonly completed = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly stampPreviewDate = new Date();
  token = '';

  constructor(
    readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly feedback: FeedbackService,
    readonly i18n: I18nService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!await this.auth.restore()) { await this.login(); return; }
    try {
      const context = await firstValueFrom(this.api.get<SigningContext>(`/signing/links/${this.token}`));
      this.applyContext(context);
      if (context.viewer_mode === 'signer' && context.signer.status === 'pending') {
        const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}/view`, {}));
        this.context.update(current => current ? { ...current, signer: { ...current.signer, ...signer } } : current);
      }
    } catch (error) {
      this.error.set(this.feedback.message(error, this.i18n.text('invalidInvite')));
      await this.feedback.error(error, this.i18n.text('openInviteFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  async login(): Promise<void> {
    await this.router.navigate(['/login'], { queryParams: { returnUrl: `/signing/${this.token}` } });
  }

  async switchAccount(): Promise<void> {
    try { await this.auth.logout(); } catch { /* The local session is cleared by AuthService. */ }
    await this.login();
  }

  async goToDashboard(): Promise<void> { await this.router.navigate(['/dashboard']); }
  changeLocale(locale: Locale): void { this.i18n.setLocale(locale); }

  async download(): Promise<void> {
    try {
      const signed = (this.context()?.request.signed_count ?? 0) > 0;
      const endpoint = signed ? `/signing/links/${this.token}/signed-document` : `/signing/links/${this.token}/download`;
      const response = await firstValueFrom(this.api.getBlob(endpoint));
      const url = URL.createObjectURL(response.body!);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = signed ? `rubrica-${this.context()?.document_title || 'documento'}-assinado.pdf` : (this.context()?.original_filename || 'documento.pdf');
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await this.feedback.error(error, this.i18n.text('downloadFailed'));
    }
  }

  async sign(): Promise<void> {
    const stamp = this.placement();
    if (!stamp) {
      await this.feedback.warning(this.i18n.text('positionHelp'), this.i18n.text('positionSignature'));
      return;
    }
    const consent = await Swal.fire({
      icon: 'info',
      title: this.i18n.text('evidenceTitle'),
      html: `<div class="evidence-copy"><p>${this.i18n.text('evidenceIntro')}</p><ul><li>${this.i18n.text('evidenceIdentity')}</li><li>${this.i18n.text('evidenceDevice')}</li><li>${this.i18n.text('evidenceDocument')}</li><li>${this.i18n.text('evidenceLocation')}</li></ul><p><strong>${this.i18n.text('evidenceStored')}</strong></p><label class="evidence-consent"><input id="evidence-consent" type="checkbox" /><span>${this.i18n.text('evidenceConsent')}</span></label></div>`,
      preConfirm: () => {
        const checkbox = Swal.getPopup()?.querySelector<HTMLInputElement>('#evidence-consent');
        if (!checkbox?.checked) { Swal.showValidationMessage(this.i18n.text('consentRequired')); return false; }
        return true;
      },
      customClass: { popup: 'evidence-dialog' },
      showCancelButton: true,
      confirmButtonText: this.i18n.text('continue'),
      cancelButtonText: this.i18n.text('back'),
      confirmButtonColor: '#a82035',
      cancelButtonColor: '#667085',
    });
    if (!consent.isConfirmed) return;
    const geolocation = await this.collectGeolocation();
    const client = {
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      timezone: dateTime.timezone() || 'unknown',
      screen_width: window.screen?.width || null,
      screen_height: window.screen?.height || null,
    };
    await this.answer('/sign', { consent: true, consent_version: 'rubrica-evidence-v1', stamp: { ...stamp, locale: this.i18n.locale(), timezone: dateTime.timezone() }, client, geolocation });
  }

  async decline(): Promise<void> {
    const confirmation = await Swal.fire({
      icon: 'question',
      title: this.i18n.text('declineTitle'),
      text: this.i18n.text('declineHelp'),
      showCancelButton: true,
      confirmButtonText: this.i18n.text('decline'),
      cancelButtonText: this.i18n.text('back'),
    });
    if (confirmation.isConfirmed) await this.answer('/decline', {});
  }

  stampDateLabel(): string {
    const value = this.context()?.signer.signed_at || this.stampPreviewDate;
    return this.i18n.formatDate(value);
  }

  identityLabel(): string { const signer = this.context()?.signer; if (!signer?.identity_document_masked) return ''; const type = (signer.identity_document_type ?? '').replace('BR_', '').replace('PT_', '').replaceAll('_', ' '); const country = this.alpha3Country(signer.identity_document_country); return [country, `${type} ${signer.identity_document_masked}`.trim()].filter(Boolean).join(' · '); }

  private alpha3Country(country: string | null | undefined): string { return ({ BR: 'BRA', JP: 'JPN', PT: 'PRT', US: 'USA' } as Record<string, string>)[(country ?? '').toUpperCase()] ?? (country ?? '').toUpperCase(); }

  statusLabel(): string {
    return this.context()?.signer.status === 'declined' ? this.i18n.text('declinedSignature') : this.i18n.text('signedDocument');
  }

  administrativeView(): boolean { return this.context()?.viewer_mode === 'administrator'; }
  documentEndpoint(): string { return (this.context()?.request.signed_count ?? 0) > 0 ? 'signed-document' : 'document'; }
  pageHint(): string {
    if (this.administrativeView()) return this.i18n.text('readonlyAdmin');
    const signed = this.context()?.request.signed_count ?? 0;
    if (this.completed()) return signed ? this.i18n.text('consolidatedVersion', { count: signed }) : this.i18n.text('documentFinalized');
    return signed ? this.i18n.text('priorSignatures', { count: signed }) : this.i18n.text('dragStamp');
  }

  private async collectGeolocation(): Promise<{ status: string; latitude: number | null; longitude: number | null; accuracy_meters: number | null }> {
    if (!navigator.geolocation) return { status: 'unavailable', latitude: null, longitude: null, accuracy_meters: null };
    const choice = await Swal.fire({ icon: 'question', title: this.i18n.text('shareLocation'), text: this.i18n.text('locationHelp'), showCancelButton: true, confirmButtonText: this.i18n.text('share'), cancelButtonText: this.i18n.text('withoutLocation') });
    if (!choice.isConfirmed) return { status: 'denied', latitude: null, longitude: null, accuracy_meters: null };
    Swal.fire({ title: this.i18n.text('gettingLocation'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const result = await new Promise<{ status: string; latitude: number | null; longitude: number | null; accuracy_meters: number | null }>(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({ status: 'granted', latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_meters: position.coords.accuracy }),
        error => resolve({ status: error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable', latitude: null, longitude: null, accuracy_meters: null }),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });
    Swal.close();
    return result;
  }

  private async answer(action: '/sign' | '/decline', body: unknown): Promise<void> {
    this.signing.set(true);
    this.message.set('');
    try {
      await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}${action}`, body));
      const refreshed = await firstValueFrom(this.api.get<SigningContext>(`/signing/links/${this.token}`));
      this.applyContext(refreshed);
      this.message.set(action === '/sign' ? this.i18n.text('signedSuccess') : this.i18n.text('declinedSuccess'));
      await Swal.fire({ icon: action === '/sign' ? 'success' : 'info', title: this.message(), confirmButtonText: this.i18n.text('finish') });
    } catch (error) {
      await this.feedback.error(error, action === '/sign' ? this.i18n.text('signFailed') : this.i18n.text('declineFailed'));
    } finally {
      this.signing.set(false);
    }
  }

  private applyContext(context: SigningContext): void {
    this.context.set(context);
    const stampAlreadyRendered = context.request.signed_count > 0 && context.signer.status === 'signed';
    this.placement.set(stampAlreadyRendered ? null : context.stamp);
    this.completed.set(context.viewer_mode === 'administrator' || ['signed', 'declined'].includes(context.signer.status));
  }
}
