import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { PdfStampViewerComponent } from '../components/pdf-stamp-viewer.component';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
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
            <span class="page-hint">Clique no PDF e arraste o carimbo para posicioná-lo</span>
          </header>
          <app-pdf-stamp-viewer
            [token]="token"
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
            <h2>Olá, {{ context()!.signer.name }}</h2>
            <p class="muted">Leia o documento e escolha onde seu comprovante de assinatura deve aparecer.</p>
          </div>

          <section class="signing-summary">
            <small>Assinando como</small>
            <strong>{{ context()!.signer.name }}</strong>
            <span>{{ context()!.signer.email }}</span>
          </section>

          <section class="stamp-instructions" [class.ready]="placement()">
            <div class="mini-stamp"><span>Assinado por</span><strong>{{ context()!.signer.name }}</strong><small>{{ stampDateLabel() }}</small></div>
            @if (placement()) {
              <p>Carimbo posicionado na página {{ placement()!.page }}. Você ainda pode arrastá-lo.</p>
            } @else {
              <p>Clique no ponto desejado do PDF. Depois, arraste o carimbo para ajustar.</p>
            }
          </section>

          <p class="notice">Sua identidade, data, posição e o hash desta versão serão registrados como evidência.</p>
          @if (message()) { <p class="notice">{{ message() }}</p> }
          @if (error()) { <p class="error">{{ error() }}</p> }

          <div class="signing-actions">
            <button class="button" [disabled]="signing() || completed() || !placement()" (click)="sign()">
              {{ signing() ? 'Assinando…' : completed() ? statusLabel() : 'Assinar documento' }}
            </button>
            <button class="button secondary" [disabled]="signing()" (click)="download()">Baixar PDF</button>
            <button class="button subtle" [disabled]="signing() || completed()" (click)="decline()">Recusar</button>
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
  ) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!await this.auth.restore()) { await this.login(); return; }
    try {
      const context = await firstValueFrom(this.api.get<SigningContext>(`/signing/links/${this.token}`));
      this.context.set(context);
      this.placement.set(context.stamp);
      this.completed.set(['signed', 'declined'].includes(context.signer.status));
      if (context.signer.status === 'pending') {
        const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}/view`, {}));
        this.context.update(current => current ? { ...current, signer } : current);
      }
    } catch (error: any) {
      this.error.set(error?.error?.detail || 'Convite inválido ou indisponível.');
    } finally {
      this.loading.set(false);
    }
  }

  async login(): Promise<void> {
    await this.router.navigate(['/login'], { queryParams: { returnUrl: `/signing/${this.token}` } });
  }

  async download(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getBlob(`/signing/links/${this.token}/download`));
      const url = URL.createObjectURL(response.body!);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.context()?.original_filename || 'documento.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Não foi possível baixar o documento.');
    }
  }

  async sign(): Promise<void> {
    const stamp = this.placement();
    if (!stamp) {
      this.error.set('Escolha no PDF onde o carimbo da assinatura deve aparecer.');
      return;
    }
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Confirmar assinatura?',
      text: `O carimbo será registrado na página ${stamp.page}.`,
      showCancelButton: true,
      confirmButtonText: 'Assinar documento',
      cancelButtonText: 'Voltar',
    });
    if (confirmation.isConfirmed) await this.answer('/sign', { consent: true, stamp });
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

  private async answer(action: '/sign' | '/decline', body: unknown): Promise<void> {
    this.signing.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const signer = await firstValueFrom(this.api.post<Signer>(`/signing/links/${this.token}${action}`, body));
      this.context.update(current => current ? { ...current, signer } : current);
      this.completed.set(true);
      this.message.set(action === '/sign' ? 'Assinatura concluída com sucesso.' : 'Assinatura recusada.');
      await Swal.fire({ icon: action === '/sign' ? 'success' : 'info', title: this.message(), confirmButtonText: 'Concluir' });
    } catch (error: any) {
      this.error.set(error?.error?.detail || 'Não foi possível concluir sua resposta.');
    } finally {
      this.signing.set(false);
    }
  }
}
