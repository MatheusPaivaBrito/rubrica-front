import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount, BillingCheckout, BillingPortal, TenantItem, TenantMember } from '../core/models';
import { LanguagePickerComponent } from '../components/language-picker.component';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, LanguagePickerComponent],
  template: `
    <main class="billing-shell">
      <header class="billing-top">
        <a routerLink="/dashboard" class="brand-logo" aria-label="Rubrica"><img src="icons/rubrica-brand/source/rubrica-lockup-primary.png" alt="Rubrica Signature" /></a>
        <div class="top-actions">
          <app-language-picker />
          <a routerLink="/dashboard" class="button secondary">{{ i18n.text('backDashboard') }}</a>
        </div>
      </header>
      <section class="billing-card card">
        <div class="heading"><div><p class="eyebrow">Stripe</p><h1>{{ i18n.text('billing') }}</h1><p class="muted">{{ i18n.text('billingHelp') }}</p></div><i class="bi bi-credit-card-2-front"></i></div>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (!tenants().length) { <p class="notice warning">{{ i18n.text('billingAdminOnly') }}</p> }
        @else {
          <div class="tenant-select">
            <span>{{ i18n.text('chooseTenant') }}</span>
            <details class="country-picker document-type-picker billing-tenant-picker" #tenantMenu>
              <summary [attr.aria-label]="i18n.text('chooseTenant')">
                <i class="bi bi-building country-picker-mark" aria-hidden="true"></i>
                <span class="country-picker-value"><strong>{{ selectedTenantLabel() }}</strong></span>
                <i class="bi bi-chevron-down picker-chevron" aria-hidden="true"></i>
              </summary>
              <div class="country-options billing-tenant-options" role="listbox" [attr.aria-label]="i18n.text('chooseTenant')">
                @for (tenant of tenants(); track tenant.id) {
                  <button type="button" role="option" [attr.aria-selected]="tenant.id === tenantId()" [class.active]="tenant.id === tenantId()" (click)="selectTenant(tenant.id, tenantMenu)">
                    <i class="bi bi-building country-option-mark" aria-hidden="true"></i>
                    <span><strong>{{ tenant.name }}</strong><small>{{ tenant.currency }}</small></span>
                    @if (tenant.id === tenantId()) { <i class="bi bi-check2" aria-hidden="true"></i> }
                  </button>
                }
              </div>
            </details>
          </div>
          @if (account()) {
            <div class="plan-banner"><div><small>{{ i18n.text('plan') }}</small><h2>{{ planName() }}</h2><p>{{ planHelp() }}</p></div><span class="status" [attr.data-status]="account()!.complimentary_lifetime ? 'complimentary' : account()!.status">{{ account()!.complimentary_lifetime ? i18n.text('complimentary') : statusLabel(account()!.status) }}</span></div>
            <div class="metrics">
              <article><small>{{ usageLabel() }}</small><strong>{{ usageValue() }}</strong></article>
              <article><small>{{ i18n.text('availableNow') }}</small><strong>{{ availability() }}</strong></article>
              <article><small>{{ account()!.cancel_at_period_end ? i18n.text('cancelsOn') : i18n.text('currentPeriod') }}</small><strong>{{ i18n.formatDate(account()!.cancels_at || account()!.current_period_ends_at) }}</strong></article>
            </div>
            @if (canSubscribe()) {
              <div class="plans">
                <button class="plan-option" [class.selected]="selectedPlan() === 'rubrica_base'" (click)="selectedPlan.set('rubrica_base')"><strong>{{ i18n.text('basePlan') }}</strong><span>{{ planPrice('rubrica_base') }}</span><span>{{ i18n.text('basePlanHelp') }}</span></button>
                <button class="plan-option" [class.selected]="selectedPlan() === 'rubrica_intermediate'" (click)="selectedPlan.set('rubrica_intermediate')"><strong>{{ i18n.text('intermediatePlan') }}</strong><span>{{ planPrice('rubrica_intermediate') }}</span><span>{{ i18n.text('intermediatePlanHelp') }}</span></button>
              </div>
            }
            <div class="actions">
              @if (canSubscribe()) { <button class="button" [disabled]="submitting()" (click)="checkout()"><i class="bi bi-box-arrow-up-right"></i> {{ i18n.text('subscribe') }}</button> }
              @if (showPortalAction()) { <button class="button" [disabled]="submitting()" (click)="portal()"><i class="bi bi-arrow-left-right"></i> {{ portalActionLabel() }}</button> }
            </div>
            @if (checkoutUrl()) { <div class="checkout-qr"><img [src]="checkoutQrCode()" [alt]="i18n.text('checkoutQrAlt')" /><div><strong>{{ i18n.text('checkoutFinalize') }}</strong><p>{{ i18n.text('checkoutScan') }}</p><button class="button" (click)="openCheckout()">{{ i18n.text('openStripe') }}</button></div></div> }
            @if (selectedTenant()?.kind === 'business') {
              <section class="business-card"><div><p class="eyebrow">{{ businessEyebrow() }}</p><h2>{{ selectedTenant()?.legal_name }}</h2><p class="muted">{{ selectedTenant()?.registration_masked }}</p></div><span class="status" data-status="active">{{ businessActiveLabel() }}</span></section>
              <section class="team-card">
                <div><p class="eyebrow">{{ teamEyebrow() }}</p><h2>{{ teamTitle() }}</h2><p class="muted">{{ teamHelp() }}</p></div>
                <div class="member-list">
                  @for (member of members(); track member.id) { <div class="member-row"><span><strong>{{ member.auth_user_id }}</strong><small>{{ roleLabel(member.role) }}</small></span><span class="status" [attr.data-status]="member.status">{{ member.status }}</span></div> }
                </div>
                @if (members().length < 3) {
                  <form class="form member-form" (ngSubmit)="addMember()">
                    <label>{{ memberEmailLabel() }}<input name="memberEmail" type="email" [(ngModel)]="memberEmail" required autocomplete="email" /></label>
                    <label>{{ memberRoleLabel() }}<select name="memberRole" [(ngModel)]="memberRole"><option value="member">{{ roleLabel('member') }}</option><option value="auditor">{{ roleLabel('auditor') }}</option><option value="admin">{{ roleLabel('admin') }}</option></select></label>
                    <button class="button" [disabled]="submitting() || !memberEmail.trim()">{{ addMemberLabel() }}</button>
                  </form>
                }
              </section>
            } @else if (businessEligible()) {
              <section class="business-card"><div><p class="eyebrow">{{ businessEyebrow() }}</p><h2>{{ businessPendingTitle() }}</h2><p class="muted">{{ businessPendingHelp() }}</p></div><span class="status" data-status="pending">{{ pendingLabel() }}</span></section>
            }
          }
        }
      </section>
    </main>
  `,
  styles: [`
    .billing-shell{min-height:100vh;background:#f4f7fb;padding:2rem}.billing-top,.billing-card{max-width:980px;margin:auto}.billing-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}.top-actions,.actions{display:flex;gap:.75rem;align-items:center}.billing-card{padding:2rem}.heading{display:flex;justify-content:space-between;gap:1rem}.heading>i{font-size:2.5rem;color:#635bff}.tenant-select{display:grid;gap:.45rem;max-width:420px;margin:2rem 0;font-weight:700}.billing-tenant-picker{margin-top:0}.billing-tenant-options small{margin-left:.4rem}.plan-banner{display:flex;justify-content:space-between;gap:1rem;background:linear-gradient(135deg,#8f1d2c,#c63845);color:white;padding:1.5rem;border-radius:18px}.plan-banner h2{margin:.25rem 0}.plan-banner p{margin:0;opacity:.9}.status{align-self:flex-start;background:#fff;color:#641923;padding:.4rem .7rem;border-radius:999px;font-weight:800}.metrics,.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1rem 0}.metrics article{border:1px solid #dde5ee;border-radius:14px;padding:1.1rem;display:grid;gap:.5rem}.metrics strong{font-size:1.1rem}.plans{grid-template-columns:1fr 1fr}.plan-option{display:grid;gap:.45rem;padding:1rem;border:1px solid #d7dde5;border-radius:14px;background:#fff;text-align:left}.plan-option.selected{border-color:#a82035;box-shadow:0 0 0 2px #a8203522}.plan-option span{color:#64748b}.actions{justify-content:flex-end;margin-top:1.5rem}.checkout-qr{display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-top:1.5rem;padding:1.25rem;border:1px solid #dde5ee;border-radius:16px}.checkout-qr img{width:190px;border-radius:10px}.checkout-qr p{color:#64748b}.business-card,.team-card{margin-top:2rem;padding:1.5rem;border:1px solid #e3c9cd;border-radius:18px;background:#fffaf9}.business-card{display:flex;justify-content:space-between;gap:1.5rem}.business-card h2,.team-card h2{margin:.25rem 0}.member-list{display:grid;margin:1rem 0}.member-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 0;border-top:1px solid #eadadd}.member-row span:first-child{display:grid;gap:.2rem}.member-row small{color:#64748b}.member-form{display:grid;grid-template-columns:minmax(220px,1fr) 180px auto;gap:.75rem;align-items:end}.member-form label{display:grid;gap:.4rem}@media(max-width:700px){.billing-shell{padding:1rem}.billing-top{align-items:flex-start}.top-actions{flex-direction:column;align-items:stretch}.billing-card{padding:1.2rem}.plan-banner,.checkout-qr,.business-card{flex-direction:column}.metrics,.plans,.member-form{grid-template-columns:1fr}.actions{flex-direction:column}.actions .button,.member-form .button{width:100%}}
  `],
})
export class BillingPageComponent implements OnInit {
  readonly tenants = signal<TenantItem[]>([]);
  readonly tenantId = signal('');
  readonly account = signal<BillingAccount | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly selectedPlan = signal<'rubrica_base' | 'rubrica_intermediate'>('rubrica_base');
  readonly checkoutUrl = signal('');
  readonly checkoutQrCode = signal('');
  readonly members = signal<TenantMember[]>([]);
  memberEmail = '';
  memberRole: TenantMember['role'] = 'member';
  readonly selectedTenantCurrency = computed(() => this.tenants().find(tenant => tenant.id === this.tenantId())?.currency ?? 'USD');
  readonly availability = computed(() => {
    const account = this.account();
    if (!account) return this.i18n.text('unavailable');
    if (account.unlimited_files) return this.i18n.text('unlimited');
    const limit = this.fileLimit(account);
    if (limit !== null) return this.i18n.text('filesRemainingOf', { remaining: account.files_remaining ?? Math.max(limit - this.filesUsed(account), 0), limit });
    return this.i18n.text('remainingOf', { remaining: account.signatures_remaining ?? 0, limit: account.free_signatures_limit });
  });

  constructor(readonly i18n: I18nService, private readonly api: ApiService, private readonly auth: AuthService, private readonly feedback: FeedbackService, private readonly route: ActivatedRoute, private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    const context = await this.auth.restore();
    if (!context) { await this.router.navigate(['/login'], { queryParams: { returnUrl: '/plan' } }); return; }
    try {
      const tenants = (await firstValueFrom(this.api.get<TenantItem[]>('/tenants'))).filter(item => item.role === 'admin');
      this.tenants.set(tenants);
      if (tenants.length) {
        const requestedTenantId = this.route.snapshot.queryParamMap.get('tenant');
        this.tenantId.set(tenants.some(item => item.id === requestedTenantId) ? requestedTenantId! : tenants[0].id);
        await this.loadAccount();
        if (await this.leaveComplimentaryBilling()) return;
      }
      const returnedFromUpdate = this.route.snapshot.queryParamMap.get('billing') === 'updated';
      let synchronized = false;
      if (tenants.length && this.account()?.provider_subscription_id) {
        try {
          const account = await firstValueFrom(this.api.post<BillingAccount>(`/billing/tenants/${this.tenantId()}/account/sync`, {}));
          this.account.set(account);
          synchronized = true;
        } catch (error) {
          await this.feedback.error(error);
        }
      }
      if (returnedFromUpdate && synchronized) {
        await this.feedback.success(this.i18n.text('planUpdateConfirmed'));
        await this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
      const checkout = this.route.snapshot.queryParamMap.get('checkout');
      if (checkout === 'success') await this.feedback.success(this.i18n.text('checkoutSuccess'));
      if (checkout === 'cancelled') await this.feedback.warning(this.i18n.text('checkoutCancelled'));
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }

  selectedTenantLabel(): string { const tenant = this.tenants().find(item => item.id === this.tenantId()); return tenant ? `${tenant.name} · ${tenant.currency}` : this.i18n.text('chooseTenant'); }
  selectedTenant(): TenantItem | undefined { return this.tenants().find(item => item.id === this.tenantId()); }
  async selectTenant(id: string, menu?: HTMLDetailsElement): Promise<void> { if (menu) menu.open = false; this.tenantId.set(id); await this.loadAccount(); await this.leaveComplimentaryBilling(); }
  statusLabel(status: string): string { const keys: Record<string, Parameters<I18nService['text']>[0]> = { active:'active', pending:'pending', past_due:'pastDue', cancelled:'cancelled', paused:'paused', not_configured:'notConfigured' }; return this.i18n.text(keys[status] ?? 'notConfigured'); }
  planName(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlan'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlan'); return this.i18n.text('free'); }
  planHelp(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlanHelp'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlanHelp'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlanHelp'); return this.i18n.text('fiveFree'); }
  usageLabel(): string { const account = this.account(); return account && this.fileLimit(account) !== null ? this.i18n.text('monthlyUsage') : this.i18n.text('usage'); }
  usageValue(): string { const account = this.account(); if (!account) return this.i18n.text('unavailable'); return this.fileLimit(account) !== null ? this.i18n.text('files', { count: this.filesUsed(account) }) : this.i18n.text('signatures', { count: account.signatures_used }); }
  canSubscribe(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && this.fileLimit(account) === null && (!account.provider_subscription_id || ['cancelled', 'not_configured'].includes(account.status))); }
  showPortalAction(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && (account.provider_customer_id || account.status !== 'not_configured')); }
  portalActionLabel(): string { const account = this.account(); if (account?.cancel_at_period_end) return this.i18n.text('reactivateSubscription'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('upgradePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('changePlan'); return this.i18n.text('manageSubscription'); }
  planPrice(plan: 'rubrica_base' | 'rubrica_intermediate'): string { if (this.selectedTenantCurrency() !== 'BRL') return this.i18n.text('priceAtCheckout', { currency: this.selectedTenantCurrency() }); return plan === 'rubrica_base' ? 'R$ 29,90/mês' : 'R$ 69,90/mês'; }
  businessEligible(): boolean { const account = this.account(); return Boolean(account?.complimentary_lifetime || (account?.current_product_code === 'rubrica_intermediate' && ['active', 'past_due'].includes(account.status))); }
  businessEyebrow(): string { return this.local({ 'pt-BR':'CONTA EMPRESARIAL', en:'BUSINESS ACCOUNT', es:'CUENTA EMPRESARIAL', 'ja-JP':'法人アカウント' }); }
  businessPendingTitle(): string { return this.local({ 'pt-BR':'Conclua o cadastro empresarial no Stripe', en:'Complete the business registration in Stripe', es:'Completa el registro empresarial en Stripe', 'ja-JP':'Stripeで法人登録を完了してください' }); }
  businessPendingHelp(): string { return this.local({ 'pt-BR':'O CNPJ e a razão social são importados do Stripe. A equipe será liberada assim que os dados válidos forem confirmados.', en:'The CNPJ and legal name are imported from Stripe. Team access is enabled after valid details are confirmed.', es:'El CNPJ y la razón social se importan de Stripe. El equipo se habilita después de confirmar datos válidos.', 'ja-JP':'CNPJと法人名はStripeから取得されます。有効な情報の確認後にチーム機能が有効になります。' }); }
  pendingLabel(): string { return this.local({ 'pt-BR':'Pendente', en:'Pending', es:'Pendiente', 'ja-JP':'保留中' }); }
  businessActiveLabel(): string { return this.local({ 'pt-BR':'Ativa', en:'Active', es:'Activa', 'ja-JP':'有効' }); }
  teamEyebrow(): string { return this.local({ 'pt-BR':'EQUIPE', en:'TEAM', es:'EQUIPO', 'ja-JP':'チーム' }); }
  teamTitle(): string { return this.local({ 'pt-BR':'Contas do tenant', en:'Tenant accounts', es:'Cuentas del tenant', 'ja-JP':'テナントアカウント' }); }
  teamHelp(): string { return this.local({ 'pt-BR':'O plano Profissional permite até 3 contas ativas, incluindo o administrador.', en:'Professional allows up to 3 active accounts, including the administrator.', es:'Profesional permite hasta 3 cuentas activas, incluido el administrador.', 'ja-JP':'プロフェッショナルでは管理者を含め最大3つの有効アカウントを利用できます。' }); }
  memberEmailLabel(): string { return this.local({ 'pt-BR':'E-mail da conta existente', en:'Existing account email', es:'Correo de la cuenta existente', 'ja-JP':'既存アカウントのメール' }); }
  memberRoleLabel(): string { return this.local({ 'pt-BR':'Papel', en:'Role', es:'Rol', 'ja-JP':'役割' }); }
  addMemberLabel(): string { return this.local({ 'pt-BR':'Adicionar conta', en:'Add account', es:'Agregar cuenta', 'ja-JP':'アカウントを追加' }); }
  roleLabel(role: TenantMember['role']): string { const labels = { admin: { 'pt-BR':'Administrador', en:'Administrator', es:'Administrador', 'ja-JP':'管理者' }, member: { 'pt-BR':'Membro', en:'Member', es:'Miembro', 'ja-JP':'メンバー' }, auditor: { 'pt-BR':'Auditor', en:'Auditor', es:'Auditor', 'ja-JP':'監査者' } } as const; return labels[role][this.i18n.locale()]; }
  private local(values: Record<'pt-BR' | 'en' | 'es' | 'ja-JP', string>): string { return values[this.i18n.locale()]; }

  async checkout(): Promise<void> { this.submitting.set(true); try { const result = await firstValueFrom(this.api.post<BillingCheckout>(`/billing/tenants/${this.tenantId()}/checkout`, { product_code: this.selectedPlan() })); this.checkoutUrl.set(result.checkout_url); this.checkoutQrCode.set(await QRCode.toDataURL(result.checkout_url, { width: 260, margin: 2 })); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  async addMember(): Promise<void> { this.submitting.set(true); try { await firstValueFrom(this.api.post(`/tenants/${this.tenantId()}/members`, { auth_user_id: this.memberEmail.trim().toLowerCase(), role: this.memberRole })); this.memberEmail = ''; this.memberRole = 'member'; await this.loadMembers(); await this.feedback.success(this.addMemberLabel()); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  async portal(): Promise<void> { await this.redirect<BillingPortal>(`/billing/tenants/${this.tenantId()}/portal`, 'portal_url'); }
  openCheckout(): void { if (this.checkoutUrl()) window.location.assign(this.checkoutUrl()); }

  private async loadAccount(): Promise<void> { const account = await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${this.tenantId()}/account`)); this.account.set(account); if (account.current_product_code === 'rubrica_base' || account.current_product_code === 'rubrica_intermediate') this.selectedPlan.set(account.current_product_code); if (this.selectedTenant()?.kind === 'business') await this.loadMembers(); else this.members.set([]); }
  private async loadMembers(): Promise<void> { this.members.set(await firstValueFrom(this.api.get<TenantMember[]>(`/tenants/${this.tenantId()}/members`))); }
  private async leaveComplimentaryBilling(): Promise<boolean> { return false; }
  private fileLimit(account: BillingAccount): number | null { if (typeof account.files_limit === 'number') return account.files_limit; if (!['active', 'past_due'].includes(account.status)) return null; if (account.current_product_code === 'rubrica_base') return 20; if (account.current_product_code === 'rubrica_intermediate') return 80; return null; }
  private filesUsed(account: BillingAccount): number { return account.files_uploaded_in_period ?? 0; }
  private async redirect<T extends BillingCheckout | BillingPortal>(path: string, key: keyof T): Promise<void> {
    this.submitting.set(true);
    try { const result = await firstValueFrom(this.api.post<T>(path, {})); window.location.assign(String(result[key])); }
    catch (error) { await this.feedback.error(error); this.submitting.set(false); }
  }
}
