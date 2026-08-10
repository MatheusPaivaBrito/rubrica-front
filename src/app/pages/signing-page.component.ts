import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { PdfStampViewerComponent } from '../components/pdf-stamp-viewer.component';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { Signer, SigningContext, StampPosition } from '../core/models';

@Component({
  standalone: true,
  imports: [PdfStampViewerComponent],
  template: `
    @if (loading()) {
      <main class="signing-state"><section class="card"><h1>Carregando convite…</h1><p class="muted">Validando seu acesso e preparando o PDF.</p></section></main>
    } @else if (error() && !context()) {
      <main class="signing-state"><section class="card"><h1>Não foi possível abrir este convite</h1><p class="error">{{ error() }}</p><button class="button" (click)="login()">Entrar</button></section></main>
    } @else if (context()) {
      <main class="signing-workspace">
        <section class="signing-document-pane" aria-label="Documento para assinatura">
          <header class="signing-document-header">
            <div><p class="eyebrow">Documento para assinatura</p><h1>{{ context()!.document_title }}</h1><p>{{ context()!.original_filename }}</p></div>
            <span class="page-hint">{{ administrativeView() ? 'Visualização administrativa somente leitura' : 'Clique no PDF e arraste o carimbo para posicioná-lo' }}</span>
          </header>
          <app-pdf-stamp-viewer
            [token]="token"
            [documentEndpoint]="documentEndpoint()"
            [signerName]="context()!.signer.name"
            [stampDate]="context()!.signer.signed_at || stampPreviewDate"
            [placement]="placement()"
            [readonly]="completed()"
            (placementChange)="placement.set($event)"
          />
        </section>

        <aside class="signing-actions-pane">
          <div>
            <p class="eyebrow">Rubrica · assinatura segura</p>
            <h2>{{ administrativeView() ? 'Visualização administrativa' : 'Olá, ' + context()!.signer.name }}</h2>
            <p class="muted">{{ administrativeView() ? 'Consulte o documento sem assinar no lugar do signatário.' : 'Leia o documento e escolha onde seu comprovante de assinatura deve aparecer.' }}</p>
          </div>

          <section class="signing-summary">
            <small>{{ administrativeView() ? 'Signatário do documento' : 'Assinando como' }}</small>
            <strong>{{ context()!.signer.name }}</strong>
            <span>{{ context()!.signer.email }}</span>
          </section>

          @if (!administrativeView()) { <section class="stamp-instructions" [class.ready]="placement()">
            <div class="mini-stamp"><span>Assinado por</span><strong>{{ context()!.signer.name }}</strong><small>{{ stampDateLabel() }}</small></div>
            @if (placement()) {
              <p>Carimbo posicionado na página {{ placement()!.page }}. Você ainda pode arrastá-lo.</p>
            } @else {
              <p>Clique no ponto desejado do PDF. Depois, arraste o carimbo para ajustar.</p>
            }
          </section> }

          @if (!administrativeView()) { <p class="notice">Sua identidade, data, posição e o hash desta versão serão registrados como evidência.</p> }
          @if (message()) { <p class="notice">{{ message() }}</p> }

          <div class="signing-actions">
            @if (!administrativeView()) { <button class="button" [disabled]="signing() || completed() || !placement()" (click)="sign()">
              {{ signing() ? 'Assinando…' : completed() ? statusLabel() : 'Assinar documento' }}
            </button> }
            <button class="button secondary" [disabled]="signing()" (click)="download()">{{ context()!.request.signed_count > 0 ? 'Baixar PDF assinado' : 'Baixar PDF' }}</button>
            @if (!administrativeView()) { <button class="button subtle" [disabled]="signing() || completed()" (click)="decline()">Recusar</button> }
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
    private readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly feedback: FeedbackService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!await this.auth.restore()) { await this.login(); return; }
    try {
      const context = await firstValueFrom(this.api.get<SigningContext>(`/signing/links/${this.token}`));
      this.context.set(context);
      this.placement.set(context.stamp);
      this.completed.set(context.viewer_mode === 'administrator' || ['signed', 'declined'].includes(context.signer.status));
      if (context.viewer_mode === 'signer' && context.signer.status === 'pending') {
        const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}/view`, {}));
        this.context.update(current => current ? { ...current, signer } : current);
      }
    } catch (error) {
      this.error.set(this.feedback.message(error, 'Convite inválido ou indisponível.'));
      await this.feedback.error(error, 'Não foi possível abrir o convite');
    } finally {
      this.loading.set(false);
    }
  }

  async login(): Promise<void> {
    await this.router.navigate(['/login'], { queryParams: { returnUrl: `/signing/${this.token}` } });
  }

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
      await this.feedback.error(error, 'Não foi possível baixar o documento');
    }
  }

  async sign(): Promise<void> {
    const stamp = this.placement();
    if (!stamp) {
      await this.feedback.warning('Clique no PDF para escolher onde o carimbo da assinatura deve aparecer.', 'Posicione sua assinatura');
      return;
    }
    const consent = await Swal.fire({
      icon: 'info',
      title: 'Registro de evidências',
      html: `<p style="text-align:left">Para proteger esta assinatura, registraremos:</p><ul style="text-align:left"><li>identificador pseudonimizado da sua conta;</li><li>data, IP, navegador, plataforma e tamanho de tela;</li><li>hash do documento e posição do carimbo;</li><li>localização somente se você autorizar no próximo passo.</li></ul>`,
      input: 'checkbox',
      inputPlaceholder: 'Li e concordo com o registro dessas evidências',
      inputValidator: value => value ? undefined : 'Confirme o consentimento para continuar.',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Voltar',
    });
    if (!consent.isConfirmed) return;
    const geolocation = await this.collectGeolocation();
    const client = {
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      screen_width: window.screen?.width || null,
      screen_height: window.screen?.height || null,
    };
    await this.answer('/sign', { consent: true, consent_version: 'rubrica-evidence-v1', stamp, client, geolocation });
  }

  async decline(): Promise<void> {
    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Recusar assinatura?',
      text: 'Esta ação será registrada na solicitação.',
      showCancelButton: true,
      confirmButtonText: 'Recusar',
      cancelButtonText: 'Voltar',
    });
    if (confirmation.isConfirmed) await this.answer('/decline', {});
  }

  stampDateLabel(): string {
    const value = this.context()?.signer.signed_at || this.stampPreviewDate;
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  statusLabel(): string {
    return this.context()?.signer.status === 'declined' ? 'Assinatura recusada' : 'Documento assinado';
  }

  administrativeView(): boolean { return this.context()?.viewer_mode === 'administrator'; }
  documentEndpoint(): string { return this.administrativeView() && (this.context()?.request.signed_count ?? 0) > 0 ? 'signed-document' : 'document'; }

  private async collectGeolocation(): Promise<{ status: string; latitude: number | null; longitude: number | null; accuracy_meters: number | null }> {
    if (!navigator.geolocation) return { status: 'unavailable', latitude: null, longitude: null, accuracy_meters: null };
    const choice = await Swal.fire({ icon: 'question', title: 'Compartilhar localização?', text: 'A localização aumenta a rastreabilidade, mas é opcional e não impede sua assinatura.', showCancelButton: true, confirmButtonText: 'Compartilhar localização', cancelButtonText: 'Assinar sem localização' });
    if (!choice.isConfirmed) return { status: 'denied', latitude: null, longitude: null, accuracy_meters: null };
    Swal.fire({ title: 'Obtendo localização…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
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
      const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}${action}`, body));
      this.context.update(current => current ? { ...current, signer } : current);
      this.completed.set(true);
      this.message.set(action === '/sign' ? 'Assinatura concluída com sucesso.' : 'Assinatura recusada.');
      await Swal.fire({ icon: action === '/sign' ? 'success' : 'info', title: this.message(), confirmButtonText: 'Concluir' });
    } catch (error) {
      await this.feedback.error(error, action === '/sign' ? 'Não foi possível assinar' : 'Não foi possível recusar');
    } finally {
      this.signing.set(false);
    }
  }
}
