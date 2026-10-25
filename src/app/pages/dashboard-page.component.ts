import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import {
  createPaginatedRowModel,
  createSortedRowModel,
  injectTable,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/angular-table';

import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import {
  TenantTeam,
  BillingAccount,
  DocumentItem,
  SignatureEvidence,
  SignatureMode,
  SignatureRequest,
  Signer,
  SignerContact,
  SigningLink,
  StampConfiguration,
  StampCustomization,
  StampPosition,
  TenantItem,
} from '../core/models';
import { dateTime } from '../core/date-time';
import { evidenceDownloadLabel, evidenceReportHtml } from '../core/evidence-report';
import { I18nService, Locale } from '../core/i18n.service';
import { detectClientPlatform, pdfUploadHelp } from '../core/pdf-upload-help';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { PdfStampViewerComponent } from '../components/pdf-stamp-viewer.component';
import { DateFilterComponent } from '../components/date-filter.component';
import {
  RubricaSelectComponent,
  RubricaSelectOption,
} from '../components/rubrica-select.component';
import { RubricaColorPickerComponent } from '../components/rubrica-color-picker.component';

const dashboardTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const requestTableColumns = [
  { accessorKey: 'id' },
  { accessorKey: 'document_title' },
  { accessorKey: 'status' },
  { accessorKey: 'signed_count' },
  { accessorKey: 'expires_at' },
  { accessorKey: 'created_at' },
];

const documentTableColumns = [
  { accessorKey: 'title' },
  { accessorKey: 'original_filename' },
  { accessorKey: 'status' },
  { accessorKey: 'created_at' },
  { accessorKey: 'id' },
];

@Component({
  standalone: true,
  imports: [
    WorkspaceSidebarComponent,
    DecimalPipe,
    FormsModule,
    LanguagePickerComponent,
    PdfStampViewerComponent,
    DateFilterComponent,
    RubricaSelectComponent,
    RubricaColorPickerComponent,
  ],
  template: `
    <main class="shell">
      <div class="workspace-layout">
        <app-workspace-sidebar [tenant]="selectedTenant()" />
        <section class="container dashboard-container">
          @if (loading()) {
            <p class="notice">{{ i18n.text('workspaceLoading') }}</p>
          } @else {
            <header class="dashboard-header">
              <div>
                <p class="eyebrow">{{ i18n.text('overview') }}</p>
                <h1>{{ i18n.text('signatureCenter') }}</h1>
                <p class="muted">{{ i18n.text('dashboardHelp') }}</p>
              </div>
            </header>

            <section class="stats-grid" [attr.aria-label]="i18n.text('overview')">
              <article class="stat-card">
                <span>{{ i18n.text('documentsPlural') }}</span
                ><strong>{{ documents().length }}</strong
                ><small>{{ i18n.text('filesAvailable') }}</small>
              </article>
              <article class="stat-card accent">
                <span>{{ i18n.text('inSigning') }}</span
                ><strong>{{ openRequestsCount() }}</strong
                ><small>{{ i18n.text('openRequests') }}</small>
              </article>
              <article class="stat-card">
                <span>{{ i18n.text('completedPlural') }}</span
                ><strong>{{ completedRequestsCount() }}</strong
                ><small>{{ i18n.text('finishedProcesses') }}</small>
              </article>
              <article class="stat-card">
                <span>{{ totalSignaturesLabel() }}</span
                ><strong>{{ totalSignaturesCount() }}</strong
                ><small>{{ i18n.text('signaturesLabel') }}</small>
              </article>
              @if (isAdmin() && selectedTenant(); as tenant) {
                <article class="stat-card">
                  <span class="stat-label"
                    >{{ monthlyAllowanceLabel() }}
                    <i
                      class="bi bi-info-circle info-tooltip"
                      tabindex="0"
                      [attr.aria-label]="i18n.text('usageHelp')"
                      [attr.data-tooltip]="i18n.text('usageHelp')"
                    ></i></span
                  ><strong>{{ billingQuotaSummary(tenant.id) }}</strong
                  ><small>{{ billingQuotaAvailable(tenant.id) }}</small>
                </article>
              }
            </section>

            <article class="card table-card" data-testid="signature-requests-table">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">{{ i18n.text('monitoring') }}</p>
                  <h2>{{ i18n.text('requests') }}</h2>
                  <p class="muted">{{ i18n.text('requestsHelp') }}</p>
                </div>
                <div class="list-toolbar">
                  <label
                    >{{ i18n.text('search')
                    }}<input
                      [(ngModel)]="requestSearch"
                      (ngModelChange)="resetRequestLimit()"
                      [placeholder]="i18n.text('nameOrFile')" /></label
                  ><app-date-filter
                    [label]="i18n.text('date')"
                    [(value)]="requestDate"
                    (valueChange)="resetRequestLimit()"
                  />
                  <div class="toolbar-field">
                    <span>{{ i18n.text('show') }}</span>
                    <details
                      class="toolbar-picker status-filter"
                      #requestStatusMenu
                      (toggle)="toolbarPickerToggled($event)"
                    >
                      <summary>
                        <span>{{ requestFilterLabel() }}</span
                        ><i class="bi bi-chevron-down picker-chevron" aria-hidden="true"></i>
                      </summary>
                      <div class="toolbar-options" role="listbox">
                        @for (option of requestFilterOptions(); track option.value) {
                          <button
                            type="button"
                            role="option"
                            [class.active]="requestFilter === option.value"
                            [attr.aria-selected]="requestFilter === option.value"
                            (click)="selectRequestFilter(option.value, requestStatusMenu)"
                          >
                            <span>{{ i18n.text(option.label) }}</span>
                            @if (requestFilter === option.value) {
                              <i class="bi bi-check2"></i>
                            }
                          </button>
                        }
                      </div>
                    </details>
                  </div>
                </div>
              </div>
              <div class="table-wrap">
                <table class="data-table request-data-table">
                  <thead>
                    <tr>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('id')">
                          {{ i18n.text('request') }}
                          <i [class]="sortIcon(requestSortDirection('id'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('document_title')">
                          {{ i18n.text('document') }}
                          <i [class]="sortIcon(requestSortDirection('document_title'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('status')">
                          {{ i18n.text('status') }}
                          <i [class]="sortIcon(requestSortDirection('status'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('signed_count')">
                          {{ i18n.text('signaturesLabel') }}
                          <i [class]="sortIcon(requestSortDirection('signed_count'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('expires_at')">
                          {{ i18n.text('deadline') }}
                          <i [class]="sortIcon(requestSortDirection('expires_at'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleRequestSort('created_at')">
                          {{ i18n.text('openedAt') }}
                          <i [class]="sortIcon(requestSortDirection('created_at'))"></i>
                        </button>
                      </th>
                      <th class="actions-column">{{ i18n.text('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of requestTable.getRowModel().rows; track row.id) {
                      @let request = row.original;
                      <tr
                        class="request-mobile-row"
                        [class.mobile-expanded]="mobileRequestExpanded(request.id)"
                      >
                        <td [attr.data-label]="i18n.text('request')">
                          <strong class="desktop-request-id">#{{ request.id }}</strong
                          ><button
                            type="button"
                            class="request-mobile-toggle"
                            (click)="toggleMobileRequest(request.id)"
                            [attr.aria-expanded]="mobileRequestExpanded(request.id)"
                          >
                            <span
                              ><strong>{{ request.document_title }}</strong
                              ><small
                                ><span
                                  class="badge"
                                  [class.pending]="request.status === 'draft'"
                                  [class.complete]="request.status === 'completed'"
                                  [class.expired]="request.status === 'expired'"
                                  >{{ requestStatusLabel(request.status) }}</span
                                >
                                ·
                                {{
                                  i18n.text('of', {
                                    current: request.signed_count,
                                    total: request.signer_count,
                                  })
                                }}</small
                              ></span
                            ><i class="bi bi-chevron-down" aria-hidden="true"></i>
                          </button>
                        </td>
                        <td [attr.data-label]="i18n.text('document')">
                          <div class="document-cell">
                            <strong>{{ request.document_title }}</strong
                            ><small>{{ request.original_filename }}</small>
                          </div>
                        </td>
                        <td data-label="Status">
                          <span
                            class="badge"
                            [class.pending]="request.status === 'draft'"
                            [class.complete]="request.status === 'completed'"
                            [class.expired]="request.status === 'expired'"
                            >{{ requestStatusLabel(request.status) }}</span
                          >
                        </td>
                        <td [attr.data-label]="i18n.text('signaturesLabel')">
                          <div class="progress-cell">
                            <strong>{{
                              i18n.text('of', {
                                current: request.signed_count,
                                total: request.signer_count,
                              })
                            }}</strong
                            ><span class="progress-track"
                              ><i [style.width.%]="signatureProgress(request)"></i
                            ></span>
                          </div>
                        </td>
                        <td [attr.data-label]="i18n.text('deadline')">
                          {{ i18n.formatDate(request.expires_at) }}
                        </td>
                        <td [attr.data-label]="i18n.text('openedAt')">
                          {{ i18n.formatDate(request.opened_at || request.created_at) }}
                        </td>
                        <td [attr.data-label]="i18n.text('actions')">
                          <div class="table-actions">
                            <button
                              class="button secondary compact"
                              (click)="openRequestDetails(request)"
                            >
                              {{ i18n.text('details') }}
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7">
                          <div class="empty-state">
                            <strong>{{ i18n.text('noRequests') }}</strong
                            ><span>{{ i18n.text('filterHelp') }}</span>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <div class="request-mobile-list">
                  @for (row of requestTable.getRowModel().rows; track row.id) {
                    @let request = row.original;
                    <article
                      class="request-mobile-item"
                      [class.expanded]="mobileRequestExpanded(request.id)"
                    >
                      <button
                        type="button"
                        class="request-mobile-summary"
                        (click)="toggleMobileRequest(request.id)"
                        [attr.aria-expanded]="mobileRequestExpanded(request.id)"
                      >
                        <span
                          ><strong>{{ request.document_title }}</strong
                          ><small
                            ><span
                              class="badge"
                              [class.pending]="request.status === 'draft'"
                              [class.complete]="request.status === 'completed'"
                              [class.expired]="request.status === 'expired'"
                              >{{ requestStatusLabel(request.status) }}</span
                            ><span>{{
                              i18n.text('of', {
                                current: request.signed_count,
                                total: request.signer_count,
                              })
                            }}</span></small
                          ></span
                        >
                        <i class="bi bi-chevron-down" aria-hidden="true"></i>
                      </button>
                      @if (mobileRequestExpanded(request.id)) {
                        <div class="request-mobile-details">
                          <div>
                            <span>{{ i18n.text('request') }}</span
                            ><strong>#{{ request.id }}</strong>
                          </div>
                          <div>
                            <span>{{ i18n.text('document') }}</span
                            ><strong>{{ request.original_filename }}</strong>
                          </div>
                          <div>
                            <span>{{ i18n.text('signaturesLabel') }}</span
                            ><strong>{{
                              i18n.text('of', {
                                current: request.signed_count,
                                total: request.signer_count,
                              })
                            }}</strong
                            ><span class="progress-track"
                              ><i [style.width.%]="signatureProgress(request)"></i
                            ></span>
                          </div>
                          <div>
                            <span>{{ i18n.text('deadline') }}</span
                            ><strong>{{ i18n.formatDate(request.expires_at) }}</strong>
                          </div>
                          <div>
                            <span>{{ i18n.text('openedAt') }}</span
                            ><strong>{{ i18n.formatDate(request.opened_at || request.created_at) }}</strong>
                          </div>
                          <button
                            class="button secondary compact"
                            (click)="openRequestDetails(request)"
                          >
                            {{ i18n.text('details') }}
                          </button>
                        </div>
                      }
                    </article>
                  } @empty {
                    <div class="empty-state">
                      <strong>{{ i18n.text('noRequests') }}</strong
                      ><span>{{ i18n.text('filterHelp') }}</span>
                    </div>
                  }
                </div>
              </div>
              @if (matchingRequests().length) {
                <footer class="list-footer">
                  <span>{{
                    pageSummary(
                      requestTable.atoms.pagination.get().pageIndex,
                      requestTable.atoms.pagination.get().pageSize,
                      matchingRequests().length
                    )
                  }}</span>
                  <div class="pagination-actions">
                    <button
                      class="button secondary compact"
                      (click)="requestTable.previousPage()"
                      [disabled]="!requestTable.getCanPreviousPage()"
                      [attr.aria-label]="previousPageLabel()"
                    >
                      <i class="bi bi-chevron-left"></i></button
                    ><button
                      class="button secondary compact"
                      (click)="requestTable.nextPage()"
                      [disabled]="!requestTable.getCanNextPage()"
                      [attr.aria-label]="nextPageLabel()"
                    >
                      <i class="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </footer>
              }
            </article>

            <article class="card table-card" data-testid="documents-table">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">{{ i18n.text('collection') }}</p>
                  <h2>{{ i18n.text('documentsPlural') }}</h2>
                  <p class="muted">{{ i18n.text('documentsHelp') }}</p>
                </div>
                <div class="section-actions">
                  <div class="list-toolbar">
                    <label
                      >{{ i18n.text('search')
                      }}<input
                        [(ngModel)]="documentSearch"
                        (ngModelChange)="resetDocumentLimit()"
                        [placeholder]="i18n.text('nameOrFile')" /></label
                    ><app-date-filter
                      [label]="i18n.text('date')"
                      [(value)]="documentDate"
                      (valueChange)="resetDocumentLimit()"
                    />
                  </div>
                  @if (canManage()) {
                    <button class="button secondary" (click)="showUploadModal()">
                      {{ i18n.text('uploadPdf') }}
                    </button>
                  }
                </div>
              </div>
              <div class="table-wrap">
                <table class="data-table document-data-table">
                  <thead>
                    <tr>
                      <th>
                        <button class="table-sort" (click)="toggleDocumentSort('title')">
                          {{ i18n.text('document') }}
                          <i [class]="sortIcon(documentSortDirection('title'))"></i>
                        </button>
                      </th>
                      <th>
                        <button
                          class="table-sort"
                          (click)="toggleDocumentSort('original_filename')"
                        >
                          {{ i18n.text('file') }}
                          <i [class]="sortIcon(documentSortDirection('original_filename'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleDocumentSort('status')">
                          {{ i18n.text('status') }}
                          <i [class]="sortIcon(documentSortDirection('status'))"></i>
                        </button>
                      </th>
                      <th>
                        <button class="table-sort" (click)="toggleDocumentSort('created_at')">
                          {{ i18n.text('addedAt') }}
                          <i [class]="sortIcon(documentSortDirection('created_at'))"></i>
                        </button>
                      </th>
                      <th class="actions-column">{{ i18n.text('actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of documentTable.getRowModel().rows; track row.id) {
                      @let document = row.original;
                      <tr>
                        <td>
                          <div class="document-cell">
                            <strong>{{ document.title }}</strong
                            ><small>{{
                              i18n.text('signedCount', {
                                count: document.completed_signature_count,
                              })
                            }}</small>
                          </div>
                        </td>
                        <td [attr.data-label]="i18n.text('file')">
                          <div class="file-cell">
                            <span class="file-name" [title]="document.original_filename"
                              ><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i
                              ><span>{{ document.original_filename }}</span></span
                            ><small>{{ fileSize(document.size_bytes) }}</small>
                          </div>
                        </td>
                        <td>
                          <span class="badge">{{
                            document.status === 'ready' ? i18n.text('ready') : document.status
                          }}</span
                          ><small>{{
                            i18n.text('requestCount', { count: document.signature_request_count })
                          }}</small>
                        </td>
                        <td [attr.data-label]="i18n.text('addedAt')">
                          {{ i18n.formatDate(document.created_at) }}
                        </td>
                        <td>
                          <div class="table-actions">
                            <button class="button secondary compact" (click)="preview(document)">
                              {{ i18n.text('view') }}
                            </button>
                            @if (canManage()) {
                              <button
                                class="button secondary compact"
                                (click)="prepareRequest(document)"
                              >
                                {{ i18n.text('requestSignature') }}</button
                              ><button
                                class="button compact danger"
                                (click)="deleteDocument(document)"
                              >
                                {{ i18n.text('deleteAction') }}
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5">
                          <div class="empty-state">
                            <strong>{{ i18n.text('noDocuments') }}</strong
                            ><span>{{ i18n.text('firstPdf') }}</span>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <div class="document-mobile-list">
                  @for (row of documentTable.getRowModel().rows; track row.id) {
                    @let document = row.original;
                    <article
                      class="document-mobile-item"
                      [class.expanded]="mobileDocumentExpanded(document.id)"
                    >
                      <button
                        type="button"
                        class="document-mobile-summary"
                        (click)="toggleMobileDocument(document.id, $event)"
                        [attr.aria-expanded]="mobileDocumentExpanded(document.id)"
                      >
                        <span
                          ><strong>{{ document.title }}</strong
                          ><small
                            ><i class="bi bi-file-earmark-pdf" aria-hidden="true"></i
                            ><span>{{ document.original_filename }}</span></small
                          ></span
                        >
                        <i class="bi bi-chevron-down" aria-hidden="true"></i>
                      </button>
                      <div
                        class="document-mobile-details-shell"
                        [attr.aria-hidden]="!mobileDocumentExpanded(document.id)"
                        [attr.inert]="mobileDocumentExpanded(document.id) ? null : ''"
                      >
                        <div class="document-mobile-details">
                          <div>
                            <span>{{ i18n.text('status') }}</span
                            ><strong
                              ><span class="badge">{{
                                document.status === 'ready' ? i18n.text('ready') : document.status
                              }}</span></strong
                            >
                          </div>
                          <div>
                            <span>{{ i18n.text('file') }}</span
                            ><strong>{{ document.original_filename }}</strong
                            ><small>{{ fileSize(document.size_bytes) }}</small>
                          </div>
                          <div>
                            <span>{{ i18n.text('signaturesLabel') }}</span
                            ><strong>{{
                              i18n.text('signedCount', {
                                count: document.completed_signature_count,
                              })
                            }}</strong
                            ><small>{{
                              i18n.text('requestCount', { count: document.signature_request_count })
                            }}</small>
                          </div>
                          <div>
                            <span>{{ i18n.text('addedAt') }}</span
                            ><strong>{{ i18n.formatDate(document.created_at) }}</strong>
                          </div>
                          <div class="document-mobile-actions">
                            <button class="button secondary compact" (click)="preview(document)">
                              {{ i18n.text('view') }}
                            </button>
                            @if (canManage()) {
                              <button
                                class="button secondary compact"
                                (click)="prepareRequest(document)"
                              >
                                {{ i18n.text('requestSignature') }}</button
                              ><button
                                class="button compact danger"
                                (click)="deleteDocument(document)"
                              >
                                {{ i18n.text('deleteAction') }}
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    </article>
                  } @empty {
                    <div class="empty-state">
                      <strong>{{ i18n.text('noDocuments') }}</strong
                      ><span>{{ i18n.text('firstPdf') }}</span>
                    </div>
                  }
                </div>
              </div>
              @if (matchingDocuments().length) {
                <footer class="list-footer">
                  <span>{{
                    pageSummary(
                      documentTable.atoms.pagination.get().pageIndex,
                      documentTable.atoms.pagination.get().pageSize,
                      matchingDocuments().length
                    )
                  }}</span>
                  <div class="pagination-actions">
                    <button
                      class="button secondary compact"
                      (click)="documentTable.previousPage()"
                      [disabled]="!documentTable.getCanPreviousPage()"
                      [attr.aria-label]="previousPageLabel()"
                    >
                      <i class="bi bi-chevron-left"></i></button
                    ><button
                      class="button secondary compact"
                      (click)="documentTable.nextPage()"
                      [disabled]="!documentTable.getCanNextPage()"
                      [attr.aria-label]="nextPageLabel()"
                    >
                      <i class="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </footer>
              }
            </article>
          }
        </section>

        @if (uploadModalOpen()) {
          <div class="modal-backdrop" (click)="closeUploadModal()">
            <section class="app-modal" (click)="$event.stopPropagation()">
              <header class="modal-header">
                <div>
                  <p class="eyebrow">{{ i18n.text('newFile') }}</p>
                  <h2>{{ i18n.text('uploadDocument') }}</h2>
                </div>
                <button
                  class="modal-close"
                  (click)="closeUploadModal()"
                  [attr.aria-label]="i18n.text('close')"
                >
                  ×
                </button>
              </header>
              <form class="modal-body form" (ngSubmit)="upload()">
                <label
                  >{{ i18n.text('title') }}
                  <input name="title" [(ngModel)]="title" required /></label
                ><input
                  #filePicker
                  class="sr-only"
                  type="file"
                  accept="application/pdf,.pdf"
                  (change)="selectFile($event)"
                />
                <div
                  class="dropzone"
                  [class.has-file]="file"
                  (click)="filePicker.click()"
                  (dragover)="$event.preventDefault()"
                  (drop)="dropFile($event)"
                >
                  <span class="dropzone-icon">⇧</span>
                  @if (file) {
                    <strong>{{ file.name }}</strong
                    ><small
                      >{{ file.size / 1024 / 1024 | number: '1.0-2' }} MB ·
                      {{ i18n.text('clickChange') }}</small
                    >
                  } @else {
                    <strong>{{ i18n.text('dragPdf') }}</strong
                    ><small>{{ i18n.text('chooseFile') }}</small>
                  }
                </div>
                <footer class="modal-footer">
                  <button type="button" class="button secondary" (click)="closeUploadModal()">
                    {{ i18n.text('cancel') }}</button
                  ><button class="button" [disabled]="!file || submitting()">
                    {{ i18n.text('uploadFile') }}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        }

        @if (requestCreateModalOpen() && selectedDocument()) {
          <div class="modal-backdrop" (click)="closeRequestCreateModal()">
            <section class="app-modal" (click)="$event.stopPropagation()">
              <header class="modal-header">
                <div>
                  <p class="eyebrow">{{ i18n.text('newRequest') }}</p>
                  <h2>{{ selectedDocument()!.title }}</h2>
                  <span class="muted">{{ selectedDocument()!.original_filename }}</span>
                </div>
                <button
                  class="modal-close"
                  (click)="closeRequestCreateModal()"
                  [attr.aria-label]="i18n.text('close')"
                >
                  ×
                </button>
              </header>
              <form class="modal-body form" (ngSubmit)="createRequest()">
                <p class="notice">{{ i18n.text('draftHelp') }}</p>
                <app-date-filter
                  class="request-deadline-picker"
                  [label]="i18n.text('signingDeadline')"
                  [includeTime]="true"
                  [(value)]="expiresAt"
                />
                <footer class="modal-footer">
                  <button
                    type="button"
                    class="button secondary"
                    (click)="closeRequestCreateModal()"
                  >
                    {{ i18n.text('cancel') }}</button
                  ><button class="button" [disabled]="submitting() || !expiresAt">
                    {{ i18n.text('createRequest') }}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        }

        @if (requestModalOpen() && selectedRequest()) {
          <div class="modal-backdrop request-details-backdrop" (click)="closeRequestModal()">
            <section
              class="app-modal wide request-details-modal"
              (click)="$event.stopPropagation()"
            >
              <header class="modal-header">
                <div>
                  <p class="eyebrow">{{ i18n.text('request') }} #{{ selectedRequest()!.id }}</p>
                  <h2>{{ selectedRequest()!.document_title }}</h2>
                  <span
                    class="badge"
                    [class.pending]="selectedRequest()!.status === 'draft'"
                    [class.complete]="selectedRequest()!.status === 'completed'"
                    [class.expired]="selectedRequest()!.status === 'expired'"
                    >{{ requestStatusLabel(selectedRequest()!.status) }}</span
                  >
                </div>
                <button
                  class="modal-close"
                  (click)="closeRequestModal()"
                  [attr.aria-label]="i18n.text('close')"
                >
                  ×
                </button>
              </header>
              <div class="modal-body">
                @if (selectedRequest()!.status === 'expired' && canManage()) {
                  <div class="request-reopen-action">
                    <button class="button" (click)="startReopenRequest()">
                      <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
                      {{ reopenRequestLabel() }}
                    </button>
                  </div>
                }
                @if (
                  (selectedRequest()!.round_number || 1) > 1 || selectedRequest()!.child_request_id
                ) {
                  <section class="notice">
                    <strong>{{ signingRoundsLabel() }}</strong>
                    @for (round of selectedRequestRounds(); track round.id) {
                      <div>
                        {{ roundLabel(round) }} · {{ requestStatusLabel(round.status) }} ·
                        {{ i18n.formatDate(round.expires_at) }}
                      </div>
                    }
                    @if (selectedRequest()!.reopened_reason) {
                      <small>{{ selectedRequest()!.reopened_reason }}</small>
                    }
                  </section>
                }
                @if (detailsLoading()) {
                  <p class="notice">{{ i18n.text('loadingDetails') }}</p>
                } @else {
                  <div class="metric-strip">
                    <div>
                      <small>{{ i18n.text('signaturesLabel') }}</small
                      ><strong
                        >{{ selectedRequest()!.signed_count }}/{{
                          selectedRequest()!.signer_count
                        }}</strong
                      >
                    </div>
                    <div>
                      <small>{{ i18n.text('version') }}</small
                      ><strong>{{ selectedRequest()!.document_version }}</strong>
                    </div>
                    <div>
                      <small>{{ i18n.text('deadline') }}</small
                      ><strong>{{ i18n.formatDate(selectedRequest()!.expires_at) }}</strong>
                    </div>
                    @if (selectedRequest()!.status !== 'draft') {
                      <div>
                        <small>{{ signatureModeFieldLabel() }}</small
                        ><strong>{{
                          signatureModeLabel(selectedRequest()!.signature_mode)
                        }}</strong>
                      </div>
                    }
                  </div>
                  <div class="details-grid">
                    <section class="detail-panel">
                      <div class="panel-heading">
                        <div>
                          <h3>{{ i18n.text('signers') }}</h3>
                          <p class="muted">{{ i18n.text('linkedPeople') }}</p>
                        </div>
                      </div>
                      <div class="signer-list">
                        @for (signer of signers(); track signer.id) {
                          <div class="signer-row">
                            <div>
                              <strong>{{ signer.name }}</strong
                              ><small>{{ signer.email }}</small
                              ><small>{{ participantRoleLabel(signer.participant_role) }}</small>
                              @if (signer.representation_snapshot) {
                                <small class="signer-identity"
                                  ><i class="bi bi-building"></i>
                                  {{ organizationLabel(signer.representation_snapshot) }}</small
                                >
                              }
                              @if (signer.identity_document_masked) {
                                <small class="signer-identity"
                                  ><i class="bi bi-person-vcard"></i>
                                  {{ identityLabel(signer) }}</small
                                >
                              }
                              @if (signer.signed_at) {
                                <small>{{
                                  i18n.text('signedAt', { date: i18n.formatDate(signer.signed_at) })
                                }}</small>
                              }
                            </div>
                            <span
                              class="badge"
                              [class.pending]="
                                signer.status === 'pending' || signer.status === 'viewed'
                              "
                              [class.complete]="signer.status === 'signed'"
                              >{{ signerStatusLabel(signer.status) }}</span
                            >
                          </div>
                        } @empty {
                          <div class="empty-state compact-empty">
                            <strong>{{ i18n.text('noSigner') }}</strong
                            ><span>{{ i18n.text('addBeforeOpen') }}</span>
                          </div>
                        }
                      </div>
                    </section>
                    <section class="detail-panel action-panel">
                      @if (selectedRequest()!.status === 'draft') {
                        <div>
                          <h3>{{ i18n.text('addSigner') }}</h3>
                          <p class="muted">
                            {{
                              i18n.text(
                                emailInvitationsEnabled() ? 'inviteSignerHelp' : 'addSignerLinkHelp'
                              )
                            }}
                          </p>
                        </div>
                        @if (signerContacts().length) {
                          <div class="contact-picker">
                            <label
                              >{{ i18n.text('previousInvitees')
                              }}<input
                                [ngModel]="contactSearch()"
                                (ngModelChange)="contactSearch.set($event)"
                                (focus)="contactPickerOpen.set(true)"
                                (blur)="contactPickerOpen.set(false)"
                                name="contactSearch"
                                [placeholder]="i18n.text('nameOrEmail')"
                                autocomplete="off"
                            /></label>
                            @if (contactPickerOpen()) {
                              <div class="contact-options" role="listbox">
                                @for (contact of filteredContacts(); track contact.email) {
                                  <button
                                    type="button"
                                    role="option"
                                    [attr.aria-selected]="signerEmail === contact.email"
                                    (mousedown)="$event.preventDefault()"
                                    (click)="selectContact(contact)"
                                  >
                                    <strong>{{ contact.name }}</strong
                                    ><span>{{ contact.email }}</span>
                                  </button>
                                } @empty {
                                  <p>{{ i18n.text('noUser') }}</p>
                                }
                              </div>
                            }
                          </div>
                        }
                        <form class="form" (ngSubmit)="addSigner()">
                          <div class="form-field">
                            <span class="field-label">{{ participantTypeTitle() }}</span
                            ><app-rubrica-select
                              [ariaLabel]="participantTypeTitle()"
                              [value]="signerParticipantRole"
                              [options]="participantRoleOptions()"
                              (valueChange)="selectParticipantRole($event)"
                            /><small class="muted">{{ participantTypeHelp() }}</small>
                          </div>
                          <label
                            >{{ i18n.text('name')
                            }}<input
                              name="signerName"
                              [(ngModel)]="signerName"
                              required
                              autocomplete="name" /></label
                          ><label
                            >{{ i18n.text('email')
                            }}<input
                              name="signerEmail"
                              type="email"
                              [(ngModel)]="signerEmail"
                              required
                              autocomplete="email"
                          /></label>
                          @if (emailInvitationsEnabled()) {
                            <div class="signer-language-field">
                              <span class="field-label">{{ i18n.text('language') }}</span
                              ><app-language-picker
                                class="signer-language-picker"
                                [value]="signerLocale"
                                (valueChange)="signerLocale = $event"
                              />
                            </div>
                          }
                          <button
                            class="button full-width"
                            [disabled]="submitting() || !signerName.trim() || !signerEmail.trim()"
                          >
                            {{ i18n.text('add') }}
                          </button>
                        </form>
                        <div class="draft-request-actions">
                          @if (customStampPlacementEnabled()) {
                            <button
                              class="button secondary full-width"
                              (click)="openStampEditor()"
                              [disabled]="!signers().length"
                            >
                              {{ stampEditorLabel() }}
                            </button>
                          }
                          <button
                            class="button full-width"
                            (click)="openRequest()"
                            [disabled]="submitting() || !signers().length"
                          >
                            {{ i18n.text('openForSigning') }}
                          </button>
                        </div>
                      } @else {
                        <div>
                          <h3>{{ i18n.text('documentAccess') }}</h3>
                          <p class="muted">{{ i18n.text('shareUnique') }}</p>
                        </div>
                        @if (requestLink()) {
                          <div class="link-panel">
                            <small>{{ i18n.text('uniqueLink') }}</small
                            ><span>{{ requestLink() }}</span>
                          </div>
                          @if (requestQrCode()) {
                            <img
                              class="signing-qr"
                              [src]="requestQrCode()"
                              alt="QR Code do link para assinatura"
                            />
                          }
                          <div class="button-row">
                            <button class="button secondary compact" (click)="copyInvite()">
                              {{ i18n.text('copyLink') }}</button
                            ><button class="button secondary compact" (click)="openInvite()">
                              {{ i18n.text('openLink') }}
                            </button>
                            @if (requestQrCode()) {
                              <a
                                class="button secondary compact qr-download-button"
                                [href]="requestQrCode()"
                                [download]="qrCodeFilename()"
                                ><i class="bi bi-qr-code-scan" aria-hidden="true"></i>
                                {{ i18n.text('downloadQrCode') }}</a
                              >
                            }
                          </div>
                        } @else {
                          <p class="notice">{{ i18n.text('noRecoverableLink') }}</p>
                        }
                        @if (
                          selectedRequest()!.status === 'open' ||
                          (isAdmin() && selectedRequest()!.status === 'completed' && !requestLink())
                        ) {
                          <button
                            class="button secondary full-width"
                            (click)="generateLink()"
                            [disabled]="submitting()"
                          >
                            {{
                              requestLink()
                                ? i18n.text('rotateLink')
                                : selectedRequest()!.status === 'completed'
                                  ? i18n.text('historicalLink')
                                  : i18n.text('generateLink')
                            }}
                          </button>
                        }
                        @if (isAdmin() && hasSignedSigners()) {
                          <hr />
                          <div>
                            <h3>{{ i18n.text('completedDocument') }}</h3>
                            <p class="muted">{{ i18n.text('artifactHelp') }}</p>
                          </div>
                          <div class="button-row">
                            <button
                              class="button secondary compact"
                              (click)="previewSignedRequest()"
                            >
                              {{ i18n.text('viewSignedPdf') }}</button
                            ><button class="button secondary compact" (click)="showEvidence()">
                              {{ i18n.text('viewEvidence') }}
                            </button>
                          </div>
                        }
                      }
                    </section>
                  </div>
                }
              </div>
            </section>
          </div>
        }

        @if (reopenModalOpen() && selectedRequest()) {
          <div class="modal-backdrop" (click)="closeReopenModal()">
            <section class="app-modal" (click)="$event.stopPropagation()">
              <header class="modal-header">
                <div>
                  <p class="eyebrow">{{ reopenRequestLabel() }}</p>
                  <h2>{{ selectedRequest()!.document_title }}</h2>
                </div>
                <button
                  class="modal-close"
                  (click)="closeReopenModal()"
                  [attr.aria-label]="i18n.text('close')"
                >
                  ×
                </button>
              </header>
              <div class="modal-body form">
                <p class="notice">{{ reopenImmutabilityHelp() }}</p>
                <app-date-filter
                  class="request-deadline-picker"
                  [label]="i18n.text('signingDeadline')"
                  [includeTime]="true"
                  [(value)]="reopenExpiresAt"
                />
                <label class="reopen-reason-field"
                  >{{ reopenReasonLabel()
                  }}<textarea [(ngModel)]="reopenReason" maxlength="500" rows="3"></textarea>
                </label>
                <fieldset class="reopen-signers-field">
                  <legend>{{ pendingSignersLabel() }}</legend>
                  @for (signer of reopenCandidates(); track signer.id) {
                    <label class="reopen-signer-option"
                      ><input
                        type="checkbox"
                        [checked]="reopenSignerIds.has(signer.id)"
                        (change)="toggleReopenSigner(signer.id, $event)"
                      />
                      <span><strong>{{ signer.name }}</strong><small>{{ signer.email }}</small></span></label
                    >
                  } @empty {
                    <p class="muted">{{ noPendingSignersLabel() }}</p>
                  }
                </fieldset>
                <p class="muted">{{ addSignersAfterReopenHelp() }}</p>
              </div>
              <footer class="modal-footer">
                <button class="button secondary" (click)="closeReopenModal()">
                  {{ i18n.text('cancel') }}</button
                ><button
                  class="button"
                  [disabled]="submitting() || !reopenExpiresAt || reopenReason.trim().length < 5"
                  (click)="reopenRequest()"
                >
                  {{ reopenRequestLabel() }}
                </button>
              </footer>
            </section>
          </div>
        }

        @if (previewDocument()) {
          <div class="modal-backdrop pdf-backdrop" (click)="closePreview()">
            <section class="pdf-modal" (click)="$event.stopPropagation()">
              <header>
                <div>
                  <strong>{{ previewHeading() }} · {{ previewDocument()!.title }}</strong
                  ><small>{{ previewDocument()!.original_filename }}</small>
                </div>
                <div class="pdf-modal-actions">
                  <button class="button secondary compact" (click)="downloadPreview()">
                    <i class="bi bi-download"></i> {{ i18n.text('downloadPdf') }}</button
                  ><button
                    class="modal-close"
                    (click)="closePreview()"
                    [attr.aria-label]="i18n.text('close')"
                  >
                    ×
                  </button>
                </div>
              </header>
              <div class="pdf-modal-content">
                <app-pdf-stamp-viewer [sourceData]="previewData()" [readonly]="true" />
              </div>
            </section>
          </div>
        }
        @if (stampEditorOpen()) {
          <div class="modal-backdrop pdf-backdrop" (click)="closeStampEditor()">
            <section class="pdf-modal stamp-editor-modal" (click)="$event.stopPropagation()">
              <header>
                <div>
                  <strong>{{ stampEditorLabel() }}</strong
                  ><small>{{ selectedRequest()?.document_title }}</small>
                </div>
                <div class="stamp-editor-header-actions">
                  <button
                    type="button"
                    class="button secondary compact stamp-mobile-controls-trigger"
                    (click)="toggleStampMobileControls()"
                  >
                    <i class="bi bi-list"></i><span>Opções</span></button
                  ><img
                    class="stamp-topbar-logo"
                    src="/icons/rubrica-brand/source/rubrica-lockup-inverse.png"
                    alt="Rúbrica"
                  /><button
                    type="button"
                    class="stamp-fit-toggle"
                    (click)="toggleStampPdfFitMode()"
                    [attr.aria-label]="
                      stampPdfFitMode() === 'page' ? 'Ajustar à largura' : 'Mostrar página inteira'
                    "
                    [attr.title]="
                      stampPdfFitMode() === 'page' ? 'Ajustar à largura' : 'Mostrar página inteira'
                    "
                  >
                    <i
                      class="bi"
                      [class.bi-arrows-angle-expand]="stampPdfFitMode() === 'page'"
                      [class.bi-arrows-angle-contract]="stampPdfFitMode() === 'width'"
                    ></i></button
                  ><button
                    class="modal-close"
                    (click)="closeStampEditor()"
                    [attr.aria-label]="i18n.text('close')"
                  >
                    ×
                  </button>
                </div>
              </header>
              <div
                class="pdf-modal-content stamp-editor-layout"
                [class.drawer-open]="stampMobileControlsOpen()"
              >
                <button
                  type="button"
                  class="stamp-drawer-scrim"
                  [attr.aria-label]="i18n.text('close')"
                  (click)="stampMobileControlsOpen.set(false)"
                ></button>
                <aside class="stamp-editor-controls" [class.open]="stampMobileControlsOpen()">
                  <div class="stamp-mobile-drawer-header">
                    <strong>Personalizar assinatura</strong
                    ><button
                      type="button"
                      class="modal-close"
                      (click)="stampMobileControlsOpen.set(false)"
                      [attr.aria-label]="i18n.text('close')"
                    >
                      ×
                    </button>
                  </div>
                  <div class="form-field">
                    <span class="field-label">{{ signerForStampLabel() }}</span
                    ><app-rubrica-select
                      [ariaLabel]="signerForStampLabel()"
                      [value]="stampSignerId"
                      [options]="stampSignerOptions()"
                      (valueChange)="selectStampSigner($event)"
                    />
                  </div>
                  <div class="form-field">
                    <span class="field-label">Método de assinatura</span
                    ><app-rubrica-select
                      ariaLabel="Método de assinatura"
                      [value]="stampSignerMode()"
                      [options]="stampSignatureModeOptions()"
                      (valueChange)="selectStampSignerMode($event)"
                    />
                  </div>
                  <div class="stamp-variant-picker">
                    <span class="field-label">Escolha o carimbo para este signatário</span
                    ><small class="stamp-picker-help"
                      >Depois toque na página para posicionar. Você pode escolher outro formato em
                      cada página.</small
                    ><button
                      type="button"
                      [class.active]="stampVariant() === 'full'"
                      (click)="selectStampVariant('full')"
                    >
                      <span class="stamp-choice-preview full"
                        ><b>ASSINADO ELETRONICAMENTE POR</b
                        ><strong>{{ stampSignerName() || 'Nome do signatário' }}</strong
                        ><small>CPF · data · evidência</small></span
                      ><strong>Completo</strong><small>Identidade, data e evidência</small></button
                    ><button
                      type="button"
                      [class.active]="stampVariant() === 'minimal'"
                      (click)="selectStampVariant('minimal')"
                    >
                      <span class="stamp-choice-preview minimal"
                        ><b>ASSINADO POR</b
                        ><strong>{{ stampSignerName() || 'Nome do signatário' }}</strong></span
                      ><strong>Mínimo</strong><small>Nome e confirmação</small></button
                    ><button
                      type="button"
                      [class.active]="stampVariant() === 'drawn'"
                      (click)="selectStampVariant('drawn')"
                    >
                      <span class="stamp-choice-preview drawn"
                        ><span
                          ><b>ASSINADO POR</b
                          ><strong>{{ stampSignerName() || 'Nome do signatário' }}</strong></span
                        ><em>Sua assinatura</em></span
                      ><strong>Desenhado</strong
                      ><small>Assinatura feita à mão na confirmação</small>
                    </button>
                  </div>
                  @if (customStampBrandingEnabled()) {
                    <div class="form-field">
                      <span class="field-label">Modelo</span
                      ><app-rubrica-select
                        ariaLabel="Modelo"
                        [value]="stampCustomization.template"
                        [options]="stampTemplateOptions()"
                        (valueChange)="selectStampTemplate($event)"
                      />
                    </div>
                    <div class="stamp-color-field">
                      <span class="field-label">{{ stampColorLabel() }}</span>
                      <app-rubrica-color-picker
                        [value]="stampCustomization.primary_color"
                        [ariaLabel]="stampColorLabel()"
                        (valueChange)="selectStampColor($event)"
                      />
                    </div>
                    <div class="stamp-logo-field">
                      <span class="field-label">Logo PNG</span
                      ><input
                        #stampLogoPicker
                        class="sr-only"
                        type="file"
                        accept="image/png,.png"
                        (change)="selectStampLogo($event)"
                      /><button
                        type="button"
                        class="stamp-logo-button"
                        (click)="stampLogoPicker.click()"
                      >
                        <i class="bi bi-upload"></i
                        ><span
                          ><strong>{{ stampLogoName || 'Selecionar logo' }}</strong
                          ><small>PNG · máximo 256 KB · 2048 × 2048 px</small></span
                        >
                      </button>
                      @if (stampCustomization.show_logo) {
                        <button type="button" class="button secondary compact" (click)="removeStampLogo()">
                          <i class="bi bi-x-circle"></i><span>Assinar sem logo</span>
                        </button>
                      }
                    </div>
                  }
                  <div class="stamp-sidebar-actions">
                    <button class="button secondary" (click)="replicateStampOnEveryPage()">
                      {{ everyPageLabel() }}
                    </button>
                    @if (customStampBrandingEnabled()) {
                      <button class="button secondary" (click)="saveTenantStampDefault()">
                        {{ tenantStampDefaultLabel() }}
                      </button>
                    }
                    <button class="button" (click)="saveStampConfiguration()">
                      {{ i18n.text('save') }}
                    </button>
                  </div>
                </aside>
                <div class="stamp-editor-document">
                  <app-pdf-stamp-viewer
                    [sourceData]="stampEditorPdf()"
                    [placements]="stampPlacements()"
                    [signers]="signers()"
                    [activeSignerId]="stampSignerId"
                    [fitMode]="stampPdfFitMode()"
                    [customization]="stampCustomization"
                    [signerName]="stampSignerName()"
                    [signerIdentity]="stampSignerIdentity()"
                    [signerRepresentation]="stampSignerRepresentation()"
                    (placementChange)="addStampPlacement($event)"
                    (pageCountChange)="stampPageCount = $event"
                  />
                </div>
              </div>
            </section>
          </div>
        }
      </div>
    </main>
  `,
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  readonly documents = signal<DocumentItem[]>([]);
  readonly requests = signal<SignatureRequest[]>([]);
  readonly signers = signal<Signer[]>([]);
  readonly signerContacts = signal<SignerContact[]>([]);
  readonly contactSearch = signal('');
  readonly contactPickerOpen = signal(false);
  readonly tenants = signal<TenantItem[]>([]);
  readonly billingAccounts = signal<Record<string, BillingAccount>>({});
  readonly selectedDocument = signal<DocumentItem | null>(null);
  readonly selectedRequest = signal<SignatureRequest | null>(null);
  readonly requestLinks = signal<Record<string, string>>({});
  readonly requestQrCode = signal('');
  readonly requestEvidence = signal<SignatureEvidence[]>([]);
  readonly previewDocument = signal<DocumentItem | null>(null);
  readonly previewData = signal<ArrayBuffer | null>(null);
  readonly previewHeading = signal('');
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly detailsLoading = signal(false);
  readonly uploadModalOpen = signal(false);
  readonly requestCreateModalOpen = signal(false);
  readonly requestModalOpen = signal(false);
  readonly stampEditorOpen = signal(false);
  readonly stampMobileControlsOpen = signal(false);
  readonly stampPdfFitMode = signal<'page' | 'width'>('page');
  readonly expandedMobileRequests = signal<Set<string>>(new Set());
  readonly expandedMobileDocuments = signal<Set<string>>(new Set());
  readonly reopenModalOpen = signal(false);
  readonly stampEditorPdf = signal<ArrayBuffer | null>(null);
  readonly stampPlacements = signal<StampPosition[]>([]);
  stampSignerId = '';
  stampSignerModes: Record<string, 'serpro_timestamp' | 'serproid'> = {};
  stampSignerCustomizations: Record<string, StampCustomization> = {};
  stampVariants: Record<string, 'full' | 'minimal' | 'drawn'> = {};
  stampLogoName = '';
  stampPageCount = 0;
  stampCustomization: StampCustomization = {
    template: 'standard',
    display_variant: 'full',
    primary_color: '#187A66',
    show_logo: false,
    logo_png_data_url: null,
    require_drawn_signature: false,
  };
  reopenExpiresAt = '';
  reopenReason = '';
  reopenSignerIds = new Set<string>();

  private readonly requestFilterValue = signal('all');
  private readonly requestSearchValue = signal('');
  private readonly requestDateValue = signal('');
  private readonly documentSearchValue = signal('');
  private readonly documentDateValue = signal('');
  get requestFilter(): string {
    return this.requestFilterValue();
  }
  set requestFilter(value: string) {
    this.requestFilterValue.set(value);
  }
  get requestSearch(): string {
    return this.requestSearchValue();
  }
  set requestSearch(value: string) {
    this.requestSearchValue.set(value);
  }
  get requestDate(): string {
    return this.requestDateValue();
  }
  set requestDate(value: string) {
    this.requestDateValue.set(value);
  }
  get documentSearch(): string {
    return this.documentSearchValue();
  }
  set documentSearch(value: string) {
    this.documentSearchValue.set(value);
  }
  get documentDate(): string {
    return this.documentDateValue();
  }
  set documentDate(value: string) {
    this.documentDateValue.set(value);
  }

  readonly requestTable = injectTable(() => ({
    features: dashboardTableFeatures,
    columns: requestTableColumns,
    data: this.matchingRequests(),
    initialState: {
      sorting: [{ id: 'document_title', desc: true }],
      pagination: { pageIndex: 0, pageSize: 5 },
    },
  }));
  readonly documentTable = injectTable(() => ({
    features: dashboardTableFeatures,
    columns: documentTableColumns,
    data: this.matchingDocuments(),
    initialState: {
      sorting: [{ id: 'title', desc: true }],
      pagination: { pageIndex: 0, pageSize: 5 },
    },
  }));
  signerName = '';
  signerEmail = '';
  signerLocale: 'pt-BR' | 'en' | 'es' | 'ja-JP' = 'en';
  signerParticipantRole: 'external_signer' | 'company_representative' = 'external_signer';
  title = '';
  expiresAt = '';
  file: File | null = null;
  private tenantSlug = '';
  private tenantId = '';
  private modalScrollY = 0;
  private modalBodyStyle: string | null = null;
  private modalLocked = false;
  private readonly updateModalViewport = (): void => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty(
      '--rubrica-modal-top',
      `${viewport?.offsetTop ?? 0}px`,
    );
    document.documentElement.style.setProperty(
      '--rubrica-modal-height',
      `${viewport?.height ?? window.innerHeight}px`,
    );
  };

  constructor(
    readonly auth: AuthService,
    readonly i18n: I18nService,
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly feedback: FeedbackService,
  ) {}

  async ngOnInit(): Promise<void> {
    const context = await this.auth.restore();
    if (!context) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      if (context.mfa_setup_required) {
        await this.router.navigate(['/security']);
        return;
      }
      const dashboardUrl = await this.auth.dashboardUrl();
      const accountSlug = this.route.snapshot.paramMap.get('accountSlug');
      const tenantSlug = this.route.snapshot.paramMap.get('tenantSlug');
      const legacyAccountId = this.route.snapshot.paramMap.get('tenantAccountId');
      const tenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants'));
      const accountMatches = accountSlug === context.account_public_slug;
      let selectedTenant =
        accountMatches && tenantSlug
          ? tenants.find((tenant) => tenant.slug === tenantSlug)
          : accountMatches
            ? tenants.find((tenant) => tenant.kind !== 'business')
            : undefined;
      if (!selectedTenant && legacyAccountId)
        selectedTenant = tenants.find((tenant) => tenant.slug === `account-${legacyAccountId}`);
      if (!selectedTenant && tenantSlug && !accountSlug)
        selectedTenant = tenants.find((tenant) => tenant.slug === tenantSlug);
      if (!selectedTenant) {
        await this.router.navigateByUrl(dashboardUrl, { replaceUrl: true });
        return;
      }
      const canonicalUrl = tenantDashboardUrl(selectedTenant, context.account_public_slug);
      if (this.router.url.split('?')[0] !== canonicalUrl) {
        await this.router.navigateByUrl(canonicalUrl, { replaceUrl: true });
        return;
      }
      this.tenants.set(tenants);
      this.tenantSlug = selectedTenant.slug;
      this.tenantId = selectedTenant.id;
      if (selectedTenant.role === 'admin') {
        const team = await firstValueFrom(
          this.api.get<TenantTeam>(`/tenants/${this.tenantId}/team`),
        );
        if (team.requires_selection) {
          await this.router.navigateByUrl(canonicalUrl.replace(/dashboard$/, 'team'));
          return;
        }
      }
      await Promise.all([this.reload(), this.loadBilling(tenants)]);
    } catch (error) {
      await this.feedback.error(error, this.i18n.text('dashboardLoadFailed'));
    } finally {
      this.loading.set(false);
    }
  }
  ngOnDestroy(): void {
    this.unlockPageScroll();
  }
  security(): Promise<boolean> {
    return this.router.navigate(['/security']);
  }
  canManage(): boolean {
    return (
      this.selectedTenant()?.role !== 'auditor' &&
      this.auth.can('documents:write') &&
      this.auth.can('signature_requests:write')
    );
  }
  isAdmin(): boolean {
    return this.selectedTenant()?.role === 'admin';
  }
  hasSignedSigners(): boolean {
    return this.signers().some((signer) => signer.status === 'signed');
  }
  openRequestsCount(): number {
    return this.requests().filter((item) => item.status === 'open').length;
  }
  completedRequestsCount(): number {
    return this.requests().filter((item) => item.status === 'completed').length;
  }
  totalSignaturesCount(): number {
    return this.requests().reduce((total, item) => total + item.signed_count, 0);
  }
  matchingRequests(): SignatureRequest[] {
    const query = this.requestSearch.trim().toLowerCase();
    return this.requests().filter(
      (item) =>
        (this.requestFilter === 'all' || item.status === this.requestFilter) &&
        (!this.requestDate || item.created_at.slice(0, 10) === this.requestDate) &&
        (!query ||
          item.document_title.toLowerCase().includes(query) ||
          item.original_filename.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query)),
    );
  }
  matchingDocuments(): DocumentItem[] {
    const query = this.documentSearch.trim().toLowerCase();
    return this.documents().filter(
      (item) =>
        (!this.documentDate || item.created_at.slice(0, 10) === this.documentDate) &&
        (!query ||
          item.title.toLowerCase().includes(query) ||
          item.original_filename.toLowerCase().includes(query) ||
          item.created_by.toLowerCase().includes(query)),
    );
  }
  resetRequestLimit(): void {
    this.requestTable.setPageIndex(0);
  }
  resetDocumentLimit(): void {
    this.documentTable.setPageIndex(0);
  }
  toggleRequestSort(column: string): void {
    const target = this.requestTable.getColumn(column);
    target?.toggleSorting(target.getIsSorted() === 'asc');
  }
  toggleDocumentSort(column: string): void {
    const target = this.documentTable.getColumn(column);
    target?.toggleSorting(target.getIsSorted() === 'asc');
  }
  requestSortDirection(column: string): false | 'asc' | 'desc' {
    return this.requestTable.getColumn(column)?.getIsSorted() ?? false;
  }
  documentSortDirection(column: string): false | 'asc' | 'desc' {
    return this.documentTable.getColumn(column)?.getIsSorted() ?? false;
  }
  sortIcon(direction: false | 'asc' | 'desc'): string {
    return direction === 'asc'
      ? 'bi bi-arrow-up table-sort-active'
      : direction === 'desc'
        ? 'bi bi-arrow-down table-sort-active'
        : 'bi bi-arrow-down-up';
  }
  pageSummary(pageIndex: number, pageSize: number, total: number): string {
    const first = pageIndex * pageSize + 1;
    const last = Math.min(first + pageSize - 1, total);
    return this.localized({
      'pt-BR': `${first}–${last} de ${total}`,
      en: `${first}–${last} of ${total}`,
      es: `${first}–${last} de ${total}`,
      'ja-JP': `${total}件中 ${first}–${last}件`,
    });
  }
  previousPageLabel(): string {
    return this.localized({
      'pt-BR': 'Página anterior',
      en: 'Previous page',
      es: 'Página anterior',
      'ja-JP': '前のページ',
    });
  }
  nextPageLabel(): string {
    return this.localized({
      'pt-BR': 'Próxima página',
      en: 'Next page',
      es: 'Página siguiente',
      'ja-JP': '次のページ',
    });
  }
  requestFilterOptions(): {
    value: string;
    label: 'all' | 'open' | 'drafts' | 'completedPlural' | 'expired';
  }[] {
    return [
      { value: 'all', label: 'all' },
      { value: 'open', label: 'open' },
      { value: 'draft', label: 'drafts' },
      { value: 'completed', label: 'completedPlural' },
      { value: 'expired', label: 'expired' },
    ];
  }
  requestFilterLabel(): string {
    const option = this.requestFilterOptions().find((item) => item.value === this.requestFilter);
    return this.i18n.text(option?.label ?? 'all');
  }
  selectRequestFilter(value: string, menu: HTMLDetailsElement): void {
    this.requestFilter = value;
    this.resetRequestLimit();
    menu.removeAttribute('open');
  }
  toolbarPickerToggled(event: Event): void {
    const current = event.target as HTMLDetailsElement;
    if (!current.open) return;
    current
      .closest('.list-toolbar')
      ?.querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach((menu) => {
        if (menu !== current) menu.removeAttribute('open');
      });
  }
  requestLink(): string {
    const request = this.selectedRequest();
    const storedLink = request ? this.requestLinks()[request.id] || '' : '';
    if (!storedLink) return '';
    const parsed = new URL(storedLink, window.location.origin);
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  filteredContacts(): SignerContact[] {
    const query = this.contactSearch().trim().toLowerCase();
    return this.signerContacts()
      .filter(
        (contact) =>
          !query || contact.name.toLowerCase().includes(query) || contact.email.includes(query),
      )
      .slice(0, 8);
  }
  selectContact(contact: SignerContact): void {
    this.signerName = contact.name;
    this.signerEmail = contact.email;
    this.contactSearch.set(`${contact.name} · ${contact.email}`);
    this.contactPickerOpen.set(false);
  }
  qrCodeFilename(): string {
    return `rubrica-assinatura-${this.selectedRequest()?.id ?? 'documento'}.png`;
  }
  fileSize(bytes: number | null): string {
    if (bytes === null) return this.i18n.text('unavailable');
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  requestStatusLabel(status: string): string {
    const keys = {
      draft: 'drafts',
      open: 'inSigning',
      completed: 'completedPlural',
      cancelled: 'cancelled',
      expired: 'expired',
    } as const;
    return status in keys ? this.i18n.text(keys[status as keyof typeof keys]) : status;
  }
  signerStatusLabel(status: string): string {
    const keys = {
      pending: 'pending',
      viewed: 'viewed',
      signed: 'signed',
      declined: 'declined',
    } as const;
    return status in keys ? this.i18n.text(keys[status as keyof typeof keys]) : status;
  }
  identityLabel(signer: Signer): string {
    const type = (signer.identity_document_type ?? '')
      .replace('BR_', '')
      .replace('PT_', '')
      .replaceAll('_', ' ');
    const country = this.alpha3Country(signer.identity_document_country);
    return [country, `${type} ${signer.identity_document_masked ?? ''}`.trim()]
      .filter(Boolean)
      .join(' · ');
  }
  selectedTenant(): TenantItem | undefined {
    return this.tenants().find((item) => item.id === this.tenantId);
  }
  billingTenants(): TenantItem[] {
    return this.tenants().filter((item) => item.role === 'admin');
  }
  organizationLabel(snapshot: NonNullable<Signer['representation_snapshot']>): string {
    return [snapshot.legal_name || snapshot.name, snapshot.registration_masked]
      .filter(Boolean)
      .join(' · ');
  }
  participantRoleLabel(role: Signer['participant_role']): string {
    return role === 'company_representative'
      ? this.companyRepresentativeLabel()
      : this.externalSignerLabel();
  }
  participantTypeTitle(): string {
    return this.localized({
      'pt-BR': 'Como esta pessoa assinará?',
      en: 'How will this person sign?',
      es: '¿Cómo firmará esta persona?',
      'ja-JP': 'この方の署名方法',
    });
  }
  participantTypeHelp(): string {
    return this.signerParticipantRole === 'company_representative'
      ? this.localized({
          'pt-BR':
            'Use o e-mail de um administrador ou membro ativo deste tenant. A assinatura vinculará o CPF da pessoa ao CNPJ da empresa.',
          en: 'Use the email of an active administrator or member of this tenant. The signature will bind the person’s CPF to the company’s CNPJ.',
          es: 'Usa el correo de un administrador o miembro activo de este tenant. La firma vinculará el CPF de la persona al CNPJ de la empresa.',
          'ja-JP':
            'このテナントの有効な管理者またはメンバーのメールアドレスを使用してください。署名に本人のCPFと会社のCNPJが記録されます。',
        })
      : this.localized({
          'pt-BR': 'A pessoa assinará em nome próprio, sem representar esta empresa.',
          en: 'The person will sign in their own name without representing this company.',
          es: 'La persona firmará en nombre propio, sin representar a esta empresa.',
          'ja-JP': '会社を代表せず、本人名義で署名します。',
        });
  }
  externalSignerLabel(): string {
    return this.localized({
      'pt-BR': 'Signatário externo ou pessoa física',
      en: 'External or personal signer',
      es: 'Firmante externo o persona física',
      'ja-JP': '外部署名者または個人',
    });
  }
  companyRepresentativeLabel(): string {
    return this.localized({
      'pt-BR': 'Representante da empresa',
      en: 'Company representative',
      es: 'Representante de la empresa',
      'ja-JP': '会社代表者',
    });
  }
  participantRoleOptions(): RubricaSelectOption[] {
    const options: RubricaSelectOption[] = [
      { value: 'external_signer', label: this.externalSignerLabel() },
    ];
    if (this.selectedTenant()?.kind === 'business')
      options.push({ value: 'company_representative', label: this.companyRepresentativeLabel() });
    return options;
  }
  selectParticipantRole(value: string): void {
    this.signerParticipantRole = value as 'external_signer' | 'company_representative';
  }
  private localized(values: Record<Locale, string>): string {
    return values[this.i18n.locale()];
  }

  private alpha3Country(country: string | null | undefined): string {
    return (
      ({ BR: 'BRA', JP: 'JPN', PT: 'PRT', US: 'USA' } as Record<string, string>)[
        (country ?? '').toUpperCase()
      ] ?? (country ?? '').toUpperCase()
    );
  }
  signatureProgress(request: SignatureRequest): number {
    return request.signer_count
      ? Math.round((request.signed_count / request.signer_count) * 100)
      : 0;
  }
  billingFor(tenantId: string): BillingAccount | null {
    return this.billingAccounts()[tenantId] ?? null;
  }
  billingPlanLabel(tenantId: string): string {
    const account = this.billingFor(tenantId);
    if (!account) return this.i18n.text('unavailable');
    if (account.complimentary_lifetime) return this.i18n.text('lifetimePlan');
    if (account.current_product_code === 'rubrica_team' && this.billingFileLimit(account) !== null)
      return this.localized({ 'pt-BR': 'Equipe', en: 'Team', es: 'Equipo', 'ja-JP': 'チーム' });
    if (
      account.current_product_code === 'rubrica_intermediate' &&
      this.billingFileLimit(account) !== null
    )
      return this.i18n.text('intermediatePlan');
    if (account.current_product_code === 'rubrica_base' && this.billingFileLimit(account) !== null)
      return this.i18n.text('basePlan');
    return this.i18n.text('free');
  }
  billingUsage(tenantId: string): string {
    const account = this.billingFor(tenantId);
    if (!account) return this.i18n.text('unavailable');
    return this.billingFileLimit(account) !== null
      ? this.i18n.text('files', { count: account.files_uploaded_in_period ?? 0 })
      : this.i18n.text('signatures', { count: account.signatures_used });
  }
  billingAvailability(tenantId: string): string {
    const account = this.billingFor(tenantId);
    if (!account) return this.i18n.text('unavailable');
    if (account.unlimited_files) return this.i18n.text('unlimited');
    const limit = this.billingFileLimit(account);
    if (limit !== null)
      return this.i18n.text('filesRemainingOf', {
        remaining:
          account.files_remaining ?? Math.max(limit - (account.files_uploaded_in_period ?? 0), 0),
        limit,
      });
    return this.i18n.text('remainingOf', {
      remaining: account.signatures_remaining ?? 0,
      limit: account.free_signatures_limit,
    });
  }
  billingQuotaSummary(tenantId: string): string {
    const account = this.billingFor(tenantId);
    if (!account) return this.i18n.text('unavailable');
    if (account.unlimited_files) return this.i18n.text('unlimited');
    const limit = this.billingFileLimit(account);
    const used = limit !== null ? (account.files_uploaded_in_period ?? 0) : account.signatures_used;
    return `${used} de ${limit ?? account.free_signatures_limit}`;
  }
  billingQuotaAvailable(tenantId: string): string {
    const account = this.billingFor(tenantId);
    if (!account) return this.i18n.text('unavailable');
    if (account.unlimited_files) return this.i18n.text('unlimited');
    const limit = this.billingFileLimit(account);
    return `${limit !== null ? this.i18n.text('files', { count: account.files_remaining ?? Math.max(limit - (account.files_uploaded_in_period ?? 0), 0) }) : this.i18n.text('signatures', { count: account.signatures_remaining ?? 0 })} ${this.availableLabel()}`;
  }
  totalSignaturesLabel(): string {
    return this.localized({
      'pt-BR': 'Total de assinaturas',
      en: 'Total signatures',
      es: 'Total de firmas',
      'ja-JP': '署名総数',
    });
  }
  monthlyAllowanceLabel(): string {
    return this.localized({
      'pt-BR': 'Franquia mensal',
      en: 'Monthly allowance',
      es: 'Cuota mensual',
      'ja-JP': '月間利用枠',
    });
  }
  availableLabel(): string {
    return this.localized({
      'pt-BR': 'disponíveis',
      en: 'available',
      es: 'disponibles',
      'ja-JP': '利用可能',
    });
  }
  emailInvitationsEnabled(): boolean {
    return this.billingFor(this.tenantId)?.email_invitations_enabled === true;
  }

  showUploadModal(): void {
    this.uploadModalOpen.set(true);
    this.syncModalLock();
  }
  closeUploadModal(): void {
    this.uploadModalOpen.set(false);
    this.syncModalLock();
  }
  closeRequestCreateModal(): void {
    this.requestCreateModalOpen.set(false);
    this.syncModalLock();
  }
  closeRequestModal(): void {
    this.requestModalOpen.set(false);
    this.syncModalLock();
  }
  selectFile(event: Event): void {
    this.setFile((event.target as HTMLInputElement).files?.item(0) ?? null);
  }
  dropFile(event: DragEvent): void {
    event.preventDefault();
    this.setFile(event.dataTransfer?.files.item(0) ?? null);
  }
  prepareRequest(document: DocumentItem): void {
    this.selectedDocument.set(document);
    this.expiresAt = dateTime.localInputAfterDays(3);
    this.requestCreateModalOpen.set(true);
    this.syncModalLock();
  }
  async openRequestDetails(request: SignatureRequest): Promise<void> {
    this.selectedRequest.set(request);
    this.selectedDocument.set(null);
    this.requestQrCode.set('');
    this.contactSearch.set('');
    this.signerName = '';
    this.signerEmail = '';
    this.signerLocale = this.i18n.locale();
    this.requestEvidence.set([]);
    this.requestModalOpen.set(true);
    this.syncModalLock();
    this.detailsLoading.set(true);
    try {
      await this.loadSigners(request.id);
      if (request.status === 'draft') await this.loadSignerContacts();
      if (this.isAdmin() && request.status !== 'draft') await this.loadAdminRequestDetails(request);
    } catch (error) {
      await this.feedback.error(error, this.i18n.text('detailsLoadFailed'));
    } finally {
      this.detailsLoading.set(false);
    }
  }

  async preview(document: DocumentItem): Promise<void> {
    await this.run(async () => {
      const data = await firstValueFrom(
        this.api.getArrayBuffer(`/documents/${document.id}/preview?version=${document.version}`),
      );
      if (!data.byteLength) throw new Error('Document preview is empty');
      this.previewHeading.set(this.i18n.text('originalDocument'));
      this.previewDocument.set(document);
      this.previewData.set(data);
      this.syncModalLock();
    });
  }
  async previewSignedRequest(): Promise<void> {
    const request = this.selectedRequest();
    const document = this.documents().find((item) => item.id === request?.document_id);
    if (!request || !document) return;
    await this.run(async () => {
      const data = await firstValueFrom(
        this.api.getArrayBuffer(`/signature-requests/${request.id}/signed-document`),
      );
      if (!data.byteLength) throw new Error('Signed document preview is empty');
      this.previewHeading.set(this.i18n.text('stampedPdf'));
      this.previewDocument.set(document);
      this.previewData.set(data);
      this.syncModalLock();
    });
  }
  closePreview(): void {
    this.previewDocument.set(null);
    this.previewData.set(null);
    this.syncModalLock();
  }
  downloadPreview(): void {
    const data = this.previewData();
    const document = this.previewDocument();
    if (!data || !document) return;
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.original_filename || 'documento.pdf';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async deleteDocument(document: DocumentItem): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: this.i18n.text('deleteDocumentTitle'),
      text: this.i18n.text('deleteDocumentHelp'),
      showCancelButton: true,
      confirmButtonText: this.i18n.text('deleteAction'),
      cancelButtonText: this.i18n.text('cancel'),
      confirmButtonColor: '#b42318',
    });
    if (!result.isConfirmed) return;
    this.submitting.set(true);
    try {
      await firstValueFrom(this.api.delete(`/documents/${document.id}`));
      this.removeDeletedDocument(document.id);
    } catch (error) {
      const conflict = this.activeRequestConflict(error);
      if (!conflict) {
        await this.feedback.error(error);
        return;
      }
      const forced = await Swal.fire({
        icon: 'warning',
        title: this.i18n.text('deleteActiveTitle'),
        text: this.i18n.text('deleteActiveHelp', { count: conflict.count }),
        showCancelButton: true,
        confirmButtonText: this.i18n.text('forceDelete'),
        cancelButtonText: this.i18n.text('cancel'),
        confirmButtonColor: '#b42318',
      });
      if (!forced.isConfirmed) return;
      try {
        await firstValueFrom(this.api.delete(`/documents/${document.id}?force=true`));
        this.removeDeletedDocument(document.id);
      } catch (forcedError) {
        await this.feedback.error(forcedError);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async upload(): Promise<void> {
    if (!this.file || !this.tenantSlug || this.submitting()) return;
    this.submitting.set(true);
    try {
      const file = this.file;
      const content = await file.arrayBuffer();
      await firstValueFrom(
        this.api.postFile<DocumentItem>('/documents', content, file.type || 'application/pdf', {
          organization_id: this.tenantSlug,
          title: this.title,
          filename: file.name,
          content_type: file.type || 'application/pdf',
        }),
      );
      this.title = '';
      this.file = null;
      this.closeUploadModal();
      await this.reload();
      await Swal.fire({
        icon: 'success',
        title: this.i18n.text('documentSent'),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      if (this.requiresPdfFlattening(error)) await this.showPdfUploadHelp();
      else await this.feedback.error(error);
    } finally {
      this.submitting.set(false);
    }
  }
  async createRequest(): Promise<void> {
    const document = this.selectedDocument();
    if (!document || !this.expiresAt) return;
    await this.run(async () => {
      const request = await firstValueFrom(
        this.api.post<SignatureRequest>('/signature-requests', {
          document_id: document.id,
          expires_at: dateTime.toUtcIso(this.expiresAt),
        }),
      );
      this.requests.update((items) => [request, ...items]);
      this.closeRequestCreateModal();
      await this.openRequestDetails(request);
    });
  }
  startReopenRequest(): void {
    const request = this.selectedRequest();
    if (!request) return;
    if (request.child_request_id) {
      const child = this.requests().find((item) => item.id === request.child_request_id);
      if (child) void this.openRequestDetails(child);
      return;
    }
    this.reopenReason = '';
    this.reopenExpiresAt = '';
    this.reopenSignerIds = new Set(
      this.signers()
        .filter((item) => item.status !== 'signed')
        .map((item) => item.id),
    );
    this.reopenModalOpen.set(true);
    this.syncModalLock();
  }
  closeReopenModal(): void {
    this.reopenModalOpen.set(false);
    this.syncModalLock();
  }
  reopenCandidates(): Signer[] {
    return this.signers().filter((item) => item.status !== 'signed');
  }
  toggleReopenSigner(id: string, event: Event): void {
    const next = new Set(this.reopenSignerIds);
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.reopenSignerIds = next;
  }
  async reopenRequest(): Promise<void> {
    const parent = this.selectedRequest();
    if (!parent || !this.reopenExpiresAt || this.reopenReason.trim().length < 5) return;
    await this.run(async () => {
      const reopened = await firstValueFrom(
        this.api.post<SignatureRequest>(`/signature-requests/${parent.id}/reopen`, {
          expires_at: dateTime.toUtcIso(this.reopenExpiresAt),
          reason: this.reopenReason.trim(),
          pending_signer_ids: [...this.reopenSignerIds],
        }),
      );
      this.requests.update((items) => [
        reopened,
        ...items.map((item) =>
          item.id === parent.id ? { ...item, child_request_id: reopened.id } : item,
        ),
      ]);
      this.closeReopenModal();
      await this.openRequestDetails(reopened);
    });
  }
  selectedRequestRounds(): SignatureRequest[] {
    const selected = this.selectedRequest();
    if (!selected) return [];
    return this.requests()
      .filter(
        (item) =>
          item.document_id === selected.document_id &&
          item.document_version === selected.document_version,
      )
      .sort((left, right) => (left.round_number || 1) - (right.round_number || 1));
  }
  roundLabel(request: SignatureRequest): string {
    return `${this.i18n.locale() === 'pt-BR' ? 'Rodada' : 'Round'} ${request.round_number || 1}`;
  }
  reopenRequestLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Reabrir para assinatura' : 'Reopen for signing';
  }
  signingRoundsLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Histórico de rodadas' : 'Signing round history';
  }
  reopenReasonLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Motivo da reabertura' : 'Reason for reopening';
  }
  pendingSignersLabel(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'Signatários pendentes que serão mantidos'
      : 'Pending signers to keep';
  }
  noPendingSignersLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Nenhum signatário pendente.' : 'No pending signers.';
  }
  addSignersAfterReopenHelp(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'Depois de criar a rodada, você poderá adicionar novos signatários antes de abri-la.'
      : 'After creating the round, you can add new signers before opening it.';
  }
  reopenImmutabilityHelp(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'A rodada expirada e suas assinaturas permanecerão imutáveis. Uma nova rodada em rascunho será criada.'
      : 'The expired round and its signatures remain immutable. A new draft round will be created.';
  }
  async addSigner(): Promise<void> {
    const request = this.selectedRequest();
    if (!request || !this.signerName.trim() || !this.signerEmail.trim()) return;
    const representedTenantId =
      this.signerParticipantRole === 'company_representative' ? this.tenantId : null;
    await this.run(async () => {
      await firstValueFrom(
        this.api.post<Signer>(`/signature-requests/${request.id}/signers`, {
          name: this.signerName.trim(),
          email: this.signerEmail.trim().toLowerCase(),
          preferred_locale: this.signerLocale,
          participant_role: this.signerParticipantRole,
          represented_tenant_id: representedTenantId,
        }),
      );
      this.signerName = '';
      this.signerEmail = '';
      this.signerLocale = this.i18n.locale();
      this.signerParticipantRole = 'external_signer';
      this.contactSearch.set('');
      await Promise.all([this.loadSigners(request.id), this.loadSignerContacts()]);
      const refreshed = await firstValueFrom(
        this.api.get<SignatureRequest>(`/signature-requests/${request.id}`),
      );
      this.updateRequest(refreshed);
    });
  }
  customStampPlacementEnabled(): boolean {
    return Boolean(this.billingAccounts()[this.tenantId]?.custom_stamp_placement);
  }
  customStampBrandingEnabled(): boolean {
    return Boolean(this.billingAccounts()[this.tenantId]?.custom_stamp_branding);
  }
  async openStampEditor(): Promise<void> {
    const request = this.selectedRequest();
    if (!request || !this.customStampPlacementEnabled()) return;
    await this.run(async () => {
      const [configuration, pdf, tenantDefault] = await Promise.all([
        firstValueFrom(
          this.api.get<StampConfiguration>(`/signature-requests/${request.id}/stamp-configuration`),
        ),
        firstValueFrom(this.api.getArrayBuffer(`/documents/${request.document_id}/preview`)),
        this.customStampBrandingEnabled()
          ? firstValueFrom(
              this.api.get<StampCustomization | null>(
                `/tenants/${this.tenantId}/stamp-customization`,
              ),
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      this.stampPlacements.set(configuration.placements);
      const legacyCustomization = configuration.customization;
      const signerCustomizations = await Promise.all(this.signers().map(async (signer) => {
        const configured = configuration.signer_customizations?.[signer.id] || legacyCustomization;
        const base = configured || tenantDefault;
        return [signer.id, {
          template: base?.template || 'standard',
          display_variant: base?.display_variant || 'full',
          primary_color: base?.primary_color || '#187A66',
          show_logo: configured?.show_logo || false,
          logo_png_data_url: configured?.show_logo ? await this.normalizeStampLogoDataUrl(configured.logo_png_data_url || null) : null,
          require_drawn_signature: base?.require_drawn_signature || false,
        } satisfies StampCustomization] as const;
      }));
      this.stampSignerCustomizations = Object.fromEntries(signerCustomizations);
      this.stampSignerModes = Object.fromEntries(
        this.signers().map((signer) => [
          signer.id,
          configuration.signer_signature_modes?.[signer.id] ||
            signer.signature_mode ||
            'serpro_timestamp',
        ]),
      );
      this.stampVariants = Object.fromEntries(
        this.signers().map((signer) => [
          signer.id,
          configuration.placements.find((item) => item.signer_id === signer.id)?.display_variant ||
            this.stampSignerCustomizations[signer.id]?.display_variant ||
            'full',
        ]),
      );
      this.stampSignerId = this.signers()[0]?.id || '';
      this.stampCustomization = this.stampSignerCustomizations[this.stampSignerId] || this.emptyStampCustomization();
      this.stampEditorPdf.set(pdf);
      this.stampEditorOpen.set(true);
      this.syncModalLock();
    });
  }
  closeStampEditor(): void {
    this.stampEditorOpen.set(false);
    this.stampMobileControlsOpen.set(false);
    this.stampEditorPdf.set(null);
    this.syncModalLock();
  }
  toggleStampMobileControls(): void {
    this.stampMobileControlsOpen.update((open) => !open);
  }
  toggleStampPdfFitMode(): void {
    this.stampPdfFitMode.update((mode) => (mode === 'page' ? 'width' : 'page'));
  }
  mobileRequestExpanded(id: string): boolean {
    return this.expandedMobileRequests().has(id);
  }
  toggleMobileRequest(id: string): void {
    this.expandedMobileRequests.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  mobileDocumentExpanded(id: string): boolean {
    return this.expandedMobileDocuments().has(id);
  }
  toggleMobileDocument(id: string, event: Event): void {
    const opening = !this.mobileDocumentExpanded(id);
    this.expandedMobileDocuments.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!opening || typeof window === 'undefined') return;
    const item = (event.currentTarget as HTMLElement).closest<HTMLElement>('.document-mobile-item');
    window.setTimeout(() => {
      if (!item || !this.mobileDocumentExpanded(id)) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const bounds = item.getBoundingClientRect();
      if (bounds.bottom > viewportBottom || bounds.top < viewportTop)
        item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
  addStampPlacement(position: StampPosition): void {
    if (!this.stampSignerId) return;
    const next = {
      ...position,
      signer_id: this.stampSignerId,
      display_variant: this.stampVariant(),
      width: position.width ?? 0.4,
      height: position.height ?? 0.12,
      order: position.order ?? this.stampPlacements().length,
    };
    this.stampPlacements.update((items) => [
      ...items.filter((item) => !(item.signer_id === next.signer_id && item.page === next.page)),
      next,
    ]);
  }
  replicateStampOnEveryPage(): void {
    const source = [...this.stampPlacements()]
      .reverse()
      .find((item) => item.signer_id === this.stampSignerId);
    if (!source || !this.stampPageCount) return;
    this.stampPlacements.update((items) => [
      ...items.filter((item) => item.signer_id !== this.stampSignerId),
      ...Array.from({ length: this.stampPageCount }, (_, index) => ({
        ...source,
        page: index + 1,
        order: items.length + index,
      })),
    ]);
  }
  async saveStampConfiguration(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;
    const payload: StampConfiguration = {
      placements: this.stampPlacements(),
      customization: null,
      signer_customizations: this.customStampBrandingEnabled() ? this.stampSignerCustomizations : {},
      signer_signature_modes: this.stampSignerModes,
    };
    await this.run(async () => {
      await firstValueFrom(
        this.api.put<StampConfiguration>(
          `/signature-requests/${request.id}/stamp-configuration`,
          payload,
        ),
      );
      this.closeStampEditor();
    });
  }
  async saveTenantStampDefault(): Promise<void> {
    if (!this.customStampBrandingEnabled()) return;
    await this.run(async () => {
      this.stampCustomization = await firstValueFrom(
        this.api.put<StampCustomization>(
          `/tenants/${this.tenantId}/stamp-customization`,
          this.stampCustomization,
        ),
      );
      await Swal.fire({
        icon: 'success',
        title: this.tenantStampDefaultSavedLabel(),
        timer: 1400,
        showConfirmButton: false,
      });
    });
  }
  async selectStampLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || file.type !== 'image/png' || file.size > 256_000) {
      input.value = '';
      await this.feedback.warning('Selecione um PNG válido de até 256 KB.');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const pngEnd = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    const validHeader =
      bytes.length >= 20 && pngHeader.every((value, index) => bytes[index] === value);
    const validEnd =
      bytes.length >= pngEnd.length &&
      pngEnd.every((value, index) => bytes[bytes.length - pngEnd.length + index] === value);
    if (!validHeader || !validEnd) {
      input.value = '';
      await this.feedback.warning('O arquivo não contém uma imagem PNG segura.');
      return;
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
      const validDimensions =
        bitmap.width <= 2048 && bitmap.height <= 2048 && bitmap.width * bitmap.height <= 4_000_000;
      if (!validDimensions) throw new Error('invalid dimensions');
    } catch {
      input.value = '';
      await this.feedback.warning('PNG inválido ou maior que 2048 × 2048 pixels.');
      return;
    }
    const dataUrl = await this.trimTransparentPng(bitmap);
    bitmap.close();
    this.stampLogoName = file.name;
    this.stampCustomization = {
      ...this.stampCustomization,
      logo_png_data_url: dataUrl,
      show_logo: true,
    };
    this.persistCurrentSignerCustomization();
  }
  removeStampLogo(): void {
    this.stampLogoName = '';
    this.stampCustomization = { ...this.stampCustomization, show_logo: false, logo_png_data_url: null };
    this.persistCurrentSignerCustomization();
  }
  private async trimTransparentPng(bitmap: ImageBitmap): Promise<string> {
    const source = document.createElement('canvas');
    source.width = bitmap.width;
    source.height = bitmap.height;
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('canvas unavailable');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    let left = source.width;
    let top = source.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) throw new Error('empty image');
    const output = document.createElement('canvas');
    output.width = right - left + 1;
    output.height = bottom - top + 1;
    output
      .getContext('2d')
      ?.drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
    return output.toDataURL('image/png');
  }
  private async normalizeStampLogoDataUrl(dataUrl: string | null): Promise<string | null> {
    if (!dataUrl) return null;
    try {
      const response = await fetch(dataUrl);
      const bitmap = await createImageBitmap(await response.blob());
      const normalized = await this.trimTransparentPng(bitmap);
      bitmap.close();
      return normalized;
    } catch {
      return dataUrl;
    }
  }
  stampSignerName(): string {
    return this.signers().find((item) => item.id === this.stampSignerId)?.name || '';
  }
  stampSignerOptions(): RubricaSelectOption[] {
    return this.signers().map((signer) => ({ value: signer.id, label: signer.name }));
  }
  stampSignerMode(): 'serpro_timestamp' | 'serproid' {
    return this.stampSignerModes[this.stampSignerId] || 'serpro_timestamp';
  }
  stampSignatureModeOptions(): RubricaSelectOption[] {
    return [
      { value: 'serpro_timestamp', label: 'Evidências Rúbrica + Carimbo do Tempo' },
      { value: 'serproid', label: 'Evidências Rúbrica + Serpro ID' },
    ];
  }
  async selectStampSignerMode(value: string): Promise<void> {
    if (!this.stampSignerId || (value !== 'serpro_timestamp' && value !== 'serproid')) return;
    const signer = this.signers().find((item) => item.id === this.stampSignerId);
    if (value === 'serproid' && signer && !['BR_CPF', 'BR_CNPJ'].includes(signer.identity_document_type || '')) {
      const result = await Swal.fire({
        icon: 'info',
        title: 'Conta necessária para usar Serpro ID',
        text: `${signer.name} ainda não possui uma conta Rubrica com CPF ou CNPJ cadastrado. Deseja enviar um e-mail para ${signer.email} criar a conta e informar o CPF e a senha?`,
        showCancelButton: true,
        confirmButtonText: 'Enviar convite',
        cancelButtonText: this.i18n.text('cancel'),
        confirmButtonColor: '#a82035',
      });
      if (!result.isConfirmed) return;
      const request = this.selectedRequest();
      if (!request) return;
      try {
        await firstValueFrom(this.api.post(`/signature-requests/${request.id}/signers/${signer.id}/account-invitation`, {}));
        this.stampSignerModes = { ...this.stampSignerModes, [this.stampSignerId]: value };
        await this.feedback.success(`Convite enviado para ${signer.email}. Abra a solicitação depois que o signatário ativar a conta e cadastrar o CPF.`);
      } catch (error) {
        await this.feedback.error(error);
      }
      return;
    }
    this.stampSignerModes = { ...this.stampSignerModes, [this.stampSignerId]: value };
  }
  stampVariant(): 'full' | 'minimal' | 'drawn' {
    return this.stampVariants[this.stampSignerId] || 'full';
  }
  selectStampSigner(value: string): void {
    this.persistCurrentSignerCustomization();
    this.stampSignerId = value;
    this.stampCustomization = this.stampSignerCustomizations[value] || this.emptyStampCustomization();
    this.stampLogoName = this.stampCustomization.show_logo ? 'Logo selecionada' : '';
    if (!this.stampVariants[value]) this.stampVariants[value] = 'full';
  }
  selectStampVariant(value: 'full' | 'minimal' | 'drawn'): void {
    if (this.stampSignerId)
      this.stampVariants = { ...this.stampVariants, [this.stampSignerId]: value };
  }
  stampTemplateOptions(): RubricaSelectOption[] {
    return [
      { value: 'standard', label: 'Padrão' },
      { value: 'business', label: 'CNPJ' },
      { value: 'representative', label: this.representativeLabel() },
    ];
  }
  selectStampTemplate(value: string): void {
    if (value === 'standard' || value === 'business' || value === 'representative')
      this.stampCustomization = { ...this.stampCustomization, template: value };
    this.persistCurrentSignerCustomization();
  }
  selectStampColor(value: string): void {
    this.stampCustomization = { ...this.stampCustomization, primary_color: value };
    this.persistCurrentSignerCustomization();
  }
  private persistCurrentSignerCustomization(): void {
    if (this.stampSignerId) this.stampSignerCustomizations = { ...this.stampSignerCustomizations, [this.stampSignerId]: { ...this.stampCustomization } };
  }
  private emptyStampCustomization(): StampCustomization {
    return { template: 'standard', display_variant: 'full', primary_color: '#187A66', show_logo: false, logo_png_data_url: null, require_drawn_signature: false };
  }
  stampSignerIdentity(): string {
    const signer = this.signers().find((item) => item.id === this.stampSignerId);
    return signer?.identity_document_masked
      ? `${(signer.identity_document_type || '').replace('BR_', '')}: ${signer.identity_document_masked}`
      : 'CPF/CNPJ confirmado no momento da assinatura';
  }
  stampSignerRepresentation(): string {
    const signer = this.signers().find((item) => item.id === this.stampSignerId);
    const organization = signer?.representation_snapshot || this.selectedRequest()?.issuer_snapshot;
    return organization
      ? [organization.legal_name || organization.name, organization.registration_masked]
          .filter(Boolean)
          .join(' · CNPJ: ')
      : '';
  }
  stampEditorLabel(): string {
    return this.customStampBrandingEnabled()
      ? this.i18n.locale() === 'pt-BR'
        ? 'Posicionar e personalizar carimbos'
        : 'Position and customize stamps'
      : this.i18n.locale() === 'pt-BR'
        ? 'Posicionar carimbos'
        : 'Position stamps';
  }
  signerForStampLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Signatário' : 'Signer';
  }
  stampColorLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Cor do carimbo' : 'Stamp color';
  }
  drawnSignatureLabel(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'Exigir assinatura desenhada'
      : 'Require drawn signature';
  }
  everyPageLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Repetir em todas as páginas' : 'Repeat on every page';
  }
  representativeLabel(): string {
    return this.i18n.locale() === 'pt-BR' ? 'Representante' : 'Representative';
  }
  tenantStampDefaultLabel(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'Salvar identidade visual da empresa'
      : 'Save company visual identity';
  }
  tenantStampDefaultSavedLabel(): string {
    return this.i18n.locale() === 'pt-BR'
      ? 'Identidade visual da empresa salva'
      : 'Company visual identity saved';
  }
  async openRequest(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;
    const ineligible = this.signers().find((signer) =>
      this.stampSignerModes[signer.id] === 'serproid' &&
      !['BR_CPF', 'BR_CNPJ'].includes(signer.identity_document_type || ''),
    );
    if (ineligible) {
      const invite = await Swal.fire({
        icon: 'info',
        title: 'Conta necessária para usar Serpro ID',
        text: `${ineligible.name} ainda não possui uma conta Rubrica com CPF ou CNPJ cadastrado. Deseja enviar um e-mail para ${ineligible.email} criar a conta e informar o CPF e a senha?`,
        showCancelButton: true,
        confirmButtonText: 'Enviar convite',
        cancelButtonText: this.i18n.text('cancel'),
        confirmButtonColor: '#a82035',
      });
      if (invite.isConfirmed) {
        try {
          await firstValueFrom(this.api.post(`/signature-requests/${request.id}/signers/${ineligible.id}/account-invitation`, {}));
          await this.feedback.success(`Convite enviado para ${ineligible.email}. Abra a solicitação depois que o signatário ativar a conta e cadastrar o CPF.`);
        } catch (error) {
          await this.feedback.error(error);
        }
      }
      return;
    }
    const result = await Swal.fire({
      icon: 'question',
      title: this.i18n.text('openForSigning'),
      text: 'Os métodos definidos para cada signatário serão usados.',
      showCancelButton: true,
      confirmButtonText: this.i18n.text('openForSigning'),
      cancelButtonText: this.i18n.text('back'),
      confirmButtonColor: '#a82035',
    });
    if (!result.isConfirmed) return;
    await this.run(async () => {
      const opened = await firstValueFrom(
        this.api.post<SignatureRequest>(`/signature-requests/${request.id}/open`, {
          signature_mode: 'serpro_timestamp',
        }),
      );
      this.updateRequest(opened);
      const link = await firstValueFrom(
        this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {}),
      );
      await this.storeSigningLink(request.id, link.signing_url);
    });
  }

  private signatureModeOptions(
    timestampEnabled: boolean,
    serproidEnabled: boolean,
    serproidSimulated = false,
  ): Record<string, string> {
    const locale = this.i18n.locale();
    const options: Record<string, string> = {};
    if (!timestampEnabled)
      options['evidence'] = (
        {
          'pt-BR': 'Somente evidências do Rúbrica (sem carimbo do tempo)',
          en: 'Rubrica evidence only (without trusted timestamp)',
          es: 'Solo evidencias de Rubrica (sin sello de tiempo)',
          'ja-JP': 'Rubrica 証拠情報のみ（タイムスタンプなし）',
        } as Record<string, string>
      )[locale];
    if (timestampEnabled)
      options['serpro_timestamp'] = (
        {
          'pt-BR': 'Evidências + carimbo do tempo SERPRO',
          en: 'Evidence + SERPRO timestamp',
          es: 'Evidencias + sello de tiempo SERPRO',
          'ja-JP': '証拠情報 + SERPRO タイムスタンプ',
        } as Record<string, string>
      )[locale];
    if (timestampEnabled && serproidEnabled)
      options['serproid'] = (
        {
          'pt-BR': 'Evidências + Serpro ID + carimbo do tempo SERPRO',
          en: 'Evidence + Serpro ID + SERPRO timestamp',
          es: 'Evidencias + Serpro ID + sello de tiempo SERPRO',
          'ja-JP': '証拠情報 + Serpro ID + SERPRO タイムスタンプ',
        } as Record<string, string>
      )[locale];
    if (serproidSimulated)
      options['serproid'] = (
        {
          'pt-BR': 'Serpro ID simulado (somente teste, sem certificado ICP-Brasil)',
          en: 'Simulated Serpro ID (test only, no ICP-Brasil certificate)',
          es: 'Serpro ID simulado (solo prueba, sin certificado ICP-Brasil)',
          'ja-JP': 'Serpro ID シミュレーション（テスト専用・ICP-Brasil証明書なし）',
        } as Record<string, string>
      )[locale];
    return options;
  }

  private signatureModeTitle(): string {
    return (
      {
        'pt-BR': 'Escolha como o documento será assinado',
        en: 'Choose how the document will be signed',
        es: 'Elija cómo se firmará el documento',
        'ja-JP': '署名方法を選択',
      } as Record<string, string>
    )[this.i18n.locale()];
  }
  private signatureModeHelp(): string {
    return (
      {
        'pt-BR':
          'A modalidade será fixada ao abrir a solicitação. Serpro ID aceita um único signatário.',
        en: 'The method is locked when the request opens. Serpro ID supports one signer.',
        es: 'La modalidad queda fijada al abrir la solicitud. Serpro ID admite un firmante.',
        'ja-JP': '依頼を開始すると方式は固定されます。Serpro ID は署名者1名に対応します。',
      } as Record<string, string>
    )[this.i18n.locale()];
  }
  private timestampRequiredHelp(): string {
    return (
      {
        'pt-BR': 'O carimbo do tempo SERPRO é obrigatório para abrir novas solicitações.',
        en: 'A SERPRO trusted timestamp is required to open new requests.',
        es: 'El sello de tiempo SERPRO es obligatorio para abrir nuevas solicitudes.',
        'ja-JP': '新しい依頼を開始するには SERPRO タイムスタンプが必要です。',
      } as Record<string, string>
    )[this.i18n.locale()];
  }
  private signatureModeRequired(): string {
    return (
      {
        'pt-BR': 'Escolha uma modalidade.',
        en: 'Choose a method.',
        es: 'Elija una modalidad.',
        'ja-JP': '方式を選択してください。',
      } as Record<string, string>
    )[this.i18n.locale()];
  }
  signatureModeFieldLabel(): string {
    return (
      { 'pt-BR': 'Modalidade', en: 'Method', es: 'Modalidad', 'ja-JP': '方式' } as Record<
        string,
        string
      >
    )[this.i18n.locale()];
  }
  signatureModeLabel(mode: SignatureMode): string {
    return this.signatureModeOptions(true, true)[mode] ?? mode;
  }
  async generateLink(): Promise<void> {
    const request = this.selectedRequest();
    if (!request) return;
    if (this.requestLink()) {
      const result = await Swal.fire({
        icon: 'warning',
        title: this.i18n.text('rotateLinkTitle'),
        text: this.i18n.text('rotateLinkHelp'),
        showCancelButton: true,
        confirmButtonText: this.i18n.text('rotateLink'),
        cancelButtonText: this.i18n.text('cancel'),
        confirmButtonColor: '#b42318',
      });
      if (!result.isConfirmed) return;
    }
    await this.run(async () => {
      const link = await firstValueFrom(
        this.api.post<SigningLink>(`/signature-requests/${request.id}/signing-link`, {}),
      );
      await this.storeSigningLink(request.id, link.signing_url);
    });
  }
  async copyInvite(): Promise<void> {
    await this.run(async () => {
      await navigator.clipboard.writeText(this.requestLink());
      await Swal.fire({
        icon: 'success',
        title: this.i18n.text('linkCopied'),
        toast: true,
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false,
      });
    });
  }
  openInvite(): void {
    const link = this.requestLink();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }
  async showEvidence(): Promise<void> {
    const rows = this.requestEvidence();
    if (!rows.length) {
      await this.feedback.warning(this.i18n.text('evidenceUnavailable'));
      return;
    }
    const result = await Swal.fire({
      title: this.i18n.text('signatureEvidence'),
      html: `<div style="max-height:60vh;overflow:auto;padding:.25rem">${evidenceReportHtml(rows, this.i18n.locale(), (value) => this.i18n.formatDate(value))}</div>`,
      width: 850,
      showDenyButton: true,
      denyButtonText: evidenceDownloadLabel(this.i18n.locale()),
      denyButtonColor: '#a82035',
      confirmButtonText: this.i18n.text('close'),
      confirmButtonColor: '#25344b',
    });
    if (result.isDenied) this.downloadEvidence(rows);
  }

  private downloadEvidence(rows: SignatureEvidence[]): void {
    const requestId = this.selectedRequest()?.id ?? rows[0].request_id;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }),
    );
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `rubrica-evidencias-${requestId}.json`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } catch (error) {
      await this.feedback.error(error, this.i18n.text('logoutFailed'));
    } finally {
      await this.router.navigate(['/login']);
    }
  }

  private updateRequest(request: SignatureRequest): void {
    this.requests.update((items) => items.map((item) => (item.id === request.id ? request : item)));
    this.selectedRequest.set(request);
  }
  private removeDeletedDocument(documentId: string): void {
    this.documents.update((items) => items.filter((item) => item.id !== documentId));
    this.requests.update((items) => items.filter((item) => item.document_id !== documentId));
  }
  private activeRequestConflict(error: unknown): { count: number } | null {
    const response = error as {
      status?: number;
      error?: { code?: string; active_request_count?: number };
    };
    return response?.status === 409 && response.error?.code === 'document_has_active_requests'
      ? { count: Number(response.error.active_request_count) || 1 }
      : null;
  }
  private async reload(): Promise<void> {
    const [documents, requests] = await Promise.all([
      firstValueFrom(this.api.get<DocumentItem[]>('/documents')),
      firstValueFrom(this.api.get<SignatureRequest[]>('/signature-requests')),
    ]);
    this.documents.set(documents);
    this.requests.set(
      requests.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true })),
    );
  }
  private async loadSigners(requestId: string): Promise<void> {
    this.signers.set(
      await firstValueFrom(this.api.get<Signer[]>(`/signature-requests/${requestId}/signers`)),
    );
  }
  private async loadSignerContacts(): Promise<void> {
    const tenant = this.tenants().find((item) => item.slug === this.tenantSlug);
    if (!tenant) return;
    this.signerContacts.set(
      await firstValueFrom(this.api.get<SignerContact[]>(`/tenants/${tenant.id}/signer-contacts`)),
    );
  }
  private async loadBilling(tenants: TenantItem[]): Promise<void> {
    if (!this.isAdmin()) return;
    const manageableTenants = tenants.filter((tenant) => tenant.role === 'admin');
    const results = await Promise.allSettled(
      manageableTenants.map(
        async (tenant) =>
          [
            tenant.id,
            await firstValueFrom(
              this.api.get<BillingAccount>(`/billing/tenants/${tenant.id}/account`),
            ),
          ] as const,
      ),
    );
    const accounts: Record<string, BillingAccount> = {};
    for (const result of results)
      if (result.status === 'fulfilled') accounts[result.value[0]] = result.value[1];
    this.billingAccounts.set(accounts);
  }
  private billingFileLimit(account: BillingAccount): number | null {
    if (typeof account.files_limit === 'number') return account.files_limit;
    if (!['active', 'past_due'].includes(account.status)) return null;
    if (account.current_product_code === 'rubrica_base') return 20;
    if (account.current_product_code === 'rubrica_intermediate') return 80;
    if (account.current_product_code === 'rubrica_team') return 200;
    return null;
  }
  private async loadAdminRequestDetails(request: SignatureRequest): Promise<void> {
    const [link, evidence] = await Promise.allSettled([
      firstValueFrom(this.api.get<SigningLink>(`/signature-requests/${request.id}/signing-link`)),
      firstValueFrom(
        this.api.get<SignatureEvidence[]>(`/signature-requests/${request.id}/evidence`),
      ),
    ]);
    if (link.status === 'fulfilled')
      await this.storeSigningLink(request.id, link.value.signing_url);
    if (evidence.status === 'fulfilled') this.requestEvidence.set(evidence.value);
  }
  private async storeSigningLink(requestId: string, url: string): Promise<void> {
    this.requestLinks.update((items) => ({ ...items, [requestId]: url }));
    this.requestQrCode.set(await QRCode.toDataURL(url, { width: 220, margin: 2 }));
  }
  private syncModalLock(): void {
    if (
      this.uploadModalOpen() ||
      this.requestCreateModalOpen() ||
      this.requestModalOpen() ||
      this.reopenModalOpen() ||
      this.stampEditorOpen() ||
      this.previewDocument()
    )
      this.lockPageScroll();
    else this.unlockPageScroll();
  }
  private lockPageScroll(): void {
    if (this.modalLocked || typeof document === 'undefined' || typeof window === 'undefined')
      return;
    this.modalLocked = true;
    this.modalScrollY = window.scrollY;
    this.modalBodyStyle = document.body.getAttribute('style');
    Object.assign(document.body.style, {
      position: 'fixed',
      top: `-${this.modalScrollY}px`,
      right: '0',
      left: '0',
      width: '100%',
      overflow: 'hidden',
    });
    this.updateModalViewport();
    window.visualViewport?.addEventListener('resize', this.updateModalViewport);
    window.visualViewport?.addEventListener('scroll', this.updateModalViewport);
  }
  private unlockPageScroll(): void {
    if (!this.modalLocked || typeof document === 'undefined' || typeof window === 'undefined')
      return;
    this.modalLocked = false;
    window.visualViewport?.removeEventListener('resize', this.updateModalViewport);
    window.visualViewport?.removeEventListener('scroll', this.updateModalViewport);
    if (this.modalBodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', this.modalBodyStyle);
    document.documentElement.style.removeProperty('--rubrica-modal-top');
    document.documentElement.style.removeProperty('--rubrica-modal-height');
    window.scrollTo(0, this.modalScrollY);
  }
  private async run(action: () => Promise<void>): Promise<void> {
    this.submitting.set(true);
    try {
      await action();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.submitting.set(false);
    }
  }
  private requiresPdfFlattening(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('error' in error)) return false;
    const body = (error as { error?: unknown }).error;
    return (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      (body as { code?: unknown }).code === 'pdf_requires_flattening'
    );
  }
  private async showPdfUploadHelp(): Promise<void> {
    const clientNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = detectClientPlatform(
      clientNavigator.userAgent,
      clientNavigator.userAgentData?.platform || clientNavigator.platform,
      clientNavigator.maxTouchPoints,
    );
    const help = pdfUploadHelp(this.i18n.locale(), platform);
    await Swal.fire({
      icon: 'warning',
      title: help.title,
      html: help.html,
      width: 680,
      confirmButtonText: this.i18n.text('understood'),
      confirmButtonColor: '#a82035',
    });
  }
  private setFile(file: File | null): void {
    if (!file) return;
    if ([...file.name].length > 120) {
      void this.feedback.warning(
        this.i18n.text('fileNameTooLong', { count: 120 }),
        this.i18n.text('invalidFile'),
      );
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      void this.feedback.warning(this.i18n.text('tooLarge'), this.i18n.text('invalidFile'));
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      void this.feedback.warning(this.i18n.text('pdfOnly'), this.i18n.text('invalidFile'));
      return;
    }
    this.file = file;
  }
}
