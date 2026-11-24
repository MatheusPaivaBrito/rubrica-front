import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { DocumentScope, TenantItem, TenantMember, TenantTeam } from '../core/models';
import { teamCopy } from '../core/team-copy';
import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';
import { RubricaSelectComponent, RubricaSelectOption } from '../components/rubrica-select.component';

interface BranchReview {
  id: string;
  legal_name: string;
  cnpj_masked: string;
  status: 'pending' | 'approved' | 'rejected';
  workspace_active?: boolean;
  workspace_closed?: boolean;
  business_tenant_id?: string | null;
  member_count: number;
}

@Component({
  standalone: true, imports: [WorkspaceSidebarComponent, FormsModule, RubricaSelectComponent],
  styles: [`
    .team-roster { padding: 0; overflow: visible; }
    .team-roster-header, .team-roster-footer {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      gap: 1rem; padding: 1.25rem 1.5rem;
    }
    .team-roster h2, .team-roster p { margin: 0; }
    .team-roster-header p { margin-top: .35rem; }
    .team-seat-count { display: grid; gap: .2rem; border-radius: .65rem; background: #f3f6fa; padding: .65rem 1rem; }
    .team-seat-count strong { font-size: 1.25rem; line-height: 1.1; }
    .team-seat-count small, .team-member-identity small { color: #53647a; }
    .team-members { list-style: none; padding: 0; margin: 0; }
    .team-member, .team-roster-footer { border-top: 1px solid #e6ecf3; }
    .team-member-summary {
      display: grid; grid-template-columns: minmax(0, 1fr) minmax(6rem, auto) minmax(6rem, auto) 7rem;
      align-items: center; gap: 1rem; padding: .85rem 1.5rem;
    }
    .team-member-identity { display: flex; align-items: center; gap: .75rem; min-width: 0; }
    .team-member-identity strong { display: block; overflow-wrap: anywhere; }
    .team-member-identity small { display: block; margin-top: .15rem; }
    .team-avatar { display: grid; place-items: center; flex: 0 0 2.25rem; height: 2.25rem; border-radius: .65rem; background: #eef3f9; color: #354960; font-weight: 700; }
    .team-member-summary .badge { justify-self: start; }
    .team-seat-option { display: inline-flex; align-items: center; gap: .5rem; font-size: .875rem; margin: 0; }
    .team-seat-option input.team-checkbox { inline-size: 1rem; block-size: 1rem; min-height: 0; flex: 0 0 1rem; padding: 0; margin: 0; }
    .team-manage { min-width: 0; padding: .45rem .65rem; justify-self: stretch; }
    .team-permissions-dialog { margin: auto; width: min(37rem, calc(100% - 2rem)); max-height: min(85dvh, 48rem); border: 1px solid #e6ecf3; padding: 0; color: inherit; }
    .team-permissions-dialog::backdrop { background: rgb(22 34 52 / .5); }
    .team-permissions-dialog .modal-header p { margin: .3rem 0 0; overflow-wrap: anywhere; }
    .team-member-settings { display: grid; gap: 1rem; }
    .team-member-settings .form-field small { line-height: 1.4; }
    .team-member-actions { border-top: 1px solid #e6ecf3; padding-top: .85rem; }
    .team-member-actions p { margin: .35rem 0 0; }
    .team-member-actions { display: flex; flex-wrap: wrap; gap: .5rem; grid-column: 1 / -1; }
    .team-destructive { color: #a82035; }
    .branch-section { display: grid; gap: 1rem; }
    .branch-section h2, .branch-section p { margin: 0; }
    .branch-form { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto; align-items: end; gap: .75rem; }
    .branch-list { border: 1px solid #e6ecf3; border-radius: .75rem; }
    .branch-card + .branch-card { border-top: 1px solid #e6ecf3; }
    .branch-search { max-width: 23rem; }
    .branch-pagination { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
    .branch-list-empty { padding: .85rem 1rem; }
    .branch-card-header { width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem; padding: .85rem 1rem; }
    button.branch-card-header { color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; }
    .branch-card-name { display: grid; min-width: 0; gap: .2rem; overflow-wrap: anywhere; }
    .branch-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem; }
    .branch-card-body { display: grid; gap: .75rem; padding: 1rem; border-top: 1px solid #e6ecf3; }
    .branch-card-body[hidden] { display: none; }
    .branch-card-body > .button { justify-self: start; }
    .branch-card-body td:first-child { overflow-wrap: anywhere; }
    @media (max-width: 700px) {
      .branch-form { grid-template-columns: 1fr; }
      .team-member-summary { grid-template-columns: 1fr auto; gap: .65rem; }
      .team-member-identity { grid-column: 1 / -1; }
      .team-manage { grid-column: 1 / -1; justify-self: start; }
    }
  `],
  template: `<main class="shell">
    <div class="workspace-layout"><app-workspace-sidebar [tenant]="tenant()" />
      <section class="container dashboard-container team-container">
        <header class="dashboard-header"><div><p class="eyebrow">{{ tenant()?.name }}</p><h1>{{ copy().team }}</h1><p class="muted">{{ copy().help }}</p></div>
          @if (team()?.can_manage && !team()?.export_until) { <button class="button" (click)="openInvite()"><i class="bi bi-person-plus" aria-hidden="true"></i> {{ inviteLabel() }}</button> }
        </header>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (team(); as state) {
          @if (!state.export_until) {
          @if (state.requires_selection) { <p class="notice warning" role="alert">{{ copy().overLimit }}</p> }
          @if (!state.can_manage) { <p class="notice">{{ copy().readonly }}</p> }
          <article class="card team-roster">
            <div class="team-roster-header">
              <div><h2>{{ copy().choose }}</h2><p class="muted">{{ cycleHelp(state) }}</p><p class="muted">{{ permissionHelp('seat') }}</p></div>
              <div class="team-seat-count"><strong>{{ selected().size }} / {{ memberLimitLabel(state) }}</strong><small>{{ copy().selected }}</small></div>
            </div>
            <ul class="team-members">
              @for (member of state.members; track member.id) {
                <li class="team-member">
                  <div class="team-member-summary">
                    <div class="team-member-identity">
                      <span class="team-avatar" aria-hidden="true">{{ member.auth_user_id.slice(0, 1).toUpperCase() }}</span>
                      <div><strong>{{ member.auth_user_id }}</strong><small>{{ roleLabel(member) }}</small></div>
                    </div>
                    <span class="badge" [class.complete]="member.status === 'active'">{{ member.status === 'active' ? copy().active : member.status === 'offboarded' ? offboardedLabel() : withoutSeatLabel() }}</span>
                    <label class="team-seat-option">
                      <input class="team-checkbox" type="checkbox" [attr.aria-label]="copy().choose + ' · ' + member.auth_user_id"
                        [checked]="selected().has(member.id)" [disabled]="disabled(member)" (change)="toggle(member.id)" />
                      {{ seatLabel() }}
                    </label>
                    @if (state.can_manage && member.id !== state.current_member_id) {
                      <button type="button" class="button secondary team-manage"
                        aria-haspopup="dialog"
                        (click)="openPermissions(member.id)">
                        {{ manageLabel() }}
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
            <footer class="team-roster-footer">
              <div><p class="muted">{{ copy().preserved }}</p>@if (saved()) { <p role="status">{{ copy().saved }}</p> }</div>
              @if (state.can_manage) {
                <button class="button" [disabled]="saving() || !dirty() || exceedsMemberLimit(state)" (click)="save()">{{ saving() ? i18n.text('loading') : copy().save }}</button>
              }
            </footer>
          </article>
          @if (state.can_request_branch) {
            <article class="card branch-section">
              <h2>{{ branchLabel() }}</h2>
              <form class="form branch-form" (ngSubmit)="requestBranch()">
                <label>{{ i18n.text('name') }}<input name="branchName" [(ngModel)]="branchName" maxlength="240" required /></label>
                <label>CNPJ<input name="branchCnpj" [(ngModel)]="branchCnpj" inputmode="numeric" required /></label>
                <button type="submit" class="button" [disabled]="saving() || !branchName.trim() || !branchCnpj.trim()">{{ createBranchLabel() }}</button>
              </form>
              @if (branches().length > 0) {
              <label class="branch-search">{{ branchCopy('search') }}
                <input type="search" [value]="branchSearch()" (input)="setBranchSearch($event)" />
              </label>
              <div class="branch-list">
              @for (branch of visibleBranches(); track branch.id) {
                <section class="branch-card">
                    <button type="button" class="branch-card-header" [attr.aria-expanded]="expandedBranch() === branch.id"
                      [attr.aria-controls]="'branch-members-' + branch.id" (click)="toggleBranch(branch)">
                      <span class="branch-card-name"><strong>{{ branch.legal_name }}</strong><small class="muted">CNPJ {{ branch.cnpj_masked }}</small></span>
                      <span class="branch-card-meta">{{ branch.workspace_active ? branchMemberCount(branch.member_count) : branchStatus(branch) }}
                        <i class="bi" [class.bi-chevron-up]="expandedBranch() === branch.id"
                          [class.bi-chevron-down]="expandedBranch() !== branch.id" aria-hidden="true"></i>
                      </span>
                    </button>
                    <div class="branch-card-body" [id]="'branch-members-' + branch.id" [hidden]="expandedBranch() !== branch.id">
                      @if (expandedBranch() === branch.id) {
                        @if (branch.workspace_active && branch.business_tenant_id) {
                        <button type="button" class="button secondary" (click)="openInvite(branch)"><i class="bi bi-person-plus" aria-hidden="true"></i> {{ inviteLabel() }}</button>
                        @if (branchLoading() === branch.id) { <p role="status">{{ i18n.text('loading') }}</p> }
                        @else if (branchMembers()[branch.id]; as members) {
                          @if (!members.length) { <p class="muted">{{ emptyBranchLabel() }}</p> }
                          @else {
                            <div class="table-wrap"><table class="data-table"><thead><tr><th>{{ i18n.text('email') }}</th><th>{{ i18n.text('profile') }}</th><th>{{ i18n.text('status') }}</th></tr></thead>
                              <tbody>
                                @for (member of members; track member.id) {
                                  <tr><td [attr.data-label]="i18n.text('email')">{{ member.auth_user_id }}</td>
                                    <td [attr.data-label]="i18n.text('profile')">{{ roleLabel(member) }}</td>
                                    <td [attr.data-label]="i18n.text('status')">{{ member.status === 'active' ? copy().active : member.status === 'offboarded' ? offboardedLabel() : withoutSeatLabel() }}</td></tr>
                                }
                              </tbody>
                            </table></div>
                          }
                        }
                        } @else {
                          <p class="muted">{{ branchDetail(branch) }}</p>
                          @if (branch.status === 'approved' && !branch.workspace_closed) {
                            <button type="button" class="button secondary" [disabled]="saving()" (click)="checkoutBranch(branch)">{{ branchCheckoutLabel() }}</button>
                          }
                        }
                      }
                    </div>
                </section>
              } @empty {
                <p class="muted branch-list-empty">{{ branchCopy('noResults') }}</p>
              }
              </div>
              @if (branchPageCount() > 1) {
                <nav class="branch-pagination" [attr.aria-label]="branchLabel()">
                  <button type="button" class="button secondary" [disabled]="branchPage() === 0" (click)="moveBranchPage(-1)">{{ branchCopy('previous') }}</button>
                  <span>{{ branchPage() + 1 }} / {{ branchPageCount() }}</span>
                  <button type="button" class="button secondary" [disabled]="branchPage() + 1 >= branchPageCount()" (click)="moveBranchPage(1)">{{ branchCopy('next') }}</button>
                </nav>
              }
              }
            </article>
          }
          }
          @if (state.can_manage && tenant()?.kind === 'business') {
            <article class="card">
              <h2>{{ closureLabel() }}</h2>
              @if (state.export_until) {
                <p role="status">{{ exportNotice(state.export_until) }}</p>
              } @else {
                @if (state.closure_requested_at) {
                  <p role="status">{{ closurePendingText() }}</p>
                  <button type="button" class="button" [disabled]="saving()" (click)="confirmClosure()">
                    {{ confirmClosureLabel() }}
                  </button>
                }
                <button type="button" class="button secondary" [disabled]="saving()"
                  (click)="changeClosureRequest(!state.closure_requested_at)">
                  {{ closureAction(!state.closure_requested_at) }}
                </button>
              }
            </article>
          }
        } @else { <p class="notice">{{ copy().empty }}</p> }
      </section>
    </div>
    <dialog #permissionsDialog class="app-modal team-permissions-dialog" aria-labelledby="team-permissions-title"
      (close)="expandedMember.set(null)">
      @if (permissionMember(); as member) {
        <header class="modal-header">
          <div><h2 id="team-permissions-title">{{ manageLabel() }}</h2><p class="muted">{{ member.auth_user_id }}</p></div>
          <button type="button" class="icon-button" [attr.aria-label]="i18n.text('close')" (click)="permissionsDialog.close()">×</button>
        </header>
                    <div class="modal-body team-member-settings">
                      <div class="form-field"><span class="field-label">{{ i18n.text('profile') }}</span>
                        <small class="muted">{{ permissionHelp('role') }}</small>
                        <app-rubrica-select [ariaLabel]="i18n.text('profile') + ' · ' + member.auth_user_id"
                          [disabled]="saving()" [value]="member.role" [options]="workspaceRoleOptions(member)" (valueChange)="changeRole(member, $event)" />
                      </div>
                      <div class="form-field"><span class="field-label">{{ documentScopeLabel() }}</span>
                        <small class="muted">{{ permissionHelp('files') }}</small>
                        @if (member.role === 'admin') { <span>{{ documentScopeText('all') }}</span> }
                        @else {
                          <app-rubrica-select [ariaLabel]="documentScopeLabel() + ' · ' + member.auth_user_id"
                            [disabled]="saving()" [value]="member.document_scope ?? 'own'" [options]="documentScopeOptions(member)"
                            (valueChange)="changeDocumentScope(member, $event)" />
                        }
                      </div>
                      @if (member.role !== 'admin') {
                        @if (tenant()?.kind === 'business') {
                          <label class="team-seat-option team-company-option">
                            <input class="team-checkbox" type="checkbox" [checked]="member.sign_company_only ?? false" [disabled]="saving()"
                              (change)="changeSigningPermission(member, $event)" />
                            {{ companyOnlyLabel() }}
                          </label><small class="muted">{{ permissionHelp('sign') }}</small>
                        }
                        <div class="team-member-actions">
                          @if (member.status === 'offboarded') {
                            <div><button type="button" class="button secondary" [disabled]="saving()" (click)="changeMemberAccess(member, 'restore')">{{ accessActionText('restore') }}</button><p class="muted">{{ permissionHelp('restore') }}</p></div>
                            <div><button type="button" class="button secondary" [disabled]="saving()" (click)="changeMemberAccess(member, 'fresh')">{{ accessActionText('fresh') }}</button><p class="muted">{{ permissionHelp('fresh') }}</p></div>
                          } @else {
                            <div><button type="button" class="button secondary team-destructive" [disabled]="saving()" (click)="changeMemberAccess(member, 'offboard')">{{ accessActionText('offboard') }}</button><p class="muted">{{ permissionHelp('offboard') }}</p></div>
                          }
                        </div>
                      }
                    </div>
      }
    </dialog>
    @if (inviteOpen()) {
      <div class="modal-backdrop" (click)="closeInvite($event)"><section class="app-modal" role="dialog" aria-modal="true" [attr.aria-label]="inviteLabel()" (click)="$event.stopPropagation()">
        <header class="modal-header"><div><p class="eyebrow">{{ inviteBranch()?.legal_name ?? tenant()?.name }}</p><h2>{{ inviteLabel() }}</h2></div><button type="button" class="icon-button" [attr.aria-label]="i18n.text('close')" (click)="inviteOpen.set(false)">×</button></header>
        <form class="modal-body form" (ngSubmit)="invite()">
          <label>{{ i18n.text('name') }}<input name="memberName" [(ngModel)]="memberName" required autocomplete="name" /></label>
          <label>{{ documentLabel() }}<input name="memberDocument" [(ngModel)]="memberDocument" required inputmode="numeric" autocomplete="off" /></label>
          <label>{{ i18n.text('email') }}<input name="memberEmail" type="email" [(ngModel)]="memberEmail" required autocomplete="email" /></label>
          <div class="form-field"><span class="field-label">{{ i18n.text('profile') }}</span><app-rubrica-select [ariaLabel]="i18n.text('profile')" [value]="memberRole" [options]="roleOptions()" (valueChange)="selectMemberRole($event)" /></div>
          <p class="muted">{{ inviteHelp() }}</p>
          <footer class="modal-footer"><button type="button" class="button secondary" (click)="inviteOpen.set(false)">{{ i18n.text('cancel') }}</button><button class="button" [disabled]="saving() || !memberName.trim() || !memberDocument.trim() || !memberEmail.trim()">{{ saving() ? i18n.text('loading') : sendInviteLabel() }}</button></footer>
        </form>
      </section></div>
    }
  </main>`,
})
export class TeamPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly feedback = inject(FeedbackService);
  readonly expandedMember = signal<string | null>(null);
  readonly permissionsDialogRef = viewChild<ElementRef<HTMLDialogElement>>('permissionsDialog');
  readonly permissionMember = computed(() => this.team()?.members.find(member => member.id === this.expandedMember()));
  openPermissions(memberId: string): void {
    this.expandedMember.set(memberId);
    this.permissionsDialogRef()?.nativeElement.showModal();
  }
  readonly tenant = signal<TenantItem | undefined>(undefined);
  readonly team = signal<TenantTeam | null>(null);
  readonly selected = signal(new Set<string>());
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly inviteOpen = signal(false);
  readonly branches = signal<BranchReview[]>([]);
  readonly branchSearch = signal('');
  readonly branchPage = signal(0);
  private readonly branchesPerPage = 10;
  readonly filteredBranches = computed(() => {
    const query = this.branchSearch().trim().toLocaleLowerCase(this.i18n.locale());
    return this.branches().filter(branch => branch.legal_name.toLocaleLowerCase(this.i18n.locale()).includes(query)
      || branch.cnpj_masked.includes(query));
  });
  readonly branchPageCount = computed(() => Math.ceil(this.filteredBranches().length / this.branchesPerPage));
  readonly visibleBranches = computed(() => {
    const start = this.branchPage() * this.branchesPerPage;
    return this.filteredBranches().slice(start, start + this.branchesPerPage);
  });
  readonly expandedBranch = signal<string | null>(null);
  readonly branchLoading = signal<string | null>(null);
  readonly branchMembers = signal<Record<string, TenantMember[]>>({});
  readonly inviteBranch = signal<BranchReview | null>(null);
  branchName = '';
  branchCnpj = '';
  memberName = '';
  memberDocument = '';
  memberEmail = '';
  memberRole: 'member' | 'auditor' = 'member';
  copy() { return teamCopy[this.i18n.locale()]; }
  permissionHelp(action: 'seat' | 'role' | 'files' | 'sign' | 'offboard' | 'restore' | 'fresh'): string {
    const copy = {
      seat: {
        'pt-BR': 'Desmarque e salve para retirar o acesso na virada do ciclo. A pessoa continua no time e pode receber um assento em outro ciclo.',
        en: 'Uncheck and save to remove access at the next cycle. The person stays on the team and can receive a seat in a later cycle.',
        es: 'Desmarca y guarda para retirar el acceso en el próximo ciclo. La persona sigue en el equipo y puede recibir un asiento más adelante.',
        'ja-JP': 'チェックを外して保存すると、次のサイクルでアクセスが停止します。メンバー登録は残り、後のサイクルで再割り当てできます。',
      },
      role: {
        'pt-BR': 'Define o que a pessoa pode fazer no workspace, como administrar o time ou atuar como auditora.',
        en: 'Controls what the person can do in this workspace, such as managing the team or auditing.',
        es: 'Define lo que la persona puede hacer en el espacio, como administrar el equipo o auditar.',
        'ja-JP': 'チームの管理や監査など、ワークスペースでできる操作を設定します。',
      },
      files: {
        'pt-BR': 'Escolha se a pessoa vê os próprios arquivos, os adicionados desde a entrada no time ou todos os arquivos.',
        en: 'Choose whether they see their own files, files added since they joined, or all files.',
        es: 'Elige si puede ver sus archivos, los que se añadieron desde su incorporación o todos los archivos.',
        'ja-JP': '本人のファイル、参加後に追加されたファイル、またはすべてのファイルから選びます。',
      },
      sign: {
        'pt-BR': 'Ao marcar, a pessoa só pode assinar como representante da empresa neste workspace.',
        en: 'When checked, the person can only sign as a company representative in this workspace.',
        es: 'Al marcarlo, la persona solo puede firmar como representante de la empresa en este espacio.',
        'ja-JP': '有効にすると、このワークスペースでは会社の代表者としてのみ署名できます。',
      },
      offboard: {
        'pt-BR': 'Encerra o vínculo e corta o acesso agora, inclusive por links antigos. Os documentos ficam com a empresa.',
        en: 'Ends the membership and revokes access now, including old links. Documents stay with the company.',
        es: 'Termina el vínculo y revoca el acceso de inmediato, incluidos los enlaces anteriores. Los documentos quedan en la empresa.',
        'ja-JP': 'メンバー資格を解除し、古いリンクを含むアクセスを即時停止します。文書は会社に残ります。',
      },
      restore: {
        'pt-BR': 'Recupera a data de entrada e as permissões anteriores. O acesso depende de haver assento disponível.',
        en: 'Restores the original join date and permissions. Access depends on an available seat.',
        es: 'Recupera la fecha de incorporación y los permisos anteriores. El acceso depende de que haya un asiento disponible.',
        'ja-JP': '以前の参加日と権限を復元します。アクセスには空きシートが必要です。',
      },
      fresh: {
        'pt-BR': 'Cria uma nova entrada no time. A pessoa começa com acesso apenas aos próprios arquivos novos quando houver assento.',
        en: 'Starts a new membership. With a seat, the person starts with access to their own new files only.',
        es: 'Inicia un vínculo nuevo. Con un asiento, la persona empieza con acceso solo a sus propios archivos nuevos.',
        'ja-JP': '新規メンバーとして登録します。空きシートがあれば、本人の新しいファイルにのみアクセスできます。',
      },
    };
    return this.local(copy[action]);
  }
  roleLabel(member: TenantMember): string {
    return member.role === 'admin' ? this.copy().admin : member.role === 'auditor' ? this.copy().auditor : this.copy().member;
  }
  manageLabel(): string {
    return this.local({ 'pt-BR': 'Permissões', en: 'Permissions', es: 'Permisos', 'ja-JP': '権限' });
  }
  seatLabel(): string {
    return this.local({ 'pt-BR': 'Assento', en: 'Seat', es: 'Asiento', 'ja-JP': 'シート' });
  }
  roleOptions(): RubricaSelectOption[] { return [{ value: 'member', label: this.copy().member }, { value: 'auditor', label: this.copy().auditor }]; }
  workspaceRoleOptions(member: TenantMember): RubricaSelectOption[] {
    const roles = this.roleOptions();
    if (this.tenant()?.kind === 'business' && (member.status === 'active' || member.role === 'admin')) {
      roles.push({ value: 'admin', label: this.copy().admin });
    }
    return roles;
  }
  selectMemberRole(value: string): void { this.memberRole = value as 'member' | 'auditor'; }
  async ngOnInit() {
    try {
      const context = await this.auth.restore();
      if (!context) { await this.router.navigateByUrl('/login'); return; }
      if (context.mfa_setup_required) { await this.router.navigateByUrl('/security'); return; }
      const tenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants'));
      const slug = this.route.snapshot.paramMap.get('tenantSlug');
      const accountSlug = this.route.snapshot.paramMap.get('accountSlug');
      const tenant = accountSlug === context.account_public_slug
        ? tenants.find(t => slug ? t.slug === slug : t.kind === 'personal') : tenants[0];
      if (!tenant) return;
      if (tenant.role !== 'admin') {
        await this.router.navigateByUrl(tenantDashboardUrl(tenant, context.account_public_slug), { replaceUrl: true });
        return;
      }
      const canonical = tenantDashboardUrl(tenant, context.account_public_slug).replace(/dashboard$/, 'team');
      if (this.router.url.split('?')[0] !== canonical) { await this.router.navigateByUrl(canonical, { replaceUrl: true }); return; }
      this.tenant.set(tenant);
      const team = await firstValueFrom(this.api.get<TenantTeam>(`/tenants/${tenant.id}/team`));
      if (!team.export_until && shouldLeaveTeamPage(team)) {
        await this.router.navigateByUrl(tenantDashboardUrl(tenant, context.account_public_slug), { replaceUrl: true });
        return;
      }
      this.setTeam(team);
      if (team.can_request_branch) await this.loadBranches(tenant.id);
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }
  exportNotice(deadline: string): string {
    const date = new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(deadline));
    return this.local({
      'pt-BR': `Workspace encerrado. Baixe os PDFs pelo painel até ${date}.`,
      en: `Workspace closed. Download PDFs from the dashboard before ${date}.`,
      es: `Espacio cerrado. Descarga los PDF desde el panel antes del ${date}.`,
      'ja-JP': `ワークスペースは閉鎖されました。${date}までにダッシュボードからPDFをダウンロードしてください。`,
    });
  }
  confirmClosureLabel(): string {
    return this.local({ 'pt-BR': 'Confirmar encerramento', en: 'Confirm closure', es: 'Confirmar el cierre', 'ja-JP': '閉鎖を確認する' });
  }
  async confirmClosure(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    const result = await Swal.fire({
      title: this.confirmClosureLabel(),
      text: this.local({
        'pt-BR': 'As solicitações em aberto serão canceladas. Administradores poderão baixar os PDFs por 30 dias.',
        en: 'Open requests will be cancelled. Administrators can download PDFs for 30 days.',
        es: 'Se cancelarán las solicitudes abiertas. Los administradores podrán descargar los PDF durante 30 días.',
        'ja-JP': '進行中の署名依頼はキャンセルされます。管理者は30日間PDFをダウンロードできます。',
      }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.confirmClosureLabel(),
      cancelButtonText: this.i18n.text('cancel'),
    });
    if (!result.isConfirmed) return;
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.post<TenantTeam>(`/tenants/${tenant.id}/close`, {})));
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  closureLabel(): string {
    return this.local({ 'pt-BR': 'Encerramento do workspace', en: 'Workspace closure', es: 'Cierre del espacio', 'ja-JP': 'ワークスペースの閉鎖' });
  }
  closurePendingText(): string {
    return this.local({
      'pt-BR': 'A solicitação foi registrada. O workspace continua ativo.',
      en: 'The request was recorded. The workspace remains active.',
      es: 'La solicitud quedó registrada. El espacio sigue activo.',
      'ja-JP': 'リクエストが記録されました。ワークスペースは引き続き利用できます。',
    });
  }
  closureAction(requested: boolean): string {
    return requested
      ? this.local({ 'pt-BR': 'Solicitar encerramento', en: 'Request closure', es: 'Solicitar el cierre', 'ja-JP': '閉鎖を申請する' })
      : this.local({ 'pt-BR': 'Retirar solicitação', en: 'Withdraw request', es: 'Retirar la solicitud', 'ja-JP': '申請を取り下げる' });
  }
  async changeClosureRequest(requested: boolean): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    const result = await Swal.fire({
      title: this.closureAction(requested),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.closureAction(requested),
      cancelButtonText: this.i18n.text('cancel'),
    });
    if (!result.isConfirmed) return;
    this.saving.set(true);
    try {
      const team = await firstValueFrom(this.api.put<TenantTeam>(
        `/tenants/${tenant.id}/closure-request`, { requested },
      ));
      this.setTeam(team);
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  createBranchLabel(): string {
    return this.local({ 'pt-BR': 'Solicitar nova filial', en: 'Request a new branch', es: 'Solicitar una sucursal', 'ja-JP': '支店を申請する' });
  }
  branchMemberCount(count: number): string {
    return new Intl.NumberFormat(this.i18n.locale()).format(count) + ' ' + (count === 1
      ? this.local({ 'pt-BR': 'membro', en: 'member', es: 'miembro', 'ja-JP': '人' })
      : this.local({ 'pt-BR': 'membros', en: 'members', es: 'miembros', 'ja-JP': '人' }));
  }
  emptyBranchLabel(): string {
    return this.local({ 'pt-BR': 'Esta filial ainda não tem membros.', en: 'This branch has no members yet.', es: 'Esta sucursal aún no tiene miembros.', 'ja-JP': 'この支店にはまだメンバーがいません。' });
  }
  async toggleBranch(branch: BranchReview): Promise<void> {
    if (this.expandedBranch() === branch.id) { this.expandedBranch.set(null); return; }
    this.expandedBranch.set(branch.id);
    if (!branch.workspace_active) return;
    try { await this.loadBranchMembers(branch); }
    catch (error) { await this.feedback.error(error); }
  }
  private async loadBranchMembers(branch: BranchReview): Promise<void> {
    if (!branch.business_tenant_id) return;
    this.branchLoading.set(branch.id);
    try {
      const members = await firstValueFrom(this.api.get<TenantMember[]>(`/tenants/${branch.business_tenant_id}/members`));
      this.branchMembers.update(current => ({ ...current, [branch.id]: members }));
    } finally {
      if (this.branchLoading() === branch.id) this.branchLoading.set(null);
    }
  }
  openInvite(branch: BranchReview | null = null): void {
    this.memberName = '';
    this.memberDocument = '';
    this.memberEmail = '';
    this.memberRole = 'member';
    this.inviteBranch.set(branch);
    this.inviteOpen.set(true);
  }
  branchLabel(): string {
    return this.local({ 'pt-BR': 'Filiais', en: 'Branches', es: 'Sucursales', 'ja-JP': '支店' });
  }
  branchCheckoutLabel(): string {
    return this.local({ 'pt-BR': 'Continuar para pagamento', en: 'Continue to payment', es: 'Continuar al pago', 'ja-JP': '支払いに進む' });
  }
  setBranchSearch(event: Event): void {
    this.branchSearch.set((event.target as HTMLInputElement).value);
    this.branchPage.set(0);
    this.expandedBranch.set(null);
  }
  moveBranchPage(direction: number): void {
    this.branchPage.update(page => Math.max(0, Math.min(page + direction, this.branchPageCount() - 1)));
    this.expandedBranch.set(null);
  }
  branchCopy(key: 'search' | 'noResults' | 'previous' | 'next'): string {
    return this.local({
      search: { 'pt-BR': 'Buscar filial', en: 'Find a branch', es: 'Buscar sucursal', 'ja-JP': '支店を検索' },
      noResults: { 'pt-BR': 'Nenhuma filial encontrada.', en: 'No branches found.', es: 'No se encontraron sucursales.', 'ja-JP': '支店が見つかりません。' },
      previous: { 'pt-BR': 'Anterior', en: 'Previous', es: 'Anterior', 'ja-JP': '前へ' },
      next: { 'pt-BR': 'Próxima', en: 'Next', es: 'Siguiente', 'ja-JP': '次へ' },
    }[key]);
  }
  branchStatus(branch: BranchReview): string {
    if (branch.workspace_closed) {
      return this.local({ 'pt-BR': 'Encerrada', en: 'Closed', es: 'Cerrada', 'ja-JP': '閉鎖済み' });
    }
    return {
      pending: this.local({ 'pt-BR': 'Aguardando revisão do CNPJ', en: 'CNPJ review pending', es: 'CNPJ pendiente de revisión', 'ja-JP': 'CNPJ審査待ち' }),
      approved: this.local({ 'pt-BR': 'Aguardando pagamento', en: 'Awaiting payment', es: 'Pendiente de pago', 'ja-JP': '支払い待ち' }),
      rejected: this.local({ 'pt-BR': 'CNPJ não aprovado', en: 'CNPJ not approved', es: 'CNPJ no aprobado', 'ja-JP': 'CNPJ未承認' }),
    }[branch.status];
  }
  branchDetail(branch: BranchReview): string {
    if (branch.workspace_closed) return this.branchStatus(branch);
    return {
      pending: this.local({
        'pt-BR': 'A solicitação foi recebida. Após a revisão manual do CNPJ, o pagamento será liberado. A filial fica disponível para convidar membros após a confirmação do pagamento.',
        en: 'Request received. Payment becomes available after manual CNPJ review. You can invite members once payment is confirmed.',
        es: 'Solicitud recibida. El pago se habilita tras la revisión manual del CNPJ. Podrás invitar miembros cuando se confirme el pago.',
        'ja-JP': '申請を受け付けました。CNPJの審査後に支払いが可能です。支払い確認後にメンバーを招待できます。',
      }),
      approved: this.local({ 'pt-BR': 'CNPJ aprovado. Conclua o pagamento para ativar a filial.', en: 'CNPJ approved. Complete payment to activate the branch.', es: 'CNPJ aprobado. Completa el pago para activar la sucursal.', 'ja-JP': 'CNPJが承認されました。支払いを完了して支店を有効にしてください。' }),
      rejected: this.local({ 'pt-BR': 'Confira os dados e envie uma nova solicitação pelo formulário acima.', en: 'Check the details and resubmit using the form above.', es: 'Revisa los datos y vuelve a enviar la solicitud con el formulario.', 'ja-JP': '情報を確認し、上のフォームから再申請してください。' }),
    }[branch.status];
  }
  private async loadBranches(tenantId: string): Promise<void> {
    this.branches.set(await firstValueFrom(this.api.get<BranchReview[]>(`/tenants/${tenantId}/branches`)));
  }
  async requestBranch(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post<BranchReview>(`/tenants/${tenant.id}/branches`, {
        legal_name: this.branchName.trim(), cnpj: this.branchCnpj.trim(),
      }));
      this.branchName = '';
      this.branchCnpj = '';
      await this.loadBranches(tenant.id);
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  async checkoutBranch(branch: BranchReview): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    this.saving.set(true);
    try {
      const result = await firstValueFrom(this.api.post<{ checkout_url: string }>(
        `/billing/tenants/${tenant.id}/branches/${branch.id}/checkout`, {},
      ));
      window.location.assign(result.checkout_url);
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  private setTeam(team: TenantTeam) {
    this.team.set(team);
    this.selected.set(new Set(team.next_cycle_member_ids?.length ? team.next_cycle_member_ids : team.current_seat_member_ids));
  }
  exceedsMemberLimit(team: TenantTeam): boolean { return team.member_limit !== null && this.selected().size > team.member_limit; }
  memberLimitLabel(team: TenantTeam): string | number { return team.member_limit ?? this.i18n.text('unlimited'); }
  disabled(member: TenantMember): boolean {
    if (member.status === 'offboarded') return true;
    const team = this.team();
    return !team?.can_manage || this.saving() || member.id === team.current_member_id
      || (team.member_limit !== null && !this.selected().has(member.id) && this.selected().size >= team.member_limit);
  }
  toggle(id: string) {
    const selected = new Set(this.selected());
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    this.selected.set(selected); this.saved.set(false);
  }
  dirty(): boolean {
    const expected = new Set(this.team()?.next_cycle_member_ids ?? []);
    return expected.size !== this.selected().size || [...this.selected()].some(id => !expected.has(id));
  }
  async save() {
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.put<TenantTeam>(`/tenants/${this.tenant()!.id}/team/next-cycle`, { member_ids: [...this.selected()] })));
      this.saved.set(true);
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  async invite() {
    const branch = this.inviteBranch();
    const tenant = this.tenant();
    const destination = branch ? branch.business_tenant_id : tenant?.id;
    if (!tenant || !destination || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post(`/tenants/${destination}/member-invitations`, { name: this.memberName.trim(), document: this.memberDocument.trim(), email: this.memberEmail.trim().toLowerCase(), role: this.memberRole }));
      this.inviteOpen.set(false);
      if (branch) await Promise.all([this.loadBranchMembers(branch), this.loadBranches(tenant.id)]);
      else this.setTeam(await firstValueFrom(this.api.get<TenantTeam>(`/tenants/${tenant.id}/team`)));
      this.memberName = ''; this.memberDocument = ''; this.memberEmail = ''; this.memberRole = 'member';
      await this.feedback.success(this.inviteSentLabel());
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  accessActionLabel() {
    return this.local({ 'pt-BR': 'Vínculo', en: 'Membership', es: 'Vínculo', 'ja-JP': '所属' });
  }
  offboardedLabel() {
    return this.local({ 'pt-BR': 'Desligado', en: 'Offboarded', es: 'Desvinculado', 'ja-JP': '所属解除済み' });
  }
  accessActionText(action: 'offboard' | 'restore' | 'fresh') {
    return {
      offboard: this.local({ 'pt-BR': 'Desligar membro', en: 'Offboard member', es: 'Desvincular miembro', 'ja-JP': 'メンバーの所属を解除' }),
      restore: this.local({ 'pt-BR': 'Restaurar vínculo anterior', en: 'Restore previous membership', es: 'Restaurar vínculo anterior', 'ja-JP': '以前の所属を復元' }),
      fresh: this.local({ 'pt-BR': 'Readmitir sem histórico', en: 'Readmit without history', es: 'Readmitir sin historial', 'ja-JP': '履歴なしで再登録' }),
    }[action];
  }
  async changeMemberAccess(member: TenantMember, action: 'offboard' | 'restore' | 'fresh') {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    if (!window.confirm(`${this.accessActionText(action)} — ${member.auth_user_id}?\n\n${this.permissionHelp(action)}`)) return;
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.patch<TenantTeam>(
        `/tenants/${tenant.id}/team/${member.id}/access`, { action },
      )));
    } catch (error) { this.permissionsDialogRef()?.nativeElement.close();
      await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  companyOnlyLabel() {
    return this.local({ 'pt-BR': 'Assina só em nome da empresa', en: 'Sign only for the company', es: 'Firma solo en nombre de la empresa', 'ja-JP': '会社名義でのみ署名' });
  }
  async changeSigningPermission(member: TenantMember, event: Event) {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    const input = event.target as HTMLInputElement;
    this.saving.set(true);
    try {
      this.team.set(await firstValueFrom(this.api.patch<TenantTeam>(
        `/tenants/${tenant.id}/team/${member.id}/document-scope`, { sign_company_only: input.checked },
      )));
    } catch (error) {
      input.checked = member.sign_company_only ?? false;
      this.permissionsDialogRef()?.nativeElement.close();
      await this.feedback.error(error);
    } finally { this.saving.set(false); }
  }
  documentScopeLabel() {
    return this.local({ 'pt-BR': 'Acesso aos arquivos', en: 'File access', es: 'Acceso a archivos', 'ja-JP': 'ファイルアクセス' });
  }
  documentScopeText(scope: DocumentScope | 'legacy'): string {
    return {
      all: this.local({ 'pt-BR': 'Todos os arquivos', en: 'All files', es: 'Todos los archivos', 'ja-JP': 'すべてのファイル' }),
      own: this.local({ 'pt-BR': 'Somente próprios', en: 'Own files only', es: 'Solo archivos propios', 'ja-JP': '自分のファイルのみ' }),
      since_joined: this.local({ 'pt-BR': 'Desde a entrada', en: 'Since joining', es: 'Desde su incorporación', 'ja-JP': '参加日以降' }),
      legacy: this.local({ 'pt-BR': 'Acesso anterior', en: 'Previous access', es: 'Acceso anterior', 'ja-JP': '従来のアクセス' }),
    }[scope];
  }
  documentScopeOptions(member: TenantMember): RubricaSelectOption[] {
    const scopes: (DocumentScope | 'legacy')[] = ['own', 'all', 'since_joined'];
    if (member.document_scope === 'legacy') scopes.unshift('legacy');
    return scopes.map(value => ({ value, label: this.documentScopeText(value) }));
  }
  async changeDocumentScope(member: TenantMember, scope: string) {
    const tenant = this.tenant();
    if (!tenant || this.saving() || !['own', 'all', 'since_joined'].includes(scope) || member.document_scope === scope) return;
    this.saving.set(true);
    try {
      const state = await firstValueFrom(this.api.patch<TenantTeam>(
        `/tenants/${tenant.id}/team/${member.id}/document-scope`, { document_scope: scope },
      ));
      this.team.set(state);
    } catch (error) { this.permissionsDialogRef()?.nativeElement.close();
      await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  async changeRole(member: TenantMember, value: string) {
    if (value !== 'admin' && value !== 'member' && value !== 'auditor') return;
    const role = value;
    if (role === member.role) return;
    if (role === 'admin') {
      const result = await Swal.fire({
        target: this.permissionsDialogRef()?.nativeElement,
        icon: 'warning',
        text: this.team()?.organization_root ? this.local({
          'pt-BR': 'Este membro poderá administrar e abrir os documentos da sede e de todas as filiais da organização.',
          en: 'This member can manage and open documents in the main workspace and every branch.',
          es: 'Este miembro podrá administrar y abrir documentos en la sede y todas las sucursales.',
          'ja-JP': 'このメンバーは本部とすべての支店の文書を開き、管理できます。',
        }) : this.local({
          'pt-BR': 'Este membro terá acesso administrativo e poderá abrir todos os documentos deste workspace.',
          en: 'This member will have administrator access and can open every document in this workspace.',
          es: 'Este miembro tendrá acceso administrativo y podrá abrir todos los documentos de este espacio.',
          'ja-JP': 'このメンバーは管理権限を取得し、このワークスペースのすべての文書を開けるようになります。',
        }),
        showCancelButton: true,
        confirmButtonText: this.copy().admin,
        cancelButtonText: this.i18n.text('cancel'),
      });
      if (!result.isConfirmed) return;
    }
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.patch<TenantTeam>(`/tenants/${this.tenant()!.id}/team/${member.id}/role`, { role })));
      this.permissionsDialogRef()?.nativeElement.close();
      await this.feedback.success(this.roleUpdatedLabel());
    } catch (error) { this.permissionsDialogRef()?.nativeElement.close();
      await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  closeInvite(event: MouseEvent) { if (event.target === event.currentTarget) this.inviteOpen.set(false); }
  inviteLabel() { return this.local({ 'pt-BR':'Adicionar membro', en:'Add member', es:'Agregar miembro', 'ja-JP':'メンバーを追加' }); }
  documentLabel() { return this.local({ 'pt-BR':'Documento (CPF)', en:'Identity document', es:'Documento de identidad', 'ja-JP':'本人確認書類' }); }
  inviteHelp() { return this.local({ 'pt-BR':'A pessoa receberá um e-mail para confirmar a conta e criar a própria senha.', en:'The person will receive an email to confirm the account and create their password.', es:'La persona recibirá un correo para confirmar la cuenta y crear su contraseña.', 'ja-JP':'アカウントを確認し、パスワードを作成するためのメールが送信されます。' }); }
  sendInviteLabel() { return this.local({ 'pt-BR':'Enviar convite', en:'Send invitation', es:'Enviar invitación', 'ja-JP':'招待を送信' }); }
  inviteSentLabel() { return this.local({ 'pt-BR':'Convite enviado. O membro poderá criar a senha pelo e-mail.', en:'Invitation sent. The member can create a password from the email.', es:'Invitación enviada. El miembro podrá crear su contraseña desde el correo.', 'ja-JP':'招待を送信しました。メンバーはメールからパスワードを作成できます。' }); }
  roleUpdatedLabel() { return this.local({ 'pt-BR':'Perfil e acessos atualizados.', en:'Role and access updated.', es:'Perfil y accesos actualizados.', 'ja-JP':'役割とアクセス権を更新しました。' }); }
  withoutSeatLabel() { return this.local({ 'pt-BR':'Sem cadeira', en:'No seat', es:'Sin asiento', 'ja-JP':'シートなし' }); }
  cycleHelp(team: TenantTeam) {
    if (!team.next_cycle_starts_at) return this.local({ 'pt-BR':'A composição atual permanece vigente.', en:'The current roster remains active.', es:'La composición actual sigue vigente.', 'ja-JP':'現在の構成が有効です。' });
    const showTime = typeof window !== 'undefined' && window.location.hostname === 'staging.rubricasignature.com';
    const options: Intl.DateTimeFormatOptions | undefined = showTime
      ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }
      : undefined;
    const date = new Intl.DateTimeFormat(this.i18n.locale(), options).format(new Date(team.next_cycle_starts_at));
    return this.local({ 'pt-BR':`Escolha os ocupantes do próximo ciclo, válido a partir de ${date}. A lista atual permanece travada até lá.`, en:`Choose next cycle's occupants, effective ${date}. The current roster stays locked until then.`, es:`Elige los ocupantes del próximo ciclo, vigente desde ${date}. La lista actual queda bloqueada hasta entonces.`, 'ja-JP':`${date}からの次回サイクル利用者を選択します。現在の一覧はそれまで固定されます。` });
  }
  private local(values: Record<'pt-BR' | 'en' | 'es' | 'ja-JP', string>) { return values[this.i18n.locale()]; }
  async logout() { await this.auth.logout(); await this.router.navigateByUrl('/login'); }
}

export function shouldLeaveTeamPage(team: TenantTeam): boolean {
  return team.member_limit !== null && team.member_limit <= 1 && !team.requires_selection;
}
