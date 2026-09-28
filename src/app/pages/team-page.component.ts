import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { TenantItem, TenantMember, TenantTeam } from '../core/models';
import { teamCopy } from '../core/team-copy';
import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';
import { RubricaSelectComponent, RubricaSelectOption } from '../components/rubrica-select.component';

@Component({
  standalone: true, imports: [WorkspaceSidebarComponent, FormsModule, RubricaSelectComponent],
  template: `<main class="shell">
    <div class="workspace-layout"><app-workspace-sidebar [tenant]="tenant()" />
      <section class="container dashboard-container team-container">
        <header class="dashboard-header"><div><p class="eyebrow">{{ tenant()?.name }}</p><h1>{{ copy().team }}</h1><p class="muted">{{ copy().help }}</p></div>
          @if (team()?.can_manage && team()!.active_count < team()!.member_limit) { <button class="button" (click)="inviteOpen.set(true)"><i class="bi bi-person-plus" aria-hidden="true"></i> {{ inviteLabel() }}</button> }
        </header>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (team(); as state) {
          @if (state.requires_selection) { <p class="notice warning" role="alert">{{ copy().overLimit }}</p> }
          @if (!state.can_manage) { <p class="notice">{{ copy().readonly }}</p> }
          <article class="card table-card">
            <div class="section-heading"><div><h2>{{ copy().limit }}: {{ state.member_limit }}</h2><p class="muted">{{ copy().choose }}: {{ state.active_count }} · {{ selected().size }} {{ copy().selected }}</p></div></div>
            <div class="table-wrap"><table class="data-table"><thead><tr><th>{{ i18n.text('email') }}</th><th>{{ i18n.text('profile') }}</th><th>{{ i18n.text('status') }}</th><th>{{ copy().choose }}</th></tr></thead><tbody>
              @for (member of state.members; track member.id) {
                <tr><td>{{ member.auth_user_id }}</td><td [attr.data-label]="i18n.text('profile')">@if (member.role === 'admin') { {{ copy().admin }} } @else { <app-rubrica-select [ariaLabel]="i18n.text('profile') + ': ' + member.auth_user_id" [disabled]="saving()" [value]="member.role" [options]="roleOptions()" (valueChange)="changeRole(member, $event)" /> }</td><td [attr.data-label]="i18n.text('status')"><span class="badge" [class.complete]="member.status === 'active'">{{ member.status === 'active' ? copy().active : copy().suspended }}</span></td>
                  <td [attr.data-label]="copy().choose"><input class="team-checkbox" type="checkbox" [attr.aria-label]="copy().choose + ': ' + member.auth_user_id" [checked]="selected().has(member.id)" [disabled]="disabled(member)" (change)="toggle(member.id)" /></td></tr>
              }
            </tbody></table></div>
            <div class="team-footer"><p class="muted">{{ copy().preserved }}</p>
              @if (state.can_manage) { <p class="muted">{{ copy().owner }}</p><button class="button" [disabled]="saving() || !dirty() || selected().size > state.member_limit" (click)="save()">{{ saving() ? i18n.text('loading') : copy().save }}</button> }
              @if (saved()) { <p role="status">{{ copy().saved }}</p> }
            </div>
          </article>
        } @else { <p class="notice">{{ copy().empty }}</p> }
      </section>
    </div>
    @if (inviteOpen()) {
      <div class="modal-backdrop" (click)="closeInvite($event)"><section class="app-modal" role="dialog" aria-modal="true" [attr.aria-label]="inviteLabel()" (click)="$event.stopPropagation()">
        <header class="modal-header"><div><p class="eyebrow">{{ copy().team }}</p><h2>{{ inviteLabel() }}</h2></div><button type="button" class="icon-button" [attr.aria-label]="i18n.text('close')" (click)="inviteOpen.set(false)">×</button></header>
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
  readonly tenant = signal<TenantItem | undefined>(undefined);
  readonly team = signal<TenantTeam | null>(null);
  readonly selected = signal(new Set<string>());
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly inviteOpen = signal(false);
  memberName = '';
  memberDocument = '';
  memberEmail = '';
  memberRole: 'member' | 'auditor' = 'member';
  copy() { return teamCopy[this.i18n.locale()]; }
  roleOptions(): RubricaSelectOption[] { return [{ value: 'member', label: this.copy().member }, { value: 'auditor', label: this.copy().auditor }]; }
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
      if (shouldLeaveTeamPage(team)) {
        await this.router.navigateByUrl(tenantDashboardUrl(tenant, context.account_public_slug), { replaceUrl: true });
        return;
      }
      this.setTeam(team);
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }
  private setTeam(team: TenantTeam) {
    this.team.set(team);
    this.selected.set(new Set(team.members.filter(m => m.status === 'active').map(m => m.id)));
  }
  disabled(member: TenantMember): boolean {
    const team = this.team();
    return !team?.can_manage || this.saving() || member.id === team.current_member_id
      || (!this.selected().has(member.id) && this.selected().size >= team.member_limit);
  }
  toggle(id: string) {
    const selected = new Set(this.selected());
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    this.selected.set(selected); this.saved.set(false);
  }
  dirty(): boolean { return this.team()?.members.some(m => (m.status === 'active') !== this.selected().has(m.id)) ?? false; }
  async save() {
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.patch<TenantTeam>(`/tenants/${this.tenant()!.id}/team`, { active_member_ids: [...this.selected()] })));
      this.saved.set(true);
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  async invite() {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post(`/tenants/${this.tenant()!.id}/member-invitations`, { name: this.memberName.trim(), document: this.memberDocument.trim(), email: this.memberEmail.trim().toLowerCase(), role: this.memberRole }));
      this.setTeam(await firstValueFrom(this.api.get<TenantTeam>(`/tenants/${this.tenant()!.id}/team`)));
      this.inviteOpen.set(false); this.memberName = ''; this.memberDocument = ''; this.memberEmail = ''; this.memberRole = 'member';
      await this.feedback.success(this.inviteSentLabel());
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  async changeRole(member: TenantMember, value: string) {
    const role = value as 'member' | 'auditor';
    this.saving.set(true);
    try {
      this.setTeam(await firstValueFrom(this.api.patch<TenantTeam>(`/tenants/${this.tenant()!.id}/team/${member.id}/role`, { role })));
      await this.feedback.success(this.roleUpdatedLabel());
    } catch (error) { await this.feedback.error(error); }
    finally { this.saving.set(false); }
  }
  closeInvite(event: MouseEvent) { if (event.target === event.currentTarget) this.inviteOpen.set(false); }
  inviteLabel() { return this.local({ 'pt-BR':'Adicionar membro', en:'Add member', es:'Agregar miembro', 'ja-JP':'メンバーを追加' }); }
  documentLabel() { return this.local({ 'pt-BR':'Documento (CPF)', en:'Identity document', es:'Documento de identidad', 'ja-JP':'本人確認書類' }); }
  inviteHelp() { return this.local({ 'pt-BR':'A pessoa receberá um e-mail para confirmar a conta e criar a própria senha.', en:'The person will receive an email to confirm the account and create their password.', es:'La persona recibirá un correo para confirmar la cuenta y crear su contraseña.', 'ja-JP':'アカウントを確認し、パスワードを作成するためのメールが送信されます。' }); }
  sendInviteLabel() { return this.local({ 'pt-BR':'Enviar convite', en:'Send invitation', es:'Enviar invitación', 'ja-JP':'招待を送信' }); }
  inviteSentLabel() { return this.local({ 'pt-BR':'Convite enviado. O membro poderá criar a senha pelo e-mail.', en:'Invitation sent. The member can create a password from the email.', es:'Invitación enviada. El miembro podrá crear su contraseña desde el correo.', 'ja-JP':'招待を送信しました。メンバーはメールからパスワードを作成できます。' }); }
  roleUpdatedLabel() { return this.local({ 'pt-BR':'Perfil e acessos atualizados.', en:'Role and access updated.', es:'Perfil y accesos actualizados.', 'ja-JP':'役割とアクセス権を更新しました。' }); }
  private local(values: Record<'pt-BR' | 'en' | 'es' | 'ja-JP', string>) { return values[this.i18n.locale()]; }
  async logout() { await this.auth.logout(); await this.router.navigateByUrl('/login'); }
}

export function shouldLeaveTeamPage(team: TenantTeam): boolean {
  return team.member_limit <= 1 && !team.requires_selection;
}
