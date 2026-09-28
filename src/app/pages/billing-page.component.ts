import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';

import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount, BillingCheckout, BillingPortal, TenantItem } from '../core/models';
import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';

@Component({
  standalone: true,
  imports: [FormsModule, WorkspaceSidebarComponent],
  template: `
    <main class="shell">
      <div class="workspace-layout"><app-workspace-sidebar [tenant]="selectedTenant()" />
      <section class="container dashboard-container billing-container">
      <article class="billing-card card">
        <div class="heading"><div><p class="eyebrow">Stripe</p><h1>{{ i18n.text('billing') }}</h1><p class="muted">{{ i18n.text('billingHelp') }}</p></div><i class="bi bi-credit-card-2-front"></i></div>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (!tenants().length) { <p class="notice warning">{{ i18n.text('billingAdminOnly') }}</p> }
        @else {
          @if (account()) {
            <div class="plan-banner"><div><small>{{ i18n.text('plan') }}</small><h2>{{ planName() }}</h2><p>{{ planHelp() }}</p></div><span class="status" [attr.data-status]="account()!.complimentary_lifetime ? 'complimentary' : account()!.status">{{ account()!.complimentary_lifetime ? i18n.text('complimentary') : statusLabel(account()!.status) }}</span></div>
            <div class="metrics">
              <article><small>{{ usageLabel() }}</small><strong>{{ usageValue() }}</strong></article>
              <article><small>{{ i18n.text('availableNow') }}</small><strong>{{ availability() }}</strong></article>
              <article><small>{{ account()!.cancel_at_period_end ? i18n.text('cancelsOn') : i18n.text('currentPeriod') }}</small><strong>{{ i18n.formatDate(account()!.cancels_at || account()!.current_period_ends_at) }}</strong></article>
            </div>
            @if (canSubscribe() || showPortalAction()) {
              <div class="plans" [class.two-options]="availablePlans().length === 2">
                @for (plan of availablePlans(); track plan) {
                  <button class="plan-option" [class.selected]="selectedPlan() === plan" (click)="selectedPlan.set(plan)">
                    <strong>{{ planLabel(plan) }}</strong><span>{{ planPrice(plan) }}</span>
                    <ul>@for (feature of planFeatures(plan); track feature) { <li>{{ feature }}</li> }</ul>
                  </button>
                }
              </div>
              <div class="billing-interval"><button type="button" [class.selected]="billingInterval() === 'month'" (click)="billingInterval.set('month')">{{ monthlyLabel() }}</button><button type="button" [class.selected]="billingInterval() === 'year'" (click)="billingInterval.set('year')">{{ annualLabel() }}</button></div>
            }
            <div class="actions">
              @if (canSubscribe()) { <button class="button" [disabled]="submitting()" (click)="checkout()"><i class="bi bi-box-arrow-up-right"></i> {{ i18n.text('subscribe') }}</button> }
              @if (showPortalAction()) { <button class="button" [disabled]="submitting()" (click)="portal()"><i class="bi bi-arrow-left-right"></i> {{ confirmChangeLabel() }}</button> }
            </div>
            @if (checkoutUrl()) { <div class="checkout-qr"><img [src]="checkoutQrCode()" [alt]="i18n.text('checkoutQrAlt')" /><div><strong>{{ i18n.text('checkoutFinalize') }}</strong><p>{{ i18n.text('checkoutScan') }}</p><button class="button" (click)="openCheckout()">{{ i18n.text('openStripe') }}</button></div></div> }
            @if (selectedTenant()?.kind !== 'business' && businessEligible()) {
              <section class="business-card business-registration"><div><p class="eyebrow">{{ businessEyebrow() }}</p><h2>{{ businessPendingTitle() }}</h2><p class="muted">{{ businessFormHelp() }}</p></div><span class="status" data-status="pending">{{ pendingLabel() }}</span>
                <form class="form business-registration-form" (ngSubmit)="completeBusinessRegistration()">
                  <label>{{ legalNameLabel() }}<input name="businessLegalName" [(ngModel)]="businessLegalName" required autocomplete="organization" /></label>
                  <label>CNPJ<input name="businessCnpj" [(ngModel)]="businessCnpj" required inputmode="numeric" placeholder="00.000.000/0000-00" autocomplete="off" /></label>
                  <button class="button" [disabled]="submitting() || !businessLegalName.trim() || !businessCnpj.trim()">{{ saveBusinessLabel() }}</button>
                </form>
              </section>
            }
          }
        }
      </article>
      </section></div>
    </main>
  `,
  styles: [`
    .billing-container{padding-top:2rem;padding-bottom:3rem}.billing-card{max-width:980px;margin:auto;padding:2rem}.actions{display:flex;gap:.75rem;align-items:center}.heading{display:flex;justify-content:space-between;gap:1rem}.heading>i{font-size:2.5rem;color:#a82035}.tenant-select{display:grid;gap:.45rem;max-width:420px;margin:2rem 0;font-weight:700}.billing-tenant-picker{margin-top:0}.billing-tenant-options small{margin-left:.4rem}.plan-banner{display:flex;justify-content:space-between;gap:1rem;background:linear-gradient(135deg,#8f1d2c,#c63845);color:white;padding:1.5rem;border-radius:18px}.plan-banner h2{margin:.25rem 0}.plan-banner p{margin:0;opacity:.9}.status{align-self:flex-start;background:#fff;color:#641923;padding:.4rem .7rem;border-radius:999px;font-weight:800}.metrics,.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1rem 0}.metrics article{border:1px solid #dde5ee;border-radius:14px;padding:1.1rem;display:grid;gap:.5rem}.metrics strong{font-size:1.1rem}.plan-option{display:grid;gap:.45rem;padding:1rem;border:1px solid #d7dde5;border-radius:14px;background:#fff;text-align:left}.plan-option.selected{border-color:#a82035;box-shadow:0 0 0 2px #a8203522}.plan-option span{color:#64748b}.billing-interval{display:flex;justify-content:flex-end;gap:.5rem}.billing-interval button{padding:.6rem 1rem;border:1px solid #d7dde5;border-radius:999px;background:#fff;font-weight:700}.billing-interval button.selected{border-color:#a82035;color:#a82035;background:#fff5f6}.actions{justify-content:flex-end;margin-top:1.5rem}.checkout-qr{display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-top:1.5rem;padding:1.25rem;border:1px solid #dde5ee;border-radius:16px}.checkout-qr img{width:190px;border-radius:10px}.checkout-qr p{color:#64748b}.business-card,.team-card{margin-top:2rem;padding:1.5rem;border:1px solid #e3c9cd;border-radius:18px;background:#fffaf9}.business-card{display:flex;justify-content:space-between;gap:1.5rem;flex-wrap:wrap}.business-card h2,.team-card h2{margin:.25rem 0}.business-registration-form{flex:1 0 100%;display:grid;grid-template-columns:1fr 240px auto;gap:.75rem;align-items:end}.business-registration-form label{display:grid;gap:.4rem}.member-list{display:grid;margin:1rem 0}.member-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 0;border-top:1px solid #eadadd}.member-row span:first-child{display:grid;gap:.2rem}.member-row small{color:#64748b}.member-form{display:grid;grid-template-columns:minmax(220px,1fr) 180px auto;gap:.75rem;align-items:end}.member-form label{display:grid;gap:.4rem}@media(max-width:700px){.billing-container{padding-top:1rem}.billing-card{padding:1.2rem}.plan-banner,.checkout-qr,.business-card{flex-direction:column}.metrics,.plans,.member-form,.business-registration-form{grid-template-columns:1fr}.actions{flex-direction:column}.actions .button,.member-form .button,.business-registration-form .button{width:100%}}
    .plans.two-options{grid-template-columns:repeat(2,minmax(0,1fr))}.plan-option ul{margin:.35rem 0 0;padding-left:1.2rem;color:#475569}.plan-option li+li{margin-top:.3rem}
  `],
})
export class BillingPageComponent implements OnInit {
  readonly tenants = signal<TenantItem[]>([]);
  readonly tenantId = signal('');
  readonly account = signal<BillingAccount | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly selectedPlan = signal<'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'>('rubrica_base');
  readonly billingInterval = signal<'month' | 'year'>('month');
  readonly checkoutUrl = signal('');
  readonly checkoutQrCode = signal('');
  businessLegalName = '';
  businessCnpj = '';
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
      const availableTenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants'));
      const requestedSlug = this.route.snapshot.paramMap.get('tenantSlug');
      const requestedTenant = requestedSlug ? availableTenants.find(item => item.slug === requestedSlug) : undefined;
      if (requestedTenant && requestedTenant.role !== 'admin') {
        await this.router.navigateByUrl(tenantDashboardUrl(requestedTenant, context.account_public_slug), { replaceUrl: true });
        return;
      }
      const tenants = availableTenants.filter(item => item.role === 'admin');
      this.tenants.set(tenants);
      if (tenants.length) {
        const tenantSlug = this.route.snapshot.paramMap.get('tenantSlug');
        const accountSlug = this.route.snapshot.paramMap.get('accountSlug');
        const legacyTenantId = this.route.snapshot.queryParamMap.get('tenant');
        const accountMatches = accountSlug === context.account_public_slug;
        const selectedTenant = accountMatches
          ? (tenantSlug ? tenants.find(item => item.slug === tenantSlug) : tenants.find(item => item.kind !== 'business'))
          : tenants.find(item => item.id === legacyTenantId);
        const tenant = selectedTenant ?? tenants[0];
        this.tenantId.set(tenant.id);
        const canonical = this.planUrl(tenant, context.account_public_slug);
        if (this.router.url.split('?')[0] !== canonical) {
          const query = this.route.snapshot.queryParamMap;
          const suffix = query.get('billing') ? `?billing=${encodeURIComponent(query.get('billing')!)}`
            : query.get('checkout') ? `?checkout=${encodeURIComponent(query.get('checkout')!)}` : '';
          await this.router.navigateByUrl(`${canonical}${suffix}`, { replaceUrl: true });
        }
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
  async selectTenant(id: string, menu?: HTMLDetailsElement): Promise<void> {
    if (menu) menu.open = false;
    const tenant = this.tenants().find(item => item.id === id);
    const accountSlug = this.auth.context()?.account_public_slug;
    if (!tenant || !accountSlug) return;
    this.tenantId.set(id);
    await this.router.navigateByUrl(this.planUrl(tenant, accountSlug));
    await this.loadAccount();
    await this.leaveComplimentaryBilling();
  }
  statusLabel(status: string): string { const keys: Record<string, Parameters<I18nService['text']>[0]> = { active:'active', pending:'pending', past_due:'pastDue', cancelled:'cancelled', paused:'paused', not_configured:'notConfigured' }; return this.i18n.text(keys[status] ?? 'notConfigured'); }
  planName(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlan'); if (account?.current_product_code === 'rubrica_team' && this.fileLimit(account) !== null) return this.teamPlanLabel(); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlan'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlan'); return this.i18n.text('free'); }
  planHelp(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlanHelp'); if (account?.current_product_code === 'rubrica_team' && this.fileLimit(account) !== null) return this.teamPlanHelp(); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlanHelp'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlanHelp'); return this.i18n.text('fiveFree'); }
  usageLabel(): string { const account = this.account(); return account && this.fileLimit(account) !== null ? this.i18n.text('monthlyUsage') : this.i18n.text('usage'); }
  usageValue(): string { const account = this.account(); if (!account) return this.i18n.text('unavailable'); return this.fileLimit(account) !== null ? this.i18n.text('files', { count: this.filesUsed(account) }) : this.i18n.text('signatures', { count: account.signatures_used }); }
  canSubscribe(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && (!account.provider_subscription_id || ['cancelled', 'not_configured'].includes(account.status)) && (['rubrica_base', 'rubrica_intermediate', 'rubrica_team'] as const).some(plan => this.planSelectable(plan))); }
  planSelectable(plan: 'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'): boolean {
    const account = this.account();
    if (!account) return false;
    const current = account.current_product_code === 'rubrica_mvp' ? 'rubrica_base' : account.current_product_code;
    return account.status !== 'active' || plan !== current;
  }
  availablePlans(): ('rubrica_base' | 'rubrica_intermediate' | 'rubrica_team')[] {
    return (['rubrica_base', 'rubrica_intermediate', 'rubrica_team'] as const).filter(plan => this.planSelectable(plan));
  }
  planLabel(plan: 'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'): string {
    if (plan === 'rubrica_base') return this.i18n.text('basePlan');
    if (plan === 'rubrica_intermediate') return this.i18n.text('intermediatePlan');
    return this.teamPlanLabel();
  }
  planFeatures(plan: 'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'): string[] {
    const features = {
      rubrica_base: {
        'pt-BR':['20 arquivos por mês','1 conta por tenant','Compartilhamento por link e QR Code'],
        en:['20 files per month','1 account per tenant','Sharing by link and QR Code'], es:['20 archivos al mes','1 cuenta por tenant','Compartir mediante enlace y QR'], 'ja-JP':['月20ファイル','テナントごとに1アカウント','リンクとQRコードで共有'],
      },
      rubrica_intermediate: {
        'pt-BR':['80 arquivos por mês','Até 3 contas por tenant','Convites por e-mail','Cadastro empresarial com CNPJ'],
        en:['80 files per month','Up to 3 accounts per tenant','Email invitations','Business registration with CNPJ'], es:['80 archivos al mes','Hasta 3 cuentas por tenant','Invitaciones por correo','Registro empresarial con CNPJ'], 'ja-JP':['月80ファイル','テナントごとに最大3アカウント','メール招待','CNPJによる法人登録'],
      },
      rubrica_team: {
        'pt-BR':['200 arquivos por mês','Até 10 contas por tenant','Convites e solicitações por e-mail','Cadastro empresarial com CNPJ'],
        en:['200 files per month','Up to 10 accounts per tenant','Email invitations and requests','Business registration with CNPJ'], es:['200 archivos al mes','Hasta 10 cuentas por tenant','Invitaciones y solicitudes por correo','Registro empresarial con CNPJ'], 'ja-JP':['月200ファイル','テナントごとに最大10アカウント','メール招待と依頼','CNPJによる法人登録'],
      },
    } as const;
    return [...features[plan][this.i18n.locale()]];
  }
  showPortalAction(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && account.provider_customer_id && account.provider_subscription_id); }
  portalActionLabel(): string { const account = this.account(); if (account?.cancel_at_period_end) return this.i18n.text('reactivateSubscription'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('upgradePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('changePlan'); return this.i18n.text('manageSubscription'); }
  confirmChangeLabel(): string { return this.local({ 'pt-BR':'Confirmar troca no Stripe', en:'Confirm change in Stripe', es:'Confirmar cambio en Stripe', 'ja-JP':'Stripeで変更を確認' }); }
  planPrice(plan: 'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'): string { if (this.selectedTenantCurrency() !== 'BRL') return this.i18n.text('priceAtCheckout', { currency: this.selectedTenantCurrency() }); if (this.billingInterval() === 'year') { if (plan === 'rubrica_base') return 'R$ 299,00/ano'; if (plan === 'rubrica_intermediate') return 'R$ 699,00/ano'; return 'R$ 1.499,90/ano'; } if (plan === 'rubrica_base') return 'R$ 29,90/mês'; if (plan === 'rubrica_intermediate') return 'R$ 69,90/mês'; return 'R$ 149,90/mês'; }
  businessEligible(): boolean { const account = this.account(); return Boolean(account?.complimentary_lifetime || (['rubrica_intermediate', 'rubrica_team'].includes(account?.current_product_code ?? '') && ['active', 'past_due'].includes(account?.status ?? ''))); }
  businessEyebrow(): string { return this.local({ 'pt-BR':'CONTA EMPRESARIAL', en:'BUSINESS ACCOUNT', es:'CUENTA EMPRESARIAL', 'ja-JP':'法人アカウント' }); }
  businessPendingTitle(): string { return this.local({ 'pt-BR':'Conclua o cadastro empresarial', en:'Complete the business registration', es:'Completa el registro empresarial', 'ja-JP':'法人登録を完了してください' }); }
  businessPendingHelp(): string { return this.local({ 'pt-BR':'O CNPJ e a razão social são importados do Stripe. A equipe será liberada assim que os dados válidos forem confirmados.', en:'The CNPJ and legal name are imported from Stripe. Team access is enabled after valid details are confirmed.', es:'El CNPJ y la razón social se importan de Stripe. El equipo se habilita después de confirmar datos válidos.', 'ja-JP':'CNPJと法人名はStripeから取得されます。有効な情報の確認後にチーム機能が有効になります。' }); }
  businessFormHelp(): string { return this.local({ 'pt-BR':'Informe a razão social e o CNPJ para liberar o Time desta conta.', en:'Enter the legal name and CNPJ to enable this account team.', es:'Ingresa la razón social y el CNPJ para habilitar el equipo.', 'ja-JP':'法人名とCNPJを入力してチームを有効にします。' }); }
  legalNameLabel(): string { return this.local({ 'pt-BR':'Razão social', en:'Legal name', es:'Razón social', 'ja-JP':'法人名' }); }
  saveBusinessLabel(): string { return this.local({ 'pt-BR':'Salvar cadastro', en:'Save registration', es:'Guardar registro', 'ja-JP':'登録を保存' }); }
  businessSavedLabel(): string { return this.local({ 'pt-BR':'Cadastro empresarial concluído. O Time foi liberado.', en:'Business registration completed. Team access is enabled.', es:'Registro empresarial completado. El equipo está habilitado.', 'ja-JP':'法人登録が完了し、チームが有効になりました。' }); }
  pendingLabel(): string { return this.local({ 'pt-BR':'Pendente', en:'Pending', es:'Pendiente', 'ja-JP':'保留中' }); }
  teamPlanLabel(): string { return this.local({ 'pt-BR':'Equipe', en:'Team', es:'Equipo', 'ja-JP':'チーム' }); }
  teamPlanHelp(): string { return this.local({ 'pt-BR':'Até 10 contas, 200 arquivos por mês e solicitações por e-mail.', en:'Up to 10 accounts, 200 files per month and email requests.', es:'Hasta 10 cuentas, 200 archivos al mes y solicitudes por correo.', 'ja-JP':'最大10アカウント、月200ファイル、メール依頼。' }); }
  monthlyLabel(): string { return this.local({ 'pt-BR':'Mensal', en:'Monthly', es:'Mensual', 'ja-JP':'月払い' }); }
  annualLabel(): string { return this.local({ 'pt-BR':'Anual', en:'Annual', es:'Anual', 'ja-JP':'年払い' }); }
  private local(values: Record<'pt-BR' | 'en' | 'es' | 'ja-JP', string>): string { return values[this.i18n.locale()]; }

  async checkout(): Promise<void> { this.submitting.set(true); try { const result = await firstValueFrom(this.api.post<BillingCheckout>(`/billing/tenants/${this.tenantId()}/checkout`, { product_code: this.selectedPlan(), billing_interval: this.billingInterval() })); this.checkoutUrl.set(result.checkout_url); this.checkoutQrCode.set(await QRCode.toDataURL(result.checkout_url, { width: 260, margin: 2 })); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  async completeBusinessRegistration(): Promise<void> {
    this.submitting.set(true);
    try {
      const updated = await firstValueFrom(this.api.post<TenantItem>(`/tenants/${this.tenantId()}/business`, { legal_name: this.businessLegalName.trim(), cnpj: this.businessCnpj.trim() }));
      this.tenants.update(items => items.map(item => item.id === updated.id ? updated : item));
      this.businessLegalName = ''; this.businessCnpj = '';
      await this.feedback.success(this.businessSavedLabel());
    } catch (error) { await this.feedback.error(error); }
    finally { this.submitting.set(false); }
  }
  async portal(): Promise<void> { await this.redirect<BillingPortal>(`/billing/tenants/${this.tenantId()}/portal`, 'portal_url', { product_code: this.selectedPlan(), billing_interval: this.billingInterval() }); }
  openCheckout(): void { if (this.checkoutUrl()) window.location.assign(this.checkoutUrl()); }

  private async loadAccount(): Promise<void> { const account = await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${this.tenantId()}/account`)); this.account.set(account); const selected = this.availablePlans()[0] ?? 'rubrica_base'; this.selectedPlan.set(selected); }
  private planUrl(tenant: TenantItem, accountSlug: string): string { return tenantDashboardUrl(tenant, accountSlug).replace(/dashboard$/, 'plan'); }
  private async leaveComplimentaryBilling(): Promise<boolean> { return false; }
  private fileLimit(account: BillingAccount): number | null { if (typeof account.files_limit === 'number') return account.files_limit; if (!['active', 'past_due'].includes(account.status)) return null; if (account.current_product_code === 'rubrica_base') return 20; if (account.current_product_code === 'rubrica_intermediate') return 80; if (account.current_product_code === 'rubrica_team') return 200; return null; }
  private filesUsed(account: BillingAccount): number { return account.files_uploaded_in_period ?? 0; }
  private async redirect<T extends BillingCheckout | BillingPortal>(path: string, key: keyof T, payload: object = {}): Promise<void> {
    this.submitting.set(true);
    try { const result = await firstValueFrom(this.api.post<T>(path, payload)); window.location.assign(String(result[key])); }
    catch (error) { await this.feedback.error(error); this.submitting.set(false); }
  }
}
