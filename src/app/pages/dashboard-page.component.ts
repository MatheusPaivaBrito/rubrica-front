import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { DocumentItem, SignatureRequest, Signer, SignerOption, SigningLink, UserCreated } from '../core/models';

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
          <article class="card hero-card"><p class="eyebrow">Documentos</p><h1>Central de assinaturas</h1><p class="muted">{{ openRequestsCount() }} solicitação(ões) aberta(s) aguardando assinatura.</p></article>

          <article class="card requests-card">
            <div class="section-heading"><div><h2>Solicitações</h2><p class="muted">Acompanhe pendências e quem já respondeu.</p></div><label class="filter-label">Mostrar<select [(ngModel)]="requestFilter"><option value="open">Em aberto</option><option value="draft">Rascunhos</option><option value="completed">Concluídas</option><option value="all">Todas</option></select></label></div>
            <div class="request-list">@for (request of visibleRequests(); track request.id) { <button class="request-row" [class.active]="selectedRequest()?.id === request.id" (click)="selectRequest(request)"><span><strong>Solicitação #{{ request.id }}</strong><small>Expira {{ request.expires_at | date:'dd/MM/yyyy HH:mm' }}</small></span><span class="request-progress"><strong>{{ request.signed_count }}/{{ request.signer_count }}</strong><small>assinaram</small></span><span class="badge" [class.pending]="request.status === 'draft'" [class.complete]="request.status === 'completed'">{{ request.status }}</span></button> } @empty { <p class="muted">Não há solicitações neste filtro.</p> }</div>
          </article>

          <div class="grid dashboard-grid">
            <section class="grid">
              <article class="card"><h2>Enviar documento</h2><form class="form" (ngSubmit)="upload()"><label>Título <input name="title" [(ngModel)]="title" required /></label><label>Organização <input name="organization" [(ngModel)]="organization" required /></label><input #filePicker class="sr-only" type="file" accept="application/pdf,.pdf" (change)="selectFile($event)" /><div class="dropzone" [class.has-file]="file" (click)="filePicker.click()" (dragover)="$event.preventDefault()" (drop)="dropFile($event)"><span class="dropzone-icon">⇧</span>@if (file) { <strong>{{ file.name }}</strong><small>{{ file.size / 1024 / 1024 | number:'1.0-2' }} MB · clique para trocar</small> } @else { <strong>Arraste seu PDF aqui</strong><small>ou clique para escolher o arquivo</small> }</div><button class="button" [disabled]="!file || submitting()">Enviar arquivo</button></form></article>

              <article class="card"><h2>Documentos enviados</h2><div class="list">@for (document of documents(); track document.id) { <div class="list-item"><div><strong>{{ document.title }}</strong><small class="muted">{{ document.original_filename }} · versão {{ document.version }}</small></div><div class="button-row"><button class="button secondary" (click)="preview(document)">Visualizar</button><button class="button secondary" (click)="prepareRequest(document)">Criar solicitação</button><button class="button danger" (click)="deleteDocument(document)">Excluir</button></div></div> } @empty { <p class="muted">Nenhum documento enviado ainda.</p> }</div></article>
            </section>

            <aside class="grid">
              <article class="card"><h2>Nova solicitação</h2>@if (selectedDocument()) { <p class="muted">{{ selectedDocument()!.title }}</p><form class="form" (ngSubmit)="createRequest()"><label>Expira em <input type="datetime-local" name="expires" [(ngModel)]="expiresAt" required /></label><button class="button" [disabled]="submitting()">Criar solicitação</button></form> } @else { <p class="muted">Escolha um documento para iniciar.</p> }</article>

              <article class="card"><h2>Detalhe da solicitação</h2>
                @if (selectedRequest()) {
                  <p class="muted">#{{ selectedRequest()!.id }} · {{ selectedRequest()!.status }}</p>
                  <div class="signer-list">@for (signer of signers(); track signer.id) { <div class="signer-row"><div><strong>{{ signer.name }}</strong><small>{{ signer.email }}</small>@if (signer.signed_at) { <small>Assinou em {{ signer.signed_at | date:'dd/MM/yyyy HH:mm' }}</small> }</div><span class="badge" [class.pending]="signer.status === 'pending' || signer.status === 'viewed'" [class.complete]="signer.status === 'signed'">{{ signer.status }}</span></div> } @empty { <p class="muted">Nenhum signatário adicionado.</p> }</div>
                  @if (selectedRequest()!.status === 'draft') {
                    <hr /><form class="form" (ngSubmit)="addSigner()"><label>Signatário registrado<div class="autocomplete"><input name="signerSearch" [(ngModel)]="signerSearch" (focus)="signerPickerOpen = true" (input)="selectedSigner.set(null)" placeholder="Pesquise por nome ou e-mail" autocomplete="off" />@if (signerPickerOpen) { <div class="autocomplete-menu">@for (user of filteredSignerOptions(); track user.id) { <button type="button" (click)="selectSigner(user)"><strong>{{ user.name }}</strong><small>{{ user.email }}</small></button> } @empty { <p>Nenhum signatário encontrado.</p> }</div> }</div></label>@if (selectedSigner()) { <p class="selected-option">Selecionado: {{ selectedSigner()!.name }} · {{ selectedSigner()!.email }}</p> }<button class="button" [disabled]="submitting() || !selectedSigner()">Adicionar signatário</button></form><button class="button secondary" (click)="openRequest()" [disabled]="submitting() || !signers().length">Abrir para assinatura</button>
                  }
                  @if (selectedRequest()!.status === 'open') { <hr /><button class="button secondary" (click)="generateLink()" [disabled]="submitting()">{{ requestLink() ? 'Rotacionar link seguro' : 'Gerar link seguro' }}</button> }
                  @if (requestLink()) { <p class="eyebrow">Link único da solicitação</p><p class="url-box">{{ requestLink() }}</p><p class="muted">Exige login e vínculo como signatário.</p><button class="button secondary" (click)="copyInvite()">Copiar link</button> }
                } @else { <p class="muted">Selecione uma solicitação para ver os detalhes.</p> }
              </article>

              @if (isAdmin()) { <article class="card"><h2>Novo usuário</h2><form class="form" (ngSubmit)="createUser()"><label>Nome <input name="userName" [(ngModel)]="userName" required /></label><label>CPF <input name="userCpf" [(ngModel)]="userCpf" placeholder="000.000.000-00" required /></label><label>E-mail <input name="userEmail" type="email" [(ngModel)]="userEmail" required /></label><label>Senha inicial <input name="userPassword" type="password" [(ngModel)]="userPassword" minlength="8" required /></label><label>Perfil <select name="userRole" [(ngModel)]="userRole"><option value="signature_signer">Signatário</option><option value="signature_operator">Operador</option><option value="signature_auditor">Auditor</option></select></label><button class="button" [disabled]="submitting()">Criar usuário</button></form></article> }
            </aside>
          </div>
        }
      </section>

      @if (previewDocument()) { <div class="modal-backdrop" (click)="closePreview()"><section class="pdf-modal" (click)="$event.stopPropagation()"><header><div><strong>{{ previewDocument()!.title }}</strong><small>{{ previewDocument()!.original_filename }}</small></div><button class="modal-close" (click)="closePreview()" aria-label="Fechar">×</button></header><iframe [src]="previewUrl()" title="Visualização do PDF"></iframe></section></div> }
    </main>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly documents = signal<DocumentItem[]>([]); readonly requests = signal<SignatureRequest[]>([]); readonly signers = signal<Signer[]>([]); readonly signerOptions = signal<SignerOption[]>([]);
  readonly selectedDocument = signal<DocumentItem | null>(null); readonly selectedRequest = signal<SignatureRequest | null>(null); readonly selectedSigner = signal<SignerOption | null>(null);
  readonly requestLinks = signal<Record<string, string>>({}); readonly previewDocument = signal<DocumentItem | null>(null); readonly previewUrl = signal<SafeResourceUrl>('');
  readonly loading = signal(true); readonly submitting = signal(false);
  requestFilter = 'open'; signerSearch = ''; signerPickerOpen = false; title = ''; organization = 'default'; expiresAt = ''; userName = ''; userCpf = ''; userEmail = ''; userPassword = ''; userRole = 'signature_signer'; file: File | null = null;

  constructor(readonly auth: AuthService, private readonly api: ApiService, private readonly router: Router, private readonly sanitizer: DomSanitizer, private readonly feedback: FeedbackService) {}

  async ngOnInit(): Promise<void> { const context = await this.auth.restore(); if (!context) { await this.router.navigate(['/login']); return; } try { if (this.canManage()) await Promise.all([this.reload(), this.loadSignerOptions()]); } catch (error) { await this.feedback.error(error, 'Não foi possível carregar o dashboard'); } finally { this.loading.set(false); } }
  canManage(): boolean { return this.auth.can('documents:write') && this.auth.can('signature_requests:write'); }
  isAdmin(): boolean { return this.auth.context()?.roles.includes('signature_admin') ?? false; }
  openRequestsCount(): number { return this.requests().filter((item) => item.status === 'open').length; }
  visibleRequests(): SignatureRequest[] { return this.requests().filter((item) => this.requestFilter === 'all' || item.status === this.requestFilter); }
  filteredSignerOptions(): SignerOption[] { const query = this.signerSearch.trim().toLowerCase(); const assigned = new Set(this.signers().map((item) => item.email)); return this.signerOptions().filter((item) => !assigned.has(item.email) && (!query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query))).slice(0, 10); }
  requestLink(): string { const request = this.selectedRequest(); return request ? this.requestLinks()[request.id] || '' : ''; }
  selectFile(event: Event): void { this.setFile((event.target as HTMLInputElement).files?.item(0) ?? null); }
  dropFile(event: DragEvent): void { event.preventDefault(); this.setFile(event.dataTransfer?.files.item(0) ?? null); }
  selectSigner(user: SignerOption): void { this.selectedSigner.set(user); this.signerSearch = `${user.name} · ${user.email}`; this.signerPickerOpen = false; }
  prepareRequest(document: DocumentItem): void { this.selectedDocument.set(document); this.selectedRequest.set(null); this.signers.set([]); }
  async selectRequest(request: SignatureRequest): Promise<void> { this.selectedRequest.set(request); this.selectedDocument.set(null); this.selectedSigner.set(null); this.signerSearch = ''; await this.run(() => this.loadSigners(request.id)); }

  preview(document: DocumentItem): void { this.previewDocument.set(document); this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`/documents/${document.id}/preview?version=${document.version}`)); }
  closePreview(): void { this.previewDocument.set(null); this.previewUrl.set(''); }
  async deleteDocument(document: DocumentItem): Promise<void> { const result = await Swal.fire({ icon: 'warning', title: 'Excluir documento?', text: 'Ele sairá da lista, mas a trilha de auditoria e o arquivo serão preservados.', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#b42318' }); if (!result.isConfirmed) return; await this.run(async () => { await firstValueFrom(this.api.delete(`/documents/${document.id}`)); this.documents.update((items) => items.filter((item) => item.id !== document.id)); }); }

  async upload(): Promise<void> { if (!this.file) return; await this.run(async () => { await firstValueFrom(this.api.postFile<DocumentItem>('/documents', this.file!, { organization_id: this.organization, title: this.title, filename: this.file!.name, content_type: this.file!.type || 'application/pdf' })); this.title = ''; this.file = null; await this.reload(); await Swal.fire({ icon: 'success', title: 'Documento enviado', timer: 1500, showConfirmButton: false }); }); }
  async createRequest(): Promise<void> { const document = this.selectedDocument(); if (!document || !this.expiresAt) return; await this.run(async () => { const request = await firstValueFrom(this.api.post<SignatureRequest>('/signature-requests', { document_id: document.id, expires_at: new Date(this.expiresAt).toISOString() })); this.requests.update((items) => [request, ...items]); await this.selectRequest(request); }); }
  async addSigner(): Promise<void> { const request = this.selectedRequest(); const user = this.selectedSigner(); if (!request || !user) return; await this.run(async () => { await firstValueFrom(this.api.post<Signer>(`/signature-requests/${request.id}/signers`, { name: user.name, email: user.email })); this.selectedSigner.set(null); this.signerSearch = ''; await this.loadSigners(request.id); }); }
  async openRequest(): Promise<void> { const request = this.selectedRequest(); if (!request) return; const result = await Swal.fire({ icon: 'question', title: 'Abrir para assinatura?', text: 'A versão será congelada e não aceitará novos signatários.', showCancelButton: true, confirmButtonText: 'Abrir solicitação', cancelButtonText: 'Voltar' }); if (!result.isConfirmed) return; await this.run(async () => { const opened = await firstValueFrom(this.api.post<SignatureRequest>(`/signature-requests/${request.id}/open`, {})); this.requests.update((items) => items.map((item) => item.id === opened.id ? opened : item)); this.selectedRequest.set(opened); const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  async generateLink(): Promise<void> { const request = this.selectedRequest(); if (!request) return; if (this.requestLink()) { const result = await Swal.fire({ icon: 'warning', title: 'Rotacionar link?', text: 'O link anterior deixará de funcionar.', showCancelButton: true, confirmButtonText: 'Rotacionar', cancelButtonText: 'Cancelar' }); if (!result.isConfirmed) return; } await this.run(async () => { const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  async createUser(): Promise<void> { await this.run(async () => { const user = await firstValueFrom(this.api.post<UserCreated>('/users', { name: this.userName, cpf: this.userCpf, email: this.userEmail, password: this.userPassword, role: this.userRole })); if (user.role === 'signature_signer') await this.loadSignerOptions(); this.userName = ''; this.userCpf = ''; this.userEmail = ''; this.userPassword = ''; await Swal.fire({ icon: 'success', title: 'Usuário criado', text: `${user.name} já pode acessar o Rubrica.`, timer: 1800, showConfirmButton: false }); }); }
  async copyInvite(): Promise<void> { await this.run(async () => { await navigator.clipboard.writeText(this.requestLink()); await Swal.fire({ icon: 'success', title: 'Link copiado', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false }); }); }
  async logout(): Promise<void> { try { await this.auth.logout(); } catch (error) { await this.feedback.error(error, 'Não foi possível encerrar a sessão no servidor'); } finally { await this.router.navigate(['/login']); } }

  private async reload(): Promise<void> { const [documents, requests] = await Promise.all([firstValueFrom(this.api.get<DocumentItem[]>('/documents')), firstValueFrom(this.api.get<SignatureRequest[]>('/signature-requests'))]); this.documents.set(documents); this.requests.set(requests.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))); }
  private async loadSigners(requestId: string): Promise<void> { this.signers.set(await firstValueFrom(this.api.get<Signer[]>(`/signature-requests/${requestId}/signers`))); }
  private async loadSignerOptions(): Promise<void> { this.signerOptions.set(await firstValueFrom(this.api.get<SignerOption[]>('/users/signers'))); }
  private async run(action: () => Promise<void>): Promise<void> { this.submitting.set(true); try { await action(); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  private setFile(file: File | null): void { if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { void this.feedback.warning('Somente arquivos PDF podem ser enviados.', 'Arquivo inválido'); return; } this.file = file; }
}
