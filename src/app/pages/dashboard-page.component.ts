import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { DocumentItem, SignatureEvidence, SignatureRequest, Signer, SignerOption, SigningLink, UserCreated } from '../core/models';

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  template: `
    <main class="shell">
      <header class="topbar">
        <div class="brand">Rubrica<span>.</span></div>
        <div class="topbar-account"><span class="user-chip">{{ auth.context()?.subject }}</span><button class="button ghost" (click)="logout()">Sair</button></div>
      </header>

      <section class="container dashboard-container">
        @if (loading()) {
          <p class="notice">Carregando seu espaço de trabalho…</p>
        } @else if (!canManage()) {
          <section class="card empty-state"><h1>Você está conectado</h1><p class="muted">Use o link recebido para abrir sua solicitação de assinatura.</p></section>
        } @else {
          <header class="dashboard-header">
            <div><p class="eyebrow">Visão geral</p><h1>Central de assinaturas</h1><p class="muted">Organize documentos, acompanhe solicitações e consulte evidências.</p></div>
            <div class="header-actions">@if (isAdmin()) { <button class="button" (click)="showUserModal()">Novo usuário</button> }</div>
          </header>

          <section class="stats-grid" aria-label="Resumo">
            <article class="stat-card"><span>Documentos</span><strong>{{ documents().length }}</strong><small>arquivos disponíveis</small></article>
            <article class="stat-card accent"><span>Em assinatura</span><strong>{{ openRequestsCount() }}</strong><small>solicitações abertas</small></article>
            <article class="stat-card"><span>Concluídas</span><strong>{{ completedRequestsCount() }}</strong><small>processos finalizados</small></article>
          </section>

          <article class="card table-card">
            <div class="section-heading">
              <div><p class="eyebrow">Acompanhamento</p><h2>Solicitações</h2><p class="muted">Veja o andamento e abra os detalhes somente quando precisar.</p></div>
              <label class="filter-label">Mostrar<select [(ngModel)]="requestFilter"><option value="all">Todas</option><option value="open">Em aberto</option><option value="draft">Rascunhos</option><option value="completed">Concluídas</option></select></label>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Solicitação</th><th>Documento</th><th>Status</th><th>Assinaturas</th><th>Prazo</th><th class="actions-column">Ações</th></tr></thead>
                <tbody>
                  @for (request of visibleRequests(); track request.id) {
                    <tr>
                      <td><strong>#{{ request.id }}</strong></td>
                      <td><div class="document-cell"><strong>{{ documentTitle(request.document_id) }}</strong><small>versão {{ request.document_version }}</small></div></td>
                      <td><span class="badge" [class.pending]="request.status === 'draft'" [class.complete]="request.status === 'completed'">{{ requestStatusLabel(request.status) }}</span></td>
                      <td><div class="progress-cell"><strong>{{ request.signed_count }} de {{ request.signer_count }}</strong><span class="progress-track"><i [style.width.%]="signatureProgress(request)"></i></span></div></td>
                      <td>{{ request.expires_at | date:'dd/MM/yyyy HH:mm' }}</td>
                      <td><div class="table-actions"><button class="button secondary compact" (click)="openRequestDetails(request)">Detalhes</button></div></td>
                    </tr>
                  } @empty { <tr><td colspan="6"><div class="empty-state"><strong>Nenhuma solicitação neste filtro</strong><span>Altere o filtro ou crie uma solicitação a partir de um documento.</span></div></td></tr> }
                </tbody>
              </table>
            </div>
          </article>

          <article class="card table-card">
            <div class="section-heading"><div><p class="eyebrow">Acervo</p><h2>Documentos</h2><p class="muted">Arquivos disponíveis para consulta e novas solicitações.</p></div><button class="button secondary" (click)="showUploadModal()">+ Enviar PDF</button></div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Documento</th><th>Arquivo</th><th>Versão</th><th>Status</th><th class="actions-column">Ações</th></tr></thead>
                <tbody>
                  @for (document of documents(); track document.id) {
                    <tr>
                      <td><strong>{{ document.title }}</strong></td>
                      <td><span class="file-name">{{ document.original_filename }}</span></td>
                      <td>{{ document.version }}</td>
                      <td><span class="badge">Disponível</span></td>
                      <td><div class="table-actions"><button class="button secondary compact" (click)="preview(document)">Visualizar</button><button class="button secondary compact" (click)="prepareRequest(document)">Solicitar assinatura</button><button class="button compact danger" (click)="deleteDocument(document)">Excluir</button></div></td>
                    </tr>
                  } @empty { <tr><td colspan="5"><div class="empty-state"><strong>Nenhum documento enviado</strong><span>Envie o primeiro PDF para iniciar uma solicitação.</span></div></td></tr> }
                </tbody>
              </table>
            </div>
          </article>
        }
      </section>

      @if (uploadModalOpen()) {
        <div class="modal-backdrop" (click)="closeUploadModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">Novo arquivo</p><h2>Enviar documento</h2></div><button class="modal-close" (click)="closeUploadModal()" aria-label="Fechar">×</button></header>
          <form class="modal-body form" (ngSubmit)="upload()"><label>Título <input name="title" [(ngModel)]="title" required /></label><label>Organização <input name="organization" [(ngModel)]="organization" required /></label><input #filePicker class="sr-only" type="file" accept="application/pdf,.pdf" (change)="selectFile($event)" /><div class="dropzone" [class.has-file]="file" (click)="filePicker.click()" (dragover)="$event.preventDefault()" (drop)="dropFile($event)"><span class="dropzone-icon">⇧</span>@if (file) { <strong>{{ file.name }}</strong><small>{{ file.size / 1024 / 1024 | number:'1.0-2' }} MB · clique para trocar</small> } @else { <strong>Arraste seu PDF aqui</strong><small>ou clique para escolher o arquivo</small> }</div><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeUploadModal()">Cancelar</button><button class="button" [disabled]="!file || submitting()">Enviar arquivo</button></footer></form>
        </section></div>
      }

      @if (requestCreateModalOpen() && selectedDocument()) {
        <div class="modal-backdrop" (click)="closeRequestCreateModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">Nova solicitação</p><h2>{{ selectedDocument()!.title }}</h2><span class="muted">{{ selectedDocument()!.original_filename }}</span></div><button class="modal-close" (click)="closeRequestCreateModal()" aria-label="Fechar">×</button></header>
          <form class="modal-body form" (ngSubmit)="createRequest()"><p class="notice">O documento será preparado como rascunho. Você adicionará os signatários antes de abrir para assinatura.</p><label>Prazo para assinatura <input type="datetime-local" name="expires" [(ngModel)]="expiresAt" required /></label><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeRequestCreateModal()">Cancelar</button><button class="button" [disabled]="submitting()">Criar solicitação</button></footer></form>
        </section></div>
      }

      @if (requestModalOpen() && selectedRequest()) {
        <div class="modal-backdrop" (click)="closeRequestModal()"><section class="app-modal wide" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">Solicitação #{{ selectedRequest()!.id }}</p><h2>{{ documentTitle(selectedRequest()!.document_id) }}</h2><span class="badge" [class.pending]="selectedRequest()!.status === 'draft'" [class.complete]="selectedRequest()!.status === 'completed'">{{ requestStatusLabel(selectedRequest()!.status) }}</span></div><button class="modal-close" (click)="closeRequestModal()" aria-label="Fechar">×</button></header>
          <div class="modal-body">
            @if (detailsLoading()) { <p class="notice">Carregando detalhes…</p> } @else {
              <div class="metric-strip"><div><small>Assinaturas</small><strong>{{ selectedRequest()!.signed_count }}/{{ selectedRequest()!.signer_count }}</strong></div><div><small>Versão</small><strong>{{ selectedRequest()!.document_version }}</strong></div><div><small>Prazo</small><strong>{{ selectedRequest()!.expires_at | date:'dd/MM/yyyy HH:mm' }}</strong></div></div>
              <div class="details-grid">
                <section class="detail-panel"><div class="panel-heading"><div><h3>Signatários</h3><p class="muted">Pessoas vinculadas a esta solicitação.</p></div></div><div class="signer-list">@for (signer of signers(); track signer.id) { <div class="signer-row"><div><strong>{{ signer.name }}</strong><small>{{ signer.email }}</small>@if (signer.signed_at) { <small>Assinou em {{ signer.signed_at | date:'dd/MM/yyyy HH:mm' }}</small> }</div><span class="badge" [class.pending]="signer.status === 'pending' || signer.status === 'viewed'" [class.complete]="signer.status === 'signed'">{{ signerStatusLabel(signer.status) }}</span></div> } @empty { <div class="empty-state compact-empty"><strong>Nenhum signatário</strong><span>Adicione alguém antes de abrir a solicitação.</span></div> }</div></section>
                <section class="detail-panel action-panel">
                  @if (selectedRequest()!.status === 'draft') {
                    <div><h3>Adicionar signatário</h3><p class="muted">Pesquise entre os usuários cadastrados.</p></div>
                    <form class="form" (ngSubmit)="addSigner()"><label>Usuário<div class="autocomplete" (focusout)="closeSignerPicker($event)" (keydown.escape)="signerPickerOpen = false"><input name="signerSearch" [(ngModel)]="signerSearch" (focus)="signerPickerOpen = true" (input)="selectedSigner.set(null); signerPickerOpen = true" placeholder="Nome ou e-mail" autocomplete="off" />@if (signerPickerOpen) { <div class="autocomplete-menu">@for (user of filteredSignerOptions(); track user.id) { <button type="button" (click)="selectSigner(user)"><strong>{{ user.name }}</strong><small>{{ user.email }}</small></button> } @empty { <p>Nenhum usuário encontrado.</p> }</div> }</div></label>@if (selectedSigner()) { <p class="selected-option">{{ selectedSigner()!.name }} · {{ selectedSigner()!.email }}</p> }<button class="button" [disabled]="submitting() || !selectedSigner()">Adicionar</button></form><hr /><button class="button secondary full-width" (click)="openRequest()" [disabled]="submitting() || !signers().length">Abrir para assinatura</button>
                  } @else {
                    <div><h3>Acesso ao documento</h3><p class="muted">Compartilhe o link único com os signatários cadastrados.</p></div>
                    @if (requestLink()) { <div class="link-panel"><small>Link único</small><span>{{ requestLink() }}</span></div><div class="button-row"><button class="button secondary compact" (click)="copyInvite()">Copiar link</button><button class="button secondary compact" (click)="openInvite()">Abrir link</button></div> } @else { <p class="notice">Esta solicitação ainda não possui um link recuperável.</p> }
                    @if (selectedRequest()!.status === 'open' || (isAdmin() && selectedRequest()!.status === 'completed' && !requestLink())) { <button class="button secondary full-width" (click)="generateLink()" [disabled]="submitting()">{{ requestLink() ? 'Rotacionar link' : selectedRequest()!.status === 'completed' ? 'Gerar link histórico' : 'Gerar link' }}</button> }
                    @if (isAdmin() && hasSignedSigners()) { <hr /><div><h3>Documento concluído</h3><p class="muted">Consulte o artefato carimbado e sua trilha técnica.</p></div><div class="button-row"><button class="button secondary compact" (click)="previewSignedRequest()">Ver PDF assinado</button><button class="button secondary compact" (click)="showEvidence()">Ver evidências</button></div> }
                  }
                </section>
              </div>
            }
          </div>
        </section></div>
      }

      @if (userModalOpen()) {
        <div class="modal-backdrop" (click)="closeUserModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">Acesso</p><h2>Novo usuário</h2><span class="muted">Cadastre uma pessoa e defina seu perfil inicial.</span></div><button class="modal-close" (click)="closeUserModal()" aria-label="Fechar">×</button></header>
          <form class="modal-body form" (ngSubmit)="createUser()"><div class="form-row"><label>Nome <input name="userName" [(ngModel)]="userName" required /></label><label>CPF <input name="userCpf" [(ngModel)]="userCpf" placeholder="000.000.000-00" required /></label></div><label>E-mail <input name="userEmail" type="email" [(ngModel)]="userEmail" required /></label><label>Senha inicial <input name="userPassword" type="password" [(ngModel)]="userPassword" minlength="8" required /></label><label>Perfil <select name="userRole" [(ngModel)]="userRole"><option value="signature_signer">Signatário</option><option value="signature_operator">Operador</option><option value="signature_auditor">Auditor</option><option value="signature_admin">Administrador</option></select><small class="role-help">{{ roleDescription() }}</small></label><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeUserModal()">Cancelar</button><button class="button" [disabled]="submitting()">Criar usuário</button></footer></form>
        </section></div>
      }

      @if (previewDocument()) { <div class="modal-backdrop pdf-backdrop" (click)="closePreview()"><section class="pdf-modal" (click)="$event.stopPropagation()"><header><div><strong>{{ previewHeading() }} · {{ previewDocument()!.title }}</strong><small>{{ previewDocument()!.original_filename }}</small></div><button class="modal-close" (click)="closePreview()" aria-label="Fechar">×</button></header><iframe [src]="previewUrl()" title="Visualização do PDF"></iframe></section></div> }
    </main>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly documents = signal<DocumentItem[]>([]);
  readonly requests = signal<SignatureRequest[]>([]);
  readonly signers = signal<Signer[]>([]);
  readonly signerOptions = signal<SignerOption[]>([]);
  readonly selectedDocument = signal<DocumentItem | null>(null);
  readonly selectedRequest = signal<SignatureRequest | null>(null);
  readonly selectedSigner = signal<SignerOption | null>(null);
  readonly requestLinks = signal<Record<string, string>>({});
  readonly requestEvidence = signal<SignatureEvidence[]>([]);
  readonly previewDocument = signal<DocumentItem | null>(null);
  readonly previewUrl = signal<SafeResourceUrl>('');
  readonly previewHeading = signal('Documento original');
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly detailsLoading = signal(false);
  readonly uploadModalOpen = signal(false);
  readonly requestCreateModalOpen = signal(false);
  readonly requestModalOpen = signal(false);
  readonly userModalOpen = signal(false);

  requestFilter = 'all';
  signerSearch = '';
  signerPickerOpen = false;
  title = '';
  organization = 'default';
  expiresAt = '';
  userName = '';
  userCpf = '';
  userEmail = '';
  userPassword = '';
  userRole = 'signature_signer';
  file: File | null = null;
  private previewObjectUrl = '';

  constructor(readonly auth: AuthService, private readonly api: ApiService, private readonly router: Router, private readonly sanitizer: DomSanitizer, private readonly feedback: FeedbackService) {}

  async ngOnInit(): Promise<void> { const context = await this.auth.restore(); if (!context) { await this.router.navigate(['/login']); return; } try { if (this.canManage()) await Promise.all([this.reload(), this.loadSignerOptions()]); } catch (error) { await this.feedback.error(error, 'Não foi possível carregar o dashboard'); } finally { this.loading.set(false); } }
  canManage(): boolean { return this.auth.can('documents:write') && this.auth.can('signature_requests:write'); }
  isAdmin(): boolean { const context = this.auth.context(); return context?.roles.includes('signature_admin') === true || context?.permission_keys.includes('*') === true; }
  hasSignedSigners(): boolean { return this.signers().some((signer) => signer.status === 'signed'); }
  openRequestsCount(): number { return this.requests().filter((item) => item.status === 'open').length; }
  completedRequestsCount(): number { return this.requests().filter((item) => item.status === 'completed').length; }
  visibleRequests(): SignatureRequest[] { return this.requests().filter((item) => this.requestFilter === 'all' || item.status === this.requestFilter); }
  filteredSignerOptions(): SignerOption[] { const query = this.signerSearch.trim().toLowerCase(); const assigned = new Set(this.signers().map((item) => item.email)); return this.signerOptions().filter((item) => !assigned.has(item.email) && (!query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query))).slice(0, 10); }
  requestLink(): string { const request = this.selectedRequest(); return request ? this.requestLinks()[request.id] || '' : ''; }
  documentTitle(documentId: string): string { return this.documents().find((item) => item.id === documentId)?.title || `Documento #${documentId}`; }
  requestStatusLabel(status: string): string { return ({ draft: 'Rascunho', open: 'Em assinatura', completed: 'Concluída', cancelled: 'Cancelada', expired: 'Expirada' } as Record<string, string>)[status] || status; }
  signerStatusLabel(status: string): string { return ({ pending: 'Pendente', viewed: 'Visualizado', signed: 'Assinado', declined: 'Recusado' } as Record<string, string>)[status] || status; }
  roleDescription(): string { return ({ signature_signer: 'Assina somente os documentos em que foi incluído.', signature_operator: 'Gerencia documentos, solicitações e signatários.', signature_auditor: 'Consulta documentos e evidências sem alterar o fluxo.', signature_admin: 'Acesso total, incluindo usuários e configurações administrativas.' } as Record<string, string>)[this.userRole] || ''; }
  signatureProgress(request: SignatureRequest): number { return request.signer_count ? Math.round(request.signed_count / request.signer_count * 100) : 0; }

  showUploadModal(): void { this.uploadModalOpen.set(true); }
  closeUploadModal(): void { this.uploadModalOpen.set(false); }
  showUserModal(): void { this.userModalOpen.set(true); }
  closeUserModal(): void { this.userModalOpen.set(false); }
  closeRequestCreateModal(): void { this.requestCreateModalOpen.set(false); }
  closeRequestModal(): void { this.requestModalOpen.set(false); this.signerPickerOpen = false; }
  selectFile(event: Event): void { this.setFile((event.target as HTMLInputElement).files?.item(0) ?? null); }
  dropFile(event: DragEvent): void { event.preventDefault(); this.setFile(event.dataTransfer?.files.item(0) ?? null); }
  selectSigner(user: SignerOption): void { this.selectedSigner.set(user); this.signerSearch = `${user.name} · ${user.email}`; this.signerPickerOpen = false; }
  closeSignerPicker(event: FocusEvent): void { const container = event.currentTarget as HTMLElement; if (!container.contains(event.relatedTarget as Node | null)) this.signerPickerOpen = false; }
  prepareRequest(document: DocumentItem): void { this.selectedDocument.set(document); const date = new Date(); date.setDate(date.getDate() + 3); this.expiresAt = this.localDateTime(date); this.requestCreateModalOpen.set(true); }
  async openRequestDetails(request: SignatureRequest): Promise<void> { this.selectedRequest.set(request); this.selectedDocument.set(null); this.selectedSigner.set(null); this.signerSearch = ''; this.requestEvidence.set([]); this.requestModalOpen.set(true); this.detailsLoading.set(true); try { await this.loadSigners(request.id); if (this.isAdmin()) await this.loadAdminRequestDetails(request); } catch (error) { await this.feedback.error(error, 'Não foi possível carregar os detalhes'); } finally { this.detailsLoading.set(false); } }

  preview(document: DocumentItem): void { this.releasePreviewObjectUrl(); this.previewHeading.set('Documento original'); this.previewDocument.set(document); this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`/documents/${document.id}/preview?version=${document.version}`)); }
  async previewSignedRequest(): Promise<void> { const request = this.selectedRequest(); const document = this.documents().find(item => item.id === request?.document_id); if (!request || !document) return; await this.run(async () => { const response = await firstValueFrom(this.api.getBlob(`/signature-requests/${request.id}/signed-document`)); this.releasePreviewObjectUrl(); this.previewObjectUrl = URL.createObjectURL(response.body!); this.previewHeading.set('PDF assinado e carimbado'); this.previewDocument.set(document); this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl)); }); }
  closePreview(): void { this.previewDocument.set(null); this.previewUrl.set(''); this.releasePreviewObjectUrl(); }
  async deleteDocument(document: DocumentItem): Promise<void> { const result = await Swal.fire({ icon: 'warning', title: 'Excluir documento?', text: 'Ele sairá da lista, mas a trilha de auditoria e o arquivo serão preservados.', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#b42318' }); if (!result.isConfirmed) return; await this.run(async () => { await firstValueFrom(this.api.delete(`/documents/${document.id}`)); this.documents.update((items) => items.filter((item) => item.id !== document.id)); }); }

  async upload(): Promise<void> { if (!this.file) return; await this.run(async () => { await firstValueFrom(this.api.postFile<DocumentItem>('/documents', this.file!, { organization_id: this.organization, title: this.title, filename: this.file!.name, content_type: this.file!.type || 'application/pdf' })); this.title = ''; this.file = null; this.closeUploadModal(); await this.reload(); await Swal.fire({ icon: 'success', title: 'Documento enviado', timer: 1500, showConfirmButton: false }); }); }
  async createRequest(): Promise<void> { const document = this.selectedDocument(); if (!document || !this.expiresAt) return; await this.run(async () => { const request = await firstValueFrom(this.api.post<SignatureRequest>('/signature-requests', { document_id: document.id, expires_at: new Date(this.expiresAt).toISOString() })); this.requests.update((items) => [request, ...items]); this.closeRequestCreateModal(); await this.openRequestDetails(request); }); }
  async addSigner(): Promise<void> { const request = this.selectedRequest(); const user = this.selectedSigner(); if (!request || !user) return; await this.run(async () => { await firstValueFrom(this.api.post<Signer>(`/signature-requests/${request.id}/signers`, { name: user.name, email: user.email })); this.selectedSigner.set(null); this.signerSearch = ''; await this.loadSigners(request.id); const refreshed = await firstValueFrom(this.api.get<SignatureRequest>(`/signature-requests/${request.id}`)); this.updateRequest(refreshed); }); }
  async openRequest(): Promise<void> { const request = this.selectedRequest(); if (!request) return; const result = await Swal.fire({ icon: 'question', title: 'Abrir para assinatura?', text: 'A versão será congelada e não aceitará novos signatários.', showCancelButton: true, confirmButtonText: 'Abrir solicitação', cancelButtonText: 'Voltar', confirmButtonColor: '#187a66' }); if (!result.isConfirmed) return; await this.run(async () => { const opened = await firstValueFrom(this.api.post<SignatureRequest>(`/signature-requests/${request.id}/open`, {})); this.updateRequest(opened); const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  async generateLink(): Promise<void> { const request = this.selectedRequest(); if (!request) return; if (this.requestLink()) { const result = await Swal.fire({ icon: 'warning', title: 'Rotacionar link?', text: 'O link anterior deixará de funcionar.', showCancelButton: true, confirmButtonText: 'Rotacionar', cancelButtonText: 'Cancelar', confirmButtonColor: '#b42318' }); if (!result.isConfirmed) return; } await this.run(async () => { const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  async createUser(): Promise<void> { await this.run(async () => { const user = await firstValueFrom(this.api.post<UserCreated>('/users', { name: this.userName, cpf: this.userCpf, email: this.userEmail, password: this.userPassword, role: this.userRole })); if (['signature_signer', 'signature_admin'].includes(user.role)) await this.loadSignerOptions(); this.userName = ''; this.userCpf = ''; this.userEmail = ''; this.userPassword = ''; this.closeUserModal(); await Swal.fire({ icon: 'success', title: 'Usuário criado', text: `${user.name} já pode acessar o Rubrica.`, timer: 1800, showConfirmButton: false }); }); }
  async copyInvite(): Promise<void> { await this.run(async () => { await navigator.clipboard.writeText(this.requestLink()); await Swal.fire({ icon: 'success', title: 'Link copiado', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false }); }); }
  openInvite(): void { const link = this.requestLink(); if (link) window.open(link, '_blank', 'noopener,noreferrer'); }
  async showEvidence(): Promise<void> { const rows = this.requestEvidence(); if (!rows.length) { await this.feedback.warning('Ainda não há evidências disponíveis para esta solicitação.'); return; } const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!)); const html = rows.map(row => `<section style="text-align:left;margin-bottom:1rem"><strong>${escape(row.signer_name)}</strong><br><small>${escape(row.signed_at)}</small><pre style="white-space:pre-wrap;max-height:260px;overflow:auto;background:#f4f6f8;padding:.75rem">${escape(JSON.stringify(row, null, 2))}</pre></section>`).join(''); await Swal.fire({ title: 'Evidências da assinatura', html, width: 850, confirmButtonText: 'Fechar', confirmButtonColor: '#187a66' }); }
  async logout(): Promise<void> { try { await this.auth.logout(); } catch (error) { await this.feedback.error(error, 'Não foi possível encerrar a sessão no servidor'); } finally { await this.router.navigate(['/login']); } }

  private updateRequest(request: SignatureRequest): void { this.requests.update((items) => items.map((item) => item.id === request.id ? request : item)); this.selectedRequest.set(request); }
  private localDateTime(date: Date): string { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }
  private async reload(): Promise<void> { const [documents, requests] = await Promise.all([firstValueFrom(this.api.get<DocumentItem[]>('/documents')), firstValueFrom(this.api.get<SignatureRequest[]>('/signature-requests'))]); this.documents.set(documents); this.requests.set(requests.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))); }
  private async loadSigners(requestId: string): Promise<void> { this.signers.set(await firstValueFrom(this.api.get<Signer[]>(`/signature-requests/${requestId}/signers`))); }
  private async loadSignerOptions(): Promise<void> { this.signerOptions.set(await firstValueFrom(this.api.get<SignerOption[]>('/users/signers'))); }
  private async loadAdminRequestDetails(request: SignatureRequest): Promise<void> { const [link, evidence] = await Promise.allSettled([firstValueFrom(this.api.get<SigningLink>(`/signature-requests/${request.id}/signing-link`)), firstValueFrom(this.api.get<SignatureEvidence[]>(`/signature-requests/${request.id}/evidence`))]); if (link.status === 'fulfilled') this.requestLinks.update(items => ({ ...items, [request.id]: link.value.signing_url })); if (evidence.status === 'fulfilled') this.requestEvidence.set(evidence.value); }
  private releasePreviewObjectUrl(): void { if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl); this.previewObjectUrl = ''; }
  private async run(action: () => Promise<void>): Promise<void> { this.submitting.set(true); try { await action(); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  private setFile(file: File | null): void { if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { void this.feedback.warning('Somente arquivos PDF podem ser enviados.', 'Arquivo inválido'); return; } this.file = file; }
}
