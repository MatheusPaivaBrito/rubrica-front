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
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

@Component({
  standalone: true,
  imports: [PdfStampViewerComponent, LanguagePickerComponent],
  template: `
    @if (loading()) {
      <main class="signing-state"><section class="card"><h1>{{ i18n.text('loadingInvite') }}</h1><p class="muted">{{ i18n.text('preparingPdf') }}</p></section></main>
    } @else if (error() && !context()) {
      <main class="signing-state"><section class="card"><h1>{{ i18n.text('inviteFailed') }}</h1><p class="error">{{ error() }}</p><button class="button" (click)="login()">{{ i18n.text('enter') }}</button></section></main>
    } @else if (context()) {
      <main class="signing-workspace">
        <section class="signing-document-pane" [attr.aria-label]="i18n.text('documentForSigning')">
          <header class="signing-document-header">
            <div><p class="eyebrow">{{ i18n.text('documentForSigning') }}</p><h1>{{ context()!.document_title }}</h1><p>{{ context()!.original_filename }}</p></div>
            <span class="page-hint">{{ pageHint() }}</span>
          </header>
          <app-pdf-stamp-viewer
            [token]="token"
            [documentEndpoint]="documentEndpoint()"
            [signerName]="context()!.signer.name"
            [signerIdentity]="identityLabel()"
            [signerCountry]="context()!.signer.identity_document_country || context()!.account_country || ''"
            [stampDate]="context()!.signer.signed_at || stampPreviewDate"
            [placement]="placement()"
            [readonly]="completed()"
            (placementChange)="placement.set($event)"
          />
        </section>

        <aside class="signing-actions-pane">
          <div>
            <div class="signing-language"><p class="eyebrow">{{ i18n.text('secureSigning') }}</p><app-language-picker /></div>
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
          @if (signatureMode() === 'serpro_timestamp') { <p class="notice">{{ timestampHelpLabel() }}</p> }
          @if (signatureMode() === 'serproid') { <p class="notice">{{ certificateHelpLabel() }}</p> }
          @if (message()) { <p class="notice">{{ message() }}</p> }

          <div class="signing-actions">
            @if (signatureMode() === 'serproid' && !administrativeView()) {
              <button class="button" [disabled]="signing() || !placement() || !serproidEligible()" (click)="sign(true)">{{ signing() ? i18n.text('signing') : certificateLabel() }}</button>
            } @else if (!administrativeView()) {
              <button class="button" [disabled]="signing() || completed() || !placement()" (click)="sign()">
                {{ signing() ? i18n.text('signing') : completed() ? statusLabel() : i18n.text('signDocument') }}
              </button>
            }
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
  readonly serproidEnabled = signal(false);
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
      const certificateOutcome = this.route.snapshot.queryParamMap.get('serproid');
      if (certificateOutcome === 'success') this.message.set(this.i18n.text('signedSuccess'));
      if (certificateOutcome === 'denied') this.message.set(this.certificateDeniedLabel());
      try {
        const serproid = await firstValueFrom(this.api.get<{ enabled: boolean }>('/signing/serproid/config'));
        this.serproidEnabled.set(serproid.enabled);
      } catch { this.serproidEnabled.set(false); }
      if (context.viewer_mode === 'signer' && context.signer.status === 'pending') {
        const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}/view`, {}));
        this.context.update(current => current ? { ...current, signer: {
          ...current.signer,
          ...signer,
          identity_document_type: signer.identity_document_type ?? current.signer.identity_document_type,
          identity_document_country: signer.identity_document_country ?? current.signer.identity_document_country,
          identity_document_masked: signer.identity_document_masked ?? current.signer.identity_document_masked,
        } } : current);
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

  async download(): Promise<void> {
    try {
      const signed = (this.context()?.request.signed_count ?? 0) > 0;
      const endpoint = signed ? `/signing/links/${this.token}/signed-document` : `/signing/links/${this.token}/download`;
      const response = await firstValueFrom(this.api.getBlob(endpoint));
      const url = URL.createObjectURL(response.body!);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = signed ? `rubrica-${this.context()?.document_title || 'documento'}-assinado.pdf` : (this.context()?.original_filename || 'documento.pdf');
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      await this.feedback.error(error, this.i18n.text('downloadFailed'));
    }
  }

  async sign(useCertificate = false): Promise<void> {
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
    const command = { consent: true, consent_version: 'rubrica-evidence-v1', stamp: { ...stamp, locale: this.i18n.locale(), timezone: dateTime.timezone() }, client, geolocation };
    if (useCertificate) {
      this.signing.set(true);
      try {
        const result = await firstValueFrom(this.api.post<{ authorization_url: string }>(`/signing/links/${this.token}/serproid/start`, command));
        window.location.assign(result.authorization_url);
      } catch (error) {
        this.signing.set(false);
        await this.feedback.error(error, this.i18n.text('signFailed'));
      }
      return;
    }
    await this.answer('/sign', command);
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

  certificateLabel(): string {
    return ({ 'pt-BR': 'Assinar com certificado Serpro ID', en: 'Sign with Serpro ID certificate', es: 'Firmar con certificado Serpro ID', 'ja-JP': 'Serpro ID 証明書で署名' } as Record<string, string>)[this.i18n.locale()] ?? 'Sign with Serpro ID certificate';
  }

  certificateHelpLabel(): string {
    return ({ 'pt-BR': 'Esta solicitação exige assinatura com certificado digital pelo Serpro ID.', en: 'This request requires a digital certificate signature through Serpro ID.', es: 'Esta solicitud exige una firma con certificado digital mediante Serpro ID.', 'ja-JP': 'この依頼には Serpro ID 経由のデジタル証明書署名が必要です。' } as Record<string, string>)[this.i18n.locale()] ?? 'This request requires a Serpro ID certificate signature.';
  }

  timestampHelpLabel(): string {
    return ({ 'pt-BR': 'A assinatura principal recebe automaticamente um carimbo da Hora Legal Brasileira pela ACT SERPRO.', en: 'The main signature automatically receives a Brazilian Legal Time timestamp from ACT SERPRO.', es: 'La firma principal recibe automáticamente un sello de Hora Legal Brasileña de ACT SERPRO.', 'ja-JP': '通常の署名には ACT SERPRO によるブラジル法定時刻のタイムスタンプが自動で付与されます。' } as Record<string, string>)[this.i18n.locale()] ?? 'The signature automatically receives an ACT SERPRO timestamp.';
  }

  certificateDeniedLabel(): string {
    return ({ 'pt-BR': 'A autorização do certificado foi recusada. O documento continua pendente.', en: 'Certificate authorization was declined. The document remains pending.', es: 'Se rechazó la autorización del certificado. El documento sigue pendiente.', 'ja-JP': '証明書の承認が拒否されました。文書は未署名のままです。' } as Record<string, string>)[this.i18n.locale()] ?? 'Certificate authorization was declined.';
  }

  administrativeView(): boolean { return this.context()?.viewer_mode === 'administrator'; }
  signatureMode(): 'evidence' | 'serpro_timestamp' | 'serproid' { return this.context()?.request.signature_mode ?? 'evidence'; }
  serproidEligible(): boolean {
    const context = this.context();
    if (!context || context.request.signature_mode !== 'serproid' || !this.serproidEnabled() || this.administrativeView() || this.completed()) return false;
    const lastPendingSigner = context.request.signer_count - context.request.signed_count === 1;
    return lastPendingSigner && ['BR_CPF', 'BR_CNPJ'].includes(context.signer.identity_document_type ?? '');
  }
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
      if (action === '/sign') {
        const dashboardUrl = await this.auth.dashboardUrl();
        if (this.auth.context()?.mfa_setup_required && !this.auth.context()?.mfa_enabled) {
          await this.router.navigate(['/security'], { queryParams: { returnUrl: dashboardUrl } });
        } else {
          await this.router.navigateByUrl(dashboardUrl);
        }
      }
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
