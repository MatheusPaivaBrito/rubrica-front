import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { DocumentItem, SignatureRequest, Signer, SignerCreated } from '../core/models';

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  template: `
    <main class="shell">
      <header class="topbar"><div class="brand">Rubrica<span>.</span></div><div class="button-row"><small>{{ auth.context()?.subject }}</small><button class="button secondary" (click)="logout()">Sair</button></div></header>
      <section class="container">
        @if (loading()) { <p class="notice">Carregando seu espaço de trabalho…</p> }
        @else if (!canManage()) { <section class="card"><h1>Você está conectado</h1><p class="muted">Use o link recebido para abrir sua solicitação de assinatura.</p></section> }
        @else {
          <article class="card hero-card"><p class="eyebrow">Documentos</p><h1>Central de assinaturas</h1><p class="muted">{{ openRequestsCount() }} solicitação(ões) aberta(s) aguardando assinatura. Crie, acompanhe e envie links manualmente.</p></article>

          <article class="card requests-card">
            <div class="section-heading"><div><h2>Solicitações</h2><p class="muted">Acompanhe pendências e quem já respondeu.</p></div><label class="filter-label">Mostrar<select [(ngModel)]="requestFilter"><option value="open">Em aberto</option><option value="draft">Rascunhos</option><option value="completed">Concluídas</option><option value="all">Todas</option></select></label></div>
            <div class="request-list">@for (request of visibleRequests(); track request.id) { <button class="request-row" [class.active]="selectedRequest()?.id === request.id" (click)="selectRequest(request)"><span><strong>Solicitação #{{ request.id }}</strong><small>Expira {{ request.expires_at | date:'dd/MM/yyyy HH:mm' }}</small></span><span class="request-progress"><strong>{{ request.signed_count }}/{{ request.signer_count }}</strong><small>assinaram</small></span><span class="badge" [class.pending]="request.status === 'draft'" [class.complete]="request.status === 'completed'">{{ request.status }}</span></button> } @empty { <p class="muted">Não há solicitações neste filtro.</p> }</div>
          </article>

          <div class="grid dashboard-grid">
            <section class="grid">
              <article class="card"><h2>Enviar documento</h2><form class="form" (ngSubmit)="upload()"><label>Título <input name="title" [(ngModel)]="title" required /></label><label>Organização <input name="organization" [(ngModel)]="organization" required /></label><input #filePicker class="sr-only" type="file" accept="application/pdf,.pdf" (change)="selectFile($event)" /><div class="dropzone" [class.has-file]="file" (click)="filePicker.click()" (dragover)="$event.preventDefault()" (drop)="dropFile($event)"><span class="dropzone-icon">⇧</span>@if (file) { <strong>{{ file.name }}</strong><small>{{ file.size / 1024 / 1024 | number:'1.0-2' }} MB · clique para trocar</small> } @else { <strong>Arraste seu PDF aqui</strong><small>ou clique para escolher o arquivo</small> }</div><button class="button" [disabled]="!file || submitting()">Enviar arquivo</button></form></article>
              <article class="card"><h2>Documentos enviados</h2><div class="list">@for (document of documents(); track document.id) { <div class="list-item"><div><strong>{{ document.title }}</strong><small class="muted">{{ document.original_filename }} · versão {{ document.version }}</small></div><button class="button secondary" (click)="prepareRequest(document)">Criar solicitação</button></div> } @empty { <p class="muted">Nenhum documento enviado ainda.</p> }</div></article>
            </section>
            <aside class="grid">
              <article class="card"><h2>Nova solicitação</h2>@if (selectedDocument()) { <p class="muted">{{ selectedDocument()!.title }}</p><form class="form" (ngSubmit)="createRequest()"><label>Expira em <input type="datetime-local" name="expires" [(ngModel)]="expiresAt" required /></label><button class="button" [disabled]="submitting()">Criar solicitação</button></form> } @else { <p class="muted">Escolha um documento para iniciar.</p> }</article>
              <article class="card"><h2>Detalhe da solicitação</h2>@if (selectedRequest()) { <p class="muted">#{{ selectedRequest()!.id }} · {{ selectedRequest()!.status }}</p><div class="signer-list">@for (signer of signers(); track signer.id) { <div class="signer-row"><div><strong>{{ signer.name }}</strong><small>{{ signer.email }}</small>@if (signer.signed_at) { <small>Assinou em {{ signer.signed_at | date:'dd/MM HH:mm' }}</small> }</div><span class="badge" [class.pending]="signer.status === 'pending' || signer.status === 'viewed'" [class.complete]="signer.status === 'signed'">{{ signer.status }}</span></div> } @empty { <p class="muted">Nenhum signatário adicionado.</p> }</div>@if (selectedRequest()!.status === 'draft') { <hr /><form class="form" (ngSubmit)="addSigner()"><label>Nome <input name="signerName" [(ngModel)]="signerName" required /></label><label>E-mail <input name="signerEmail" type="email" [(ngModel)]="signerEmail" required /></label><button class="button" [disabled]="submitting()">Gerar link</button></form><button class="button secondary" (click)="openRequest()" [disabled]="submitting() || !signers().length">Abrir para assinatura</button> } } @else { <p class="muted">Selecione uma solicitação para ver quem assinou ou adicionar convidados.</p> } @if (inviteUrl()) { <hr /><p class="eyebrow">Envio manual</p><p class="url-box">{{ inviteUrl() }}</p><p class="muted">Copie este link e envie pelo canal que preferir.</p><button class="button secondary" (click)="copyInvite()">Copiar link</button> }</article>
            </aside>
          </div>
          @if (error()) { <p class="error">{{ error() }}</p> }
        }
      </section>
    </main>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly documents = signal<DocumentItem[]>([]);
  readonly requests = signal<SignatureRequest[]>([]);
  readonly signers = signal<Signer[]>([]);
  readonly selectedDocument = signal<DocumentItem | null>(null);
  readonly selectedRequest = signal<SignatureRequest | null>(null);
  readonly inviteUrl = signal('');
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  requestFilter = 'open';
  title = '';
  organization = 'default';
  expiresAt = '';
  signerName = '';
  signerEmail = '';
  file: File | null = null;

  constructor(readonly auth: AuthService, private readonly api: ApiService, private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    const context = await this.auth.restore();
    if (!context) { await this.router.navigate(['/login']); return; }
    if (this.canManage()) await this.reload();
    this.loading.set(false);
  }

  canManage(): boolean { return this.auth.can('documents:write') && this.auth.can('signature_requests:write'); }
  openRequestsCount(): number { return this.requests().filter((request) => request.status === 'open').length; }
  visibleRequests(): SignatureRequest[] { return this.requests().filter((request) => this.requestFilter === 'all' || request.status === this.requestFilter); }
  selectFile(event: Event): void { this.setFile((event.target as HTMLInputElement).files?.item(0) ?? null); }
  dropFile(event: DragEvent): void { event.preventDefault(); this.setFile(event.dataTransfer?.files.item(0) ?? null); }
  prepareRequest(document: DocumentItem): void { this.selectedDocument.set(document); this.selectedRequest.set(null); this.signers.set([]); this.inviteUrl.set(''); }

  async selectRequest(request: SignatureRequest): Promise<void> {
    this.selectedRequest.set(request); this.selectedDocument.set(null); this.inviteUrl.set('');
    await this.loadSigners(request.id);
  }

  async upload(): Promise<void> {
    if (!this.file) return;
    await this.run(async () => {
      await firstValueFrom(this.api.postFile<DocumentItem>('/documents', this.file!, { organization_id: this.organization, title: this.title, filename: this.file!.name, content_type: this.file!.type || 'application/pdf' }));
      this.title = ''; this.file = null; await this.reload();
      await Swal.fire({ icon: 'success', title: 'Documento enviado', text: 'A versão foi protegida com hash SHA-256.', timer: 1800, showConfirmButton: false });
    });
  }

  async createRequest(): Promise<void> {
    const document = this.selectedDocument();
    if (!document || !this.expiresAt) return;
    await this.run(async () => {
      const request = await firstValueFrom(this.api.post<SignatureRequest>('/signature-requests', { document_id: document.id, expires_at: new Date(this.expiresAt).toISOString() }));
      this.requests.update((items) => [request, ...items]);
      await this.selectRequest(request);
    });
  }

  async addSigner(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;
    await this.run(async () => {
      const invitation = await firstValueFrom(this.api.post<SignerCreated>(`/signature-requests/${request.id}/signers`, { name: this.signerName, email: this.signerEmail }));
      this.inviteUrl.set(invitation.signing_url); this.signerName = ''; this.signerEmail = '';
      await this.loadSigners(request.id);
    });
  }

  async openRequest(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;
    const confirmation = await Swal.fire({ icon: 'question', title: 'Abrir para assinatura?', text: 'Depois de aberta, a solicitação congela a versão do documento e não aceita novos signatários.', showCancelButton: true, confirmButtonText: 'Abrir solicitação', cancelButtonText: 'Voltar' });
    if (!confirmation.isConfirmed) return;
    await this.run(async () => {
      const opened = await firstValueFrom(this.api.post<SignatureRequest>(`/signature-requests/${request.id}/open`, {}));
      this.requests.update((items) => items.map((item) => item.id === opened.id ? opened : item));
      this.selectedRequest.set(opened);
      await Swal.fire({ icon: 'success', title: 'Solicitação aberta', text: 'Os links já podem ser enviados aos signatários.', timer: 1800, showConfirmButton: false });
    });
  }

  async copyInvite(): Promise<void> { await navigator.clipboard.writeText(this.inviteUrl()); await Swal.fire({ icon: 'success', title: 'Link copiado', toast: true, position: 'top-end', timer: 1800, showConfirmButton: false }); }
  async logout(): Promise<void> { await this.auth.logout(); await this.router.navigate(['/login']); }

  private async reload(): Promise<void> {
    const [documents, requests] = await Promise.all([firstValueFrom(this.api.get<DocumentItem[]>('/documents')), firstValueFrom(this.api.get<SignatureRequest[]>('/signature-requests'))]);
    this.documents.set(documents); this.requests.set(requests.sort((left, right) => right.id.localeCompare(left.id, undefined, { numeric: true })));
  }

  private async loadSigners(requestId: string): Promise<void> { this.signers.set(await firstValueFrom(this.api.get<Signer[]>(`/signature-requests/${requestId}/signers`))); }
  private async run(action: () => Promise<void>): Promise<void> { this.submitting.set(true); this.error.set(''); try { await action(); } catch (error: any) { this.error.set(error?.error?.detail || 'Não foi possível concluir a operação.'); } finally { this.submitting.set(false); } }
  private setFile(file: File | null): void { if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { this.error.set('Selecione um arquivo PDF.'); return; } this.error.set(''); this.file = file; }
}
