import { DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { BillingAccount, DocumentItem, SignatureEvidence, SignatureRequest, Signer, SignerOption, SigningLink, TenantItem, UserCreated } from '../core/models';
import { dateTime } from '../core/date-time';
import { I18nService, Locale } from '../core/i18n.service';

@Component({
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  template: `
    <main class="shell">
      <header class="topbar">
        <div class="brand">Rubrica<span>.</span></div>
        <div class="topbar-account"><select [ngModel]="i18n.locale()" (ngModelChange)="changeLocale($event)" [attr.aria-label]="i18n.text('language')"><option value="pt-BR">Português</option><option value="en">English</option><option value="ja-JP">日本語</option></select><span class="user-chip">{{ auth.context()?.subject }}</span><button class="button ghost" (click)="security()">{{ i18n.text('dashboardSecurity') }}</button><button class="button ghost" (click)="logout()">{{ i18n.text('logout') }}</button></div>
      </header>

      <section class="container dashboard-container">
        @if (loading()) {
          <p class="notice">{{ i18n.text('workspaceLoading') }}</p>
        } @else if (!canManage()) {
          <section class="card empty-state"><h1>{{ i18n.text('connected') }}</h1><p class="muted">{{ i18n.text('signerLinkHelp') }}</p></section>
        } @else {
          <header class="dashboard-header">
            <div><p class="eyebrow">{{ i18n.text('overview') }}</p><h1>{{ i18n.text('signatureCenter') }}</h1><p class="muted">{{ i18n.text('dashboardHelp') }}</p></div>
            <div class="header-actions">@if (isAdmin()) { <button class="button secondary" (click)="billing()"><i class="bi bi-credit-card"></i> {{ i18n.text('billing') }}</button><button class="button" (click)="showUserModal()">{{ i18n.text('newUser') }}</button> }</div>
          </header>

          <section class="stats-grid" aria-label="Resumo">
            <article class="stat-card"><span>{{ i18n.text('documentsPlural') }}</span><strong>{{ documents().length }}</strong><small>{{ i18n.text('filesAvailable') }}</small></article>
            <article class="stat-card accent"><span>{{ i18n.text('inSigning') }}</span><strong>{{ openRequestsCount() }}</strong><small>{{ i18n.text('openRequests') }}</small></article>
            <article class="stat-card"><span>{{ i18n.text('completedPlural') }}</span><strong>{{ completedRequestsCount() }}</strong><small>{{ i18n.text('finishedProcesses') }}</small></article>
          </section>

          @if (isAdmin() && tenants().length) {
            <article class="card table-card">
              <div class="section-heading"><div><p class="eyebrow">{{ i18n.text('planUsage') }}</p><h2>{{ i18n.text('signaturesByAccount') }}</h2><p class="muted">{{ i18n.text('usageHelp') }}</p></div></div>
              <div class="table-wrap"><table class="data-table"><thead><tr><th>{{ i18n.text('account') }}</th><th>{{ i18n.text('plan') }}</th><th>{{ i18n.text('usage') }}</th><th>{{ i18n.text('availableNow') }}</th></tr></thead><tbody>
                @for (tenant of tenants(); track tenant.id) {
                  <tr><td><strong>{{ tenant.name }}</strong></td><td><span class="badge" [class.complete]="billingFor(tenant.id)?.unlimited_signatures">{{ billingFor(tenant.id)?.unlimited_signatures ? i18n.text('unlimited') : i18n.text('free') }}</span></td><td>{{ i18n.text('signatures', { count: billingFor(tenant.id)?.signatures_used ?? 0 }) }}</td><td><strong>{{ billingAvailability(tenant.id) }}</strong></td></tr>
                }
              </tbody></table></div>
            </article>
          }

          <article class="card table-card">
            <div class="section-heading">
              <div><p class="eyebrow">{{ i18n.text('monitoring') }}</p><h2>{{ i18n.text('requests') }}</h2><p class="muted">{{ i18n.text('requestsHelp') }}</p></div>
              <label class="filter-label">{{ i18n.text('show') }}<select [(ngModel)]="requestFilter"><option value="all">{{ i18n.text('all') }}</option><option value="open">{{ i18n.text('open') }}</option><option value="draft">{{ i18n.text('drafts') }}</option><option value="completed">{{ i18n.text('completedPlural') }}</option></select></label>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>{{ i18n.text('request') }}</th><th>{{ i18n.text('document') }}</th><th>{{ i18n.text('status') }}</th><th>{{ i18n.text('signaturesLabel') }}</th><th>{{ i18n.text('deadline') }}</th><th class="actions-column">{{ i18n.text('actions') }}</th></tr></thead>
                <tbody>
                  @for (request of visibleRequests(); track request.id) {
                    <tr>
                      <td [attr.data-label]="i18n.text('request')"><strong>#{{ request.id }}</strong></td>
                      <td [attr.data-label]="i18n.text('document')"><div class="document-cell"><strong>{{ request.document_title }}</strong><small>{{ request.original_filename }} · {{ i18n.text('version') }} {{ request.document_version }}</small></div></td>
                      <td data-label="Status"><span class="badge" [class.pending]="request.status === 'draft'" [class.complete]="request.status === 'completed'">{{ requestStatusLabel(request.status) }}</span></td>
                      <td><div class="progress-cell"><strong>{{ i18n.text('of', { current: request.signed_count, total: request.signer_count }) }}</strong><span class="progress-track"><i [style.width.%]="signatureProgress(request)"></i></span></div></td>
                      <td>{{ i18n.formatDate(request.expires_at) }}</td>
                      <td><div class="table-actions"><button class="button secondary compact" (click)="openRequestDetails(request)">{{ i18n.text('details') }}</button></div></td>
                    </tr>
                  } @empty { <tr><td colspan="6"><div class="empty-state"><strong>{{ i18n.text('noRequests') }}</strong><span>{{ i18n.text('filterHelp') }}</span></div></td></tr> }
                </tbody>
              </table>
            </div>
          </article>

          <article class="card table-card">
            <div class="section-heading"><div><p class="eyebrow">{{ i18n.text('collection') }}</p><h2>{{ i18n.text('documentsPlural') }}</h2><p class="muted">{{ i18n.text('documentsHelp') }}</p></div><button class="button secondary" (click)="showUploadModal()">{{ i18n.text('uploadPdf') }}</button></div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>{{ i18n.text('document') }}</th><th>{{ i18n.text('file') }}</th><th>{{ i18n.text('version') }}</th><th>{{ i18n.text('status') }}</th><th class="actions-column">{{ i18n.text('actions') }}</th></tr></thead>
                <tbody>
                  @for (document of documents(); track document.id) {
                    <tr>
                      <td><div class="document-cell"><strong>{{ document.title }}</strong><small>{{ i18n.text('signedCount', { count: document.completed_signature_count }) }}</small></div></td>
                      <td data-label="Arquivo"><span class="file-name">{{ document.original_filename }}</span><small>{{ fileSize(document.size_bytes) }}</small></td>
                      <td [attr.data-label]="i18n.text('version')">{{ document.version }}</td>
                      <td><span class="badge">{{ document.status === 'ready' ? i18n.text('ready') : document.status }}</span><small>{{ i18n.text('requestCount', { count: document.signature_request_count }) }}</small></td>
                      <td><div class="table-actions"><button class="button secondary compact" (click)="preview(document)">{{ i18n.text('view') }}</button><button class="button secondary compact" (click)="prepareRequest(document)">{{ i18n.text('requestSignature') }}</button><button class="button compact danger" (click)="deleteDocument(document)">{{ i18n.text('deleteAction') }}</button></div></td>
                    </tr>
                  } @empty { <tr><td colspan="5"><div class="empty-state"><strong>{{ i18n.text('noDocuments') }}</strong><span>{{ i18n.text('firstPdf') }}</span></div></td></tr> }
                </tbody>
              </table>
            </div>
          </article>
        }
      </section>

      @if (uploadModalOpen()) {
        <div class="modal-backdrop" (click)="closeUploadModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">{{ i18n.text('newFile') }}</p><h2>{{ i18n.text('uploadDocument') }}</h2></div><button class="modal-close" (click)="closeUploadModal()" [attr.aria-label]="i18n.text('close')">×</button></header>
          <form class="modal-body form" (ngSubmit)="upload()"><label>{{ i18n.text('title') }} <input name="title" [(ngModel)]="title" required /></label><label>{{ i18n.text('organization') }} <input name="organization" [(ngModel)]="organization" required /></label><input #filePicker class="sr-only" type="file" accept="application/pdf,.pdf" (change)="selectFile($event)" /><div class="dropzone" [class.has-file]="file" (click)="filePicker.click()" (dragover)="$event.preventDefault()" (drop)="dropFile($event)"><span class="dropzone-icon">⇧</span>@if (file) { <strong>{{ file.name }}</strong><small>{{ file.size / 1024 / 1024 | number:'1.0-2' }} MB · {{ i18n.text('clickChange') }}</small> } @else { <strong>{{ i18n.text('dragPdf') }}</strong><small>{{ i18n.text('chooseFile') }}</small> }</div><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeUploadModal()">{{ i18n.text('cancel') }}</button><button class="button" [disabled]="!file || submitting()">{{ i18n.text('uploadFile') }}</button></footer></form>
        </section></div>
      }

      @if (requestCreateModalOpen() && selectedDocument()) {
        <div class="modal-backdrop" (click)="closeRequestCreateModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">{{ i18n.text('newRequest') }}</p><h2>{{ selectedDocument()!.title }}</h2><span class="muted">{{ selectedDocument()!.original_filename }}</span></div><button class="modal-close" (click)="closeRequestCreateModal()" [attr.aria-label]="i18n.text('close')">×</button></header>
          <form class="modal-body form" (ngSubmit)="createRequest()"><p class="notice">{{ i18n.text('draftHelp') }}</p><label>{{ i18n.text('signingDeadline') }} <input type="datetime-local" name="expires" [(ngModel)]="expiresAt" required /></label><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeRequestCreateModal()">{{ i18n.text('cancel') }}</button><button class="button" [disabled]="submitting()">{{ i18n.text('createRequest') }}</button></footer></form>
        </section></div>
      }

      @if (requestModalOpen() && selectedRequest()) {
        <div class="modal-backdrop" (click)="closeRequestModal()"><section class="app-modal wide" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">{{ i18n.text('request') }} #{{ selectedRequest()!.id }}</p><h2>{{ selectedRequest()!.document_title }}</h2><span class="badge" [class.pending]="selectedRequest()!.status === 'draft'" [class.complete]="selectedRequest()!.status === 'completed'">{{ requestStatusLabel(selectedRequest()!.status) }}</span></div><button class="modal-close" (click)="closeRequestModal()" [attr.aria-label]="i18n.text('close')">×</button></header>
          <div class="modal-body">
            @if (detailsLoading()) { <p class="notice">{{ i18n.text('loadingDetails') }}</p> } @else {
              <div class="metric-strip"><div><small>{{ i18n.text('signaturesLabel') }}</small><strong>{{ selectedRequest()!.signed_count }}/{{ selectedRequest()!.signer_count }}</strong></div><div><small>{{ i18n.text('version') }}</small><strong>{{ selectedRequest()!.document_version }}</strong></div><div><small>{{ i18n.text('deadline') }}</small><strong>{{ i18n.formatDate(selectedRequest()!.expires_at) }}</strong></div></div>
              <div class="details-grid">
                <section class="detail-panel"><div class="panel-heading"><div><h3>{{ i18n.text('signers') }}</h3><p class="muted">{{ i18n.text('linkedPeople') }}</p></div></div><div class="signer-list">@for (signer of signers(); track signer.id) { <div class="signer-row"><div><strong>{{ signer.name }}</strong><small>{{ signer.email }}</small>@if (signer.signed_at) { <small>{{ i18n.text('signedAt', { date: i18n.formatDate(signer.signed_at) }) }}</small> }</div><span class="badge" [class.pending]="signer.status === 'pending' || signer.status === 'viewed'" [class.complete]="signer.status === 'signed'">{{ signerStatusLabel(signer.status) }}</span></div> } @empty { <div class="empty-state compact-empty"><strong>{{ i18n.text('noSigner') }}</strong><span>{{ i18n.text('addBeforeOpen') }}</span></div> }</div></section>
                <section class="detail-panel action-panel">
                  @if (selectedRequest()!.status === 'draft') {
                    <div><h3>{{ i18n.text('addSigner') }}</h3><p class="muted">{{ i18n.text('searchRegistered') }}</p></div>
                    <form class="form" (ngSubmit)="addSigner()"><label>{{ i18n.text('user') }}<div class="autocomplete" (focusout)="closeSignerPicker($event)" (keydown.escape)="signerPickerOpen = false"><input name="signerSearch" [(ngModel)]="signerSearch" (focus)="signerPickerOpen = true" (input)="selectedSigner.set(null); signerPickerOpen = true" [placeholder]="i18n.text('nameOrEmail')" autocomplete="off" />@if (signerPickerOpen) { <div class="autocomplete-menu">@for (user of filteredSignerOptions(); track user.id) { <button type="button" (click)="selectSigner(user)"><strong>{{ user.name }}</strong><small>{{ user.email }}</small></button> } @empty { <p>{{ i18n.text('noUser') }}</p> }</div> }</div></label>@if (selectedSigner()) { <p class="selected-option">{{ selectedSigner()!.name }} · {{ selectedSigner()!.email }}</p> }<button class="button" [disabled]="submitting() || !selectedSigner()">{{ i18n.text('add') }}</button></form><hr /><button class="button secondary full-width" (click)="openRequest()" [disabled]="submitting() || !signers().length">{{ i18n.text('openForSigning') }}</button>
                  } @else {
                    <div><h3>{{ i18n.text('documentAccess') }}</h3><p class="muted">{{ i18n.text('shareUnique') }}</p></div>
                    @if (requestLink()) { <div class="link-panel"><small>{{ i18n.text('uniqueLink') }}</small><span>{{ requestLink() }}</span></div><div class="button-row"><button class="button secondary compact" (click)="copyInvite()">{{ i18n.text('copyLink') }}</button><button class="button secondary compact" (click)="openInvite()">{{ i18n.text('openLink') }}</button></div> } @else { <p class="notice">{{ i18n.text('noRecoverableLink') }}</p> }
                    @if (selectedRequest()!.status === 'open' || (isAdmin() && selectedRequest()!.status === 'completed' && !requestLink())) { <button class="button secondary full-width" (click)="generateLink()" [disabled]="submitting()">{{ requestLink() ? i18n.text('rotateLink') : selectedRequest()!.status === 'completed' ? i18n.text('historicalLink') : i18n.text('generateLink') }}</button> }
                    @if (isAdmin() && hasSignedSigners()) { <hr /><div><h3>{{ i18n.text('completedDocument') }}</h3><p class="muted">{{ i18n.text('artifactHelp') }}</p></div><div class="button-row"><button class="button secondary compact" (click)="previewSignedRequest()">{{ i18n.text('viewSignedPdf') }}</button><button class="button secondary compact" (click)="showEvidence()">{{ i18n.text('viewEvidence') }}</button></div> }
                  }
                </section>
              </div>
            }
          </div>
        </section></div>
      }

      @if (userModalOpen()) {
        <div class="modal-backdrop" (click)="closeUserModal()"><section class="app-modal" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><p class="eyebrow">{{ i18n.text('access') }}</p><h2>{{ i18n.text('newUser') }}</h2><span class="muted">{{ i18n.text('newUserHelp') }}</span></div><button class="modal-close" (click)="closeUserModal()" [attr.aria-label]="i18n.text('close')">×</button></header>
          <form class="modal-body form" (ngSubmit)="createUser()"><div class="form-row"><label>{{ i18n.text('name') }} <input name="userName" [(ngModel)]="userName" required /></label><label>{{ i18n.text('email') }} <input name="userEmail" type="email" [(ngModel)]="userEmail" required /></label></div><label>{{ i18n.text('initialPassword') }} <input name="userPassword" type="password" [(ngModel)]="userPassword" minlength="8" required /></label><fieldset class="form"><legend>{{ i18n.text('identityOptional') }}</legend><div class="form-row"><label>{{ i18n.text('issuerCountry') }} <input name="userIdentityCountry" [(ngModel)]="userIdentityCountry" (ngModelChange)="userIdentityCountryChanged()" list="admin-country-options" maxlength="2" placeholder="BR, JP, PT…" /></label><label>{{ i18n.text('type') }} <select name="userIdentityType" [(ngModel)]="userIdentityType" [disabled]="!userIdentityCountry">@for (option of userIdentityOptions(); track option.value) { <option [value]="option.value">{{ option.label }}</option> }</select></label></div><datalist id="admin-country-options"><option value="BR">{{ i18n.text('brazil') }}</option><option value="JP">{{ i18n.text('japan') }}</option><option value="PT">{{ i18n.text('portugal') }}</option><option value="US">{{ i18n.text('unitedStates') }}</option></datalist>@if (userIdentityCountry) { <label>{{ i18n.text('documentNumber') }} <input name="userIdentityValue" [(ngModel)]="userIdentityValue" minlength="4" maxlength="80" autocomplete="off" required /><small>{{ i18n.text('encryptedIdentityHelp') }}</small></label> }</fieldset><label>{{ i18n.text('profile') }} <select name="userRole" [(ngModel)]="userRole"><option value="signature_signer">{{ i18n.text('signerRole') }}</option><option value="signature_operator">{{ i18n.text('operatorRole') }}</option><option value="signature_auditor">{{ i18n.text('auditorRole') }}</option><option value="signature_admin">{{ i18n.text('administratorRole') }}</option></select><small class="role-help">{{ roleDescription() }}</small></label><footer class="modal-footer"><button type="button" class="button secondary" (click)="closeUserModal()">{{ i18n.text('cancel') }}</button><button class="button" [disabled]="submitting()">{{ i18n.text('createUserAction') }}</button></footer></form>
        </section></div>
      }

      @if (previewDocument()) { <div class="modal-backdrop pdf-backdrop" (click)="closePreview()"><section class="pdf-modal" (click)="$event.stopPropagation()"><header><div><strong>{{ previewHeading() }} · {{ previewDocument()!.title }}</strong><small>{{ previewDocument()!.original_filename }}</small></div><button class="modal-close" (click)="closePreview()" [attr.aria-label]="i18n.text('close')">×</button></header><iframe [src]="previewUrl()" [title]="i18n.text('view')"></iframe></section></div> }
    </main>
  `,
})
export class DashboardPageComponent implements OnInit {
  readonly documents = signal<DocumentItem[]>([]);
  readonly requests = signal<SignatureRequest[]>([]);
  readonly signers = signal<Signer[]>([]);
  readonly signerOptions = signal<SignerOption[]>([]);
  readonly tenants = signal<TenantItem[]>([]);
  readonly billingAccounts = signal<Record<string, BillingAccount>>({});
  readonly selectedDocument = signal<DocumentItem | null>(null);
  readonly selectedRequest = signal<SignatureRequest | null>(null);
  readonly selectedSigner = signal<SignerOption | null>(null);
  readonly requestLinks = signal<Record<string, string>>({});
  readonly requestEvidence = signal<SignatureEvidence[]>([]);
  readonly previewDocument = signal<DocumentItem | null>(null);
  readonly previewUrl = signal<SafeResourceUrl>('');
  readonly previewHeading = signal('');
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
  userIdentityCountry = '';
  userIdentityType = 'PASSPORT';
  userIdentityValue = '';
  userEmail = '';
  userPassword = '';
  userRole = 'signature_signer';
  file: File | null = null;
  private previewObjectUrl = '';
  private tenantId = '';

  constructor(readonly auth: AuthService, readonly i18n: I18nService, private readonly api: ApiService, private readonly route: ActivatedRoute, private readonly router: Router, private readonly sanitizer: DomSanitizer, private readonly feedback: FeedbackService) {}

  async ngOnInit(): Promise<void> { const context = await this.auth.restore(); if (!context) { await this.router.navigate(['/login']); return; } try { const dashboardUrl = await this.auth.dashboardUrl(); this.tenantId = dashboardUrl.split('/')[2] ?? ''; if (!this.route.snapshot.paramMap.get('tenantId') && this.tenantId) { await this.router.navigateByUrl(dashboardUrl, { replaceUrl: true }); return; } if (context.mfa_setup_required && !this.auth.isMfaDeferredForSession()) { await this.router.navigate(['/security']); return; } if (this.canManage()) await Promise.all([this.reload(), this.loadSignerOptions(), this.loadBilling()]); } catch (error) { await this.feedback.error(error, this.i18n.text('dashboardLoadFailed')); } finally { this.loading.set(false); } }
  security(): Promise<boolean> { return this.router.navigate(['/security']); }
  billing(): Promise<boolean> { return this.router.navigate(['/plan']); }
  changeLocale(locale: Locale): void { this.i18n.setLocale(locale); }
  canManage(): boolean { return this.auth.can('documents:write') && this.auth.can('signature_requests:write'); }
  isAdmin(): boolean { const context = this.auth.context(); return context?.roles.includes('signature_admin') === true || context?.permission_keys.includes('*') === true; }
  hasSignedSigners(): boolean { return this.signers().some((signer) => signer.status === 'signed'); }
  openRequestsCount(): number { return this.requests().filter((item) => item.status === 'open').length; }
  completedRequestsCount(): number { return this.requests().filter((item) => item.status === 'completed').length; }
  visibleRequests(): SignatureRequest[] { return this.requests().filter((item) => this.requestFilter === 'all' || item.status === this.requestFilter); }
  filteredSignerOptions(): SignerOption[] { const query = this.signerSearch.trim().toLowerCase(); const assigned = new Set(this.signers().map((item) => item.email)); return this.signerOptions().filter((item) => !assigned.has(item.email) && (!query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query))).slice(0, 10); }
  requestLink(): string {
    const request = this.selectedRequest();
    const storedLink = request ? this.requestLinks()[request.id] || '' : '';
    if (!storedLink) return '';
    const parsed = new URL(storedLink, window.location.origin);
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  fileSize(bytes: number | null): string { if (bytes === null) return this.i18n.text('unavailable'); if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  requestStatusLabel(status: string): string { const keys = { draft: 'drafts', open: 'inSigning', completed: 'completedPlural', cancelled: 'cancelled', expired: 'expired' } as const; return status in keys ? this.i18n.text(keys[status as keyof typeof keys]) : status; }
  signerStatusLabel(status: string): string { const keys = { pending: 'pending', viewed: 'viewed', signed: 'signed', declined: 'declined' } as const; return status in keys ? this.i18n.text(keys[status as keyof typeof keys]) : status; }
  roleDescription(): string { const keys = { signature_signer:'signerRoleHelp', signature_operator:'operatorRoleHelp', signature_auditor:'auditorRoleHelp', signature_admin:'administratorRoleHelp' } as const; return this.userRole in keys ? this.i18n.text(keys[this.userRole as keyof typeof keys]) : ''; }
  signatureProgress(request: SignatureRequest): number { return request.signer_count ? Math.round(request.signed_count / request.signer_count * 100) : 0; }
  billingFor(tenantId: string): BillingAccount | null { return this.billingAccounts()[tenantId] ?? null; }
  billingAvailability(tenantId: string): string { const account = this.billingFor(tenantId); if (!account) return this.i18n.text('unavailable'); return account.unlimited_signatures ? this.i18n.text('unlimited') : this.i18n.text('remainingOf', { remaining: account.signatures_remaining ?? 0, limit: account.free_signatures_limit }); }

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
  prepareRequest(document: DocumentItem): void { this.selectedDocument.set(document); this.expiresAt = dateTime.localInputAfterDays(3); this.requestCreateModalOpen.set(true); }
  async openRequestDetails(request: SignatureRequest): Promise<void> { this.selectedRequest.set(request); this.selectedDocument.set(null); this.selectedSigner.set(null); this.signerSearch = ''; this.requestEvidence.set([]); this.requestModalOpen.set(true); this.detailsLoading.set(true); try { await this.loadSigners(request.id); if (this.isAdmin()) await this.loadAdminRequestDetails(request); } catch (error) { await this.feedback.error(error, this.i18n.text('detailsLoadFailed')); } finally { this.detailsLoading.set(false); } }

  preview(document: DocumentItem): void { this.releasePreviewObjectUrl(); this.previewHeading.set(this.i18n.text('originalDocument')); this.previewDocument.set(document); this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`/documents/${document.id}/preview?version=${document.version}`)); }
  async previewSignedRequest(): Promise<void> { const request = this.selectedRequest(); const document = this.documents().find(item => item.id === request?.document_id); if (!request || !document) return; await this.run(async () => { const response = await firstValueFrom(this.api.getBlob(`/signature-requests/${request.id}/signed-document`)); this.releasePreviewObjectUrl(); this.previewObjectUrl = URL.createObjectURL(response.body!); this.previewHeading.set(this.i18n.text('stampedPdf')); this.previewDocument.set(document); this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl)); }); }
  closePreview(): void { this.previewDocument.set(null); this.previewUrl.set(''); this.releasePreviewObjectUrl(); }
  async deleteDocument(document: DocumentItem): Promise<void> { const result = await Swal.fire({ icon: 'warning', title: this.i18n.text('deleteDocumentTitle'), text: this.i18n.text('deleteDocumentHelp'), showCancelButton: true, confirmButtonText: this.i18n.text('deleteAction'), cancelButtonText: this.i18n.text('cancel'), confirmButtonColor: '#b42318' }); if (!result.isConfirmed) return; await this.run(async () => { await firstValueFrom(this.api.delete(`/documents/${document.id}`)); this.documents.update((items) => items.filter((item) => item.id !== document.id)); }); }

  async upload(): Promise<void> { if (!this.file) return; await this.run(async () => { await firstValueFrom(this.api.postFile<DocumentItem>('/documents', this.file!, { organization_id: this.organization, title: this.title, filename: this.file!.name, content_type: this.file!.type || 'application/pdf' })); this.title = ''; this.file = null; this.closeUploadModal(); await this.reload(); await Swal.fire({ icon: 'success', title: this.i18n.text('documentSent'), timer: 1500, showConfirmButton: false }); }); }
  async createRequest(): Promise<void> { const document = this.selectedDocument(); if (!document || !this.expiresAt) return; await this.run(async () => { const request = await firstValueFrom(this.api.post<SignatureRequest>('/signature-requests', { document_id: document.id, expires_at: dateTime.toUtcIso(this.expiresAt) })); this.requests.update((items) => [request, ...items]); this.closeRequestCreateModal(); await this.openRequestDetails(request); }); }
  async addSigner(): Promise<void> { const request = this.selectedRequest(); const user = this.selectedSigner(); if (!request || !user) return; await this.run(async () => { await firstValueFrom(this.api.post<Signer>(`/signature-requests/${request.id}/signers`, { name: user.name, email: user.email })); this.selectedSigner.set(null); this.signerSearch = ''; await this.loadSigners(request.id); const refreshed = await firstValueFrom(this.api.get<SignatureRequest>(`/signature-requests/${request.id}`)); this.updateRequest(refreshed); }); }
  async openRequest(): Promise<void> { const request = this.selectedRequest(); if (!request) return; const result = await Swal.fire({ icon: 'question', title: this.i18n.text('openRequestTitle'), text: this.i18n.text('openRequestHelp'), showCancelButton: true, confirmButtonText: this.i18n.text('openForSigning'), cancelButtonText: this.i18n.text('back'), confirmButtonColor: '#a82035' }); if (!result.isConfirmed) return; await this.run(async () => { const opened = await firstValueFrom(this.api.post<SignatureRequest>(`/signature-requests/${request.id}/open`, {})); this.updateRequest(opened); const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  async generateLink(): Promise<void> { const request = this.selectedRequest(); if (!request) return; if (this.requestLink()) { const result = await Swal.fire({ icon: 'warning', title: this.i18n.text('rotateLinkTitle'), text: this.i18n.text('rotateLinkHelp'), showCancelButton: true, confirmButtonText: this.i18n.text('rotateLink'), cancelButtonText: this.i18n.text('cancel'), confirmButtonColor: '#b42318' }); if (!result.isConfirmed) return; } await this.run(async () => { const link = await firstValueFrom(this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {})); this.requestLinks.update((items) => ({ ...items, [request.id]: link.signing_url })); }); }
  userIdentityOptions(): { value: string; label: string }[] { const option = (value: string, key: 'passport'|'nationalId'|'residenceCard'|'driverLicense'|'taxId'|'other'|'cpf'|'nif') => ({ value, label: this.i18n.text(key) }); if (this.userIdentityCountry === 'BR') return [option('BR_CPF','cpf'), option('PASSPORT','passport'), option('OTHER','other')]; if (this.userIdentityCountry === 'PT') return [option('PT_NIF','nif'), option('PASSPORT','passport'), option('OTHER','other')]; if (this.userIdentityCountry === 'JP') return [option('PASSPORT','passport'), option('RESIDENCE_CARD','residenceCard'), option('DRIVER_LICENSE','driverLicense'), option('OTHER','other')]; return [option('PASSPORT','passport'), option('NATIONAL_ID','nationalId'), option('RESIDENCE_CARD','residenceCard'), option('DRIVER_LICENSE','driverLicense'), option('TAX_ID','taxId'), option('OTHER','other')]; }
  userIdentityCountryChanged(): void { this.userIdentityCountry = this.userIdentityCountry.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2); this.userIdentityType = this.userIdentityOptions()[0]?.value ?? 'PASSPORT'; this.userIdentityValue = ''; }
  async createUser(): Promise<void> { await this.run(async () => { const hasIdentity = Boolean(this.userIdentityCountry); const user = await firstValueFrom(this.api.post<UserCreated>('/users', { name: this.userName, email: this.userEmail, password: this.userPassword, role: this.userRole, identity_document_country: hasIdentity ? this.userIdentityCountry : null, identity_document_type: hasIdentity ? this.userIdentityType : null, identity_document_value: hasIdentity ? this.userIdentityValue : null })); if (['signature_signer', 'signature_admin'].includes(user.role)) await this.loadSignerOptions(); this.userName = ''; this.userEmail = ''; this.userPassword = ''; this.userIdentityCountry = ''; this.userIdentityType = 'PASSPORT'; this.userIdentityValue = ''; this.closeUserModal(); await Swal.fire({ icon: 'success', title: this.i18n.text('userCreated'), text: this.i18n.text('userCreatedHelp', { name: user.name }), timer: 1800, showConfirmButton: false }); }); }
  async copyInvite(): Promise<void> { await this.run(async () => { await navigator.clipboard.writeText(this.requestLink()); await Swal.fire({ icon: 'success', title: this.i18n.text('linkCopied'), toast: true, position: 'top-end', timer: 1500, showConfirmButton: false }); }); }
  openInvite(): void { const link = this.requestLink(); if (link) window.open(link, '_blank', 'noopener,noreferrer'); }
  async showEvidence(): Promise<void> { const rows = this.requestEvidence(); if (!rows.length) { await this.feedback.warning(this.i18n.text('evidenceUnavailable')); return; } const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!)); const html = rows.map(row => `<section style="text-align:left;margin-bottom:1rem"><strong>${escape(row.signer_name)}</strong><br><small>${escape(this.i18n.formatDate(row.signed_at))}</small><pre style="white-space:pre-wrap;max-height:260px;overflow:auto;background:#f4f6f8;padding:.75rem">${escape(JSON.stringify(row, null, 2))}</pre></section>`).join(''); await Swal.fire({ title: this.i18n.text('signatureEvidence'), html, width: 850, confirmButtonText: this.i18n.text('close'), confirmButtonColor: '#a82035' }); }
  async logout(): Promise<void> { try { await this.auth.logout(); } catch (error) { await this.feedback.error(error, this.i18n.text('logoutFailed')); } finally { await this.router.navigate(['/login']); } }

  private updateRequest(request: SignatureRequest): void { this.requests.update((items) => items.map((item) => item.id === request.id ? request : item)); this.selectedRequest.set(request); }
  private async reload(): Promise<void> { const [documents, requests] = await Promise.all([firstValueFrom(this.api.get<DocumentItem[]>('/documents')), firstValueFrom(this.api.get<SignatureRequest[]>('/signature-requests'))]); this.documents.set(documents); this.requests.set(requests.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))); }
  private async loadSigners(requestId: string): Promise<void> { this.signers.set(await firstValueFrom(this.api.get<Signer[]>(`/signature-requests/${requestId}/signers`))); }
  private async loadSignerOptions(): Promise<void> { this.signerOptions.set(await firstValueFrom(this.api.get<SignerOption[]>('/users/signers'))); }
  private async loadBilling(): Promise<void> { if (!this.isAdmin()) return; const tenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants')); this.tenants.set(tenants); const results = await Promise.allSettled(tenants.map(async tenant => [tenant.id, await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${tenant.id}/account`))] as const)); const accounts: Record<string, BillingAccount> = {}; for (const result of results) if (result.status === 'fulfilled') accounts[result.value[0]] = result.value[1]; this.billingAccounts.set(accounts); }
  private async loadAdminRequestDetails(request: SignatureRequest): Promise<void> { const [link, evidence] = await Promise.allSettled([firstValueFrom(this.api.get<SigningLink>(`/signature-requests/${request.id}/signing-link`)), firstValueFrom(this.api.get<SignatureEvidence[]>(`/signature-requests/${request.id}/evidence`))]); if (link.status === 'fulfilled') this.requestLinks.update(items => ({ ...items, [request.id]: link.value.signing_url })); if (evidence.status === 'fulfilled') this.requestEvidence.set(evidence.value); }
  private releasePreviewObjectUrl(): void { if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl); this.previewObjectUrl = ''; }
  private async run(action: () => Promise<void>): Promise<void> { this.submitting.set(true); try { await action(); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  private setFile(file: File | null): void { if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { void this.feedback.warning(this.i18n.text('pdfOnly'), this.i18n.text('invalidFile')); return; } this.file = file; }
}
