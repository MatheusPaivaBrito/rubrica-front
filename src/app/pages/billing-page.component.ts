import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';
import Swal from 'sweetalert2';

import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount, BillingCheckout, BillingPortal, TenantItem, TenantTeam } from '../core/models';
import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';

interface BusinessUpgradeReview {
  legal_name: string;
  cnpj_masked: string;
  status: 'pending' | 'approved' | 'rejected';
}

@Component({
  standalone: true,
  imports: [FormsModule, WorkspaceSidebarComponent],
  template: `
    <main class="shell">
      <div class="workspace-layout"><app-workspace-sidebar [tenant]="selectedTenant()" />
      <section class="container dashboard-container billing-container">
      <header class="billing-heading">
        <h1>{{ i18n.text('billing') }}</h1>
        @if (selectedTenant(); as tenant) { <p class="muted">{{ tenant.name }}</p> }
      </header>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (!tenants().length) { <p class="notice warning">{{ i18n.text('billingAdminOnly') }}</p> }
        @else {
          @if (account()) {
            <article class="card billing-summary">
              <div class="summary-header">
                <div><p class="muted">{{ sectionLabel('current') }}</p><h2>{{ planName() }}</h2><p class="muted">{{ planHelp() }}</p></div>
                <span class="status" [attr.data-status]="account()!.complimentary_lifetime ? 'complimentary' : account()!.status">{{ account()!.complimentary_lifetime ? i18n.text('complimentary') : statusLabel(account()!.status) }}</span>
              </div>
              <dl class="metrics">
                <div><dt>{{ usageLabel() }}</dt><dd>{{ usageValue() }}</dd></div>
                <div><dt>{{ i18n.text('availableNow') }}</dt><dd>{{ availability() }}</dd></div>
                <div><dt>{{ account()!.cancel_at_period_end ? i18n.text('cancelsOn') : i18n.text('currentPeriod') }}</dt><dd>{{ i18n.formatDate(account()!.cancels_at || account()!.current_period_ends_at) }}</dd></div>
              </dl>
              @if (showPortalAction()) {
                <div class="actions summary-actions"><button type="button" class="button secondary" [disabled]="submitting()" (click)="manageSubscription()"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> {{ manageSubscriptionLabel() }}</button></div>
              }
            </article>
            @if (canSubscribe() || showPortalAction()) {
              <article class="card billing-plans">
              <header class="plans-header">
                <h2>{{ sectionLabel('plans') }}</h2>
                <div class="billing-interval" role="group" [attr.aria-label]="sectionLabel('frequency')"><button type="button" [attr.aria-pressed]="billingInterval() === 'month'" (click)="billingInterval.set('month')">{{ monthlyLabel() }}</button><button type="button" [attr.aria-pressed]="billingInterval() === 'year'" (click)="billingInterval.set('year')">{{ annualLabel() }}</button></div>
              </header>
              <div class="plans" [class.two-options]="availablePlans().length === 2">
                @for (plan of availablePlans(); track plan) {
                  <button type="button" class="plan-option" [attr.aria-pressed]="selectedPlan() === plan" [class.selected]="selectedPlan() === plan" (click)="selectedPlan.set(plan)">
                    <strong>{{ planLabel(plan) }}</strong><span class="plan-price">{{ planPrice(plan) }}</span>
                    <ul>@for (feature of planFeatures(plan); track feature) { <li>{{ feature }}</li> }</ul>
                  </button>
                }
              </div>
            @if (needsBusinessReview()) {
              <section class="business-card">
                <h2>{{ businessReviewLabel() }}</h2>
                @if (businessReview() && businessReview()?.status !== 'rejected') {
                  <p>{{ businessReview()?.legal_name }} · {{ businessReview()?.cnpj_masked }} · {{ businessReviewStatus() }}</p>
                } @else {
                  <form class="form business-registration-form" (ngSubmit)="submitBusinessReview()">
                    <label>{{ legalNameLabel() }}<input name="reviewLegalName" [(ngModel)]="businessLegalName" required /></label>
                    <label>CNPJ<input name="reviewCnpj" [(ngModel)]="businessCnpj" required inputmode="numeric" autocomplete="off" /></label>
                    <button class="button" [disabled]="submitting() || !businessLegalName.trim() || !businessCnpj.trim()">
                      {{ businessReviewLabel() }}
                    </button>
                  </form>
                }
              </section>
            }
            <div class="actions">
              @if (canSubscribe() || needsBusinessReview()) { <button class="button" [disabled]="submitting() || (needsBusinessReview() && businessReview()?.status !== 'approved')" (click)="checkout()"><i class="bi bi-box-arrow-up-right"></i> {{ i18n.text('subscribe') }}</button> }
              @if (showPortalAction() && !needsBusinessReview()) { <button class="button" [disabled]="submitting()" (click)="portal()"><i class="bi bi-arrow-left-right"></i> {{ confirmChangeLabel() }}</button> }
            </div>
            @if (checkoutUrl()) { <div class="checkout-qr"><img [src]="checkoutQrCode()" [alt]="i18n.text('checkoutQrAlt')" /><div><strong>{{ i18n.text('checkoutFinalize') }}</strong><p>{{ i18n.text('checkoutScan') }}</p><button class="button" (click)="openCheckout()">{{ i18n.text('openStripe') }}</button></div></div> }
              </article>
            }
            @if (selectedTenant()?.kind !== 'business' && businessEligible() && !needsBusinessReview()) {
              <section class="card business-card business-registration"><div><p class="eyebrow">{{ businessEyebrow() }}</p><h2>{{ businessPendingTitle() }}</h2><p class="muted">{{ businessFormHelp() }}</p></div><span class="status" data-status="pending">{{ pendingLabel() }}</span>
                <form class="form business-registration-form" (ngSubmit)="completeBusinessRegistration()">
                  <label>{{ legalNameLabel() }}<input name="businessLegalName" [(ngModel)]="businessLegalName" required autocomplete="organization" /></label>
                  <label>CNPJ<input name="businessCnpj" [(ngModel)]="businessCnpj" required inputmode="numeric" placeholder="00.000.000/0000-00" autocomplete="off" /></label>
                  <button class="button" [disabled]="submitting() || !businessLegalName.trim() || !businessCnpj.trim()">{{ saveBusinessLabel() }}</button>
                </form>
              </section>
            }
          }
        }
          @if (closureState(); as state) {
            <details class="card closure-card" [open]="!!state.export_until || !!state.closure_requested_at">
              <summary><span>{{ closureLabel() }}</span><i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
              <div class="closure-body">
              @if (state.export_until) {
                <p role="status">{{ exportNotice(state.export_until) }}</p>
              } @else {
                <p class="muted">{{ closureHelp() }}</p>
                @if (state.closure_requested_at) { <p role="status">{{ closurePendingText() }}</p> }
                <div class="actions closure-actions">
                @if (state.closure_requested_at) {
                  <button type="button" class="button" [disabled]="submitting()" (click)="confirmClosure()">
                    {{ confirmClosureLabel() }}
                  </button>
                }
                <button type="button" class="button secondary" [disabled]="submitting()"
                  (click)="changeClosureRequest(!state.closure_requested_at)">
                  {{ closureAction(!state.closure_requested_at) }}
                </button>
                </div>
              }
              </div>
            </details>
          }
      </section></div>
    </main>
  `,
  styles: [`
    .billing-container { max-width: 1050px; display: grid; align-content: start; gap: 1rem; padding-top: 2rem; padding-bottom: 3rem; }
    .billing-heading h1, .billing-heading p, .summary-header h2, .summary-header p, .plans-header h2 { margin: 0; }
    .billing-heading p { margin-top: .3rem; }
    .billing-summary, .billing-plans { padding: clamp(1rem, 2.2vw, 1.6rem); min-width: 0; }
    .summary-header, .plans-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem 1rem; flex-wrap: wrap; }
    .summary-header h2 { margin: .2rem 0 .35rem; font-size: clamp(1.45rem, 2.4vw, 2rem); }
    .summary-header > div > p:first-child { font-size: .85rem; font-weight: 700; }
    .status { align-self: flex-start; background: #eef2f7; color: #334155; padding: .4rem .7rem; border-radius: 999px; font-size: .82rem; font-weight: 750; }
    .status[data-status="active"], .status[data-status="complimentary"] { background: #e4f4ed; color: #17604b; }
    .status[data-status="past_due"], .status[data-status="pending"] { background: #fff2de; color: #7a4515; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .85rem; margin: 1.2rem 0 0; padding-top: 1rem; border-top: 1px solid #e6ecf3; }
    .metrics dt { color: #52647a; font-size: .85rem; }
    .metrics dd { margin: .3rem 0 0; font-weight: 750; }
    .plans-header { align-items: center; }
    .plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .85rem; margin-top: 1rem; }
    .plans.two-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .plan-option { display: flex; flex-direction: column; align-items: flex-start; gap: .35rem; min-width: 0; padding: 1rem; border: 1px solid #d4deea; border-radius: 12px; color: #1c293b; background: #fff; text-align: left; cursor: pointer; }
    .plan-option.selected { border-color: #a82035; background: #fff8f8; box-shadow: 0 0 0 1px #a82035; }
    .plan-option:focus-visible, .billing-interval button:focus-visible, .closure-card summary:focus-visible { outline: 2px solid #a82035; outline-offset: 3px; }
    .plan-option .plan-price { font-size: 1.2rem; font-weight: 750; }
    .plan-option ul { margin: .5rem 0 0; padding-left: 1.15rem; color: #475569; }
    .plan-option li + li { margin-top: .3rem; }
    .billing-interval { display: inline-flex; gap: .2rem; padding: .2rem; border-radius: 10px; background: #eef2f7; }
    .billing-interval button { padding: .45rem .75rem; border: 1px solid transparent; border-radius: 8px; background: transparent; font-weight: 700; color: #475569; cursor: pointer; }
    .billing-interval button[aria-pressed="true"] { color: #86172a; border-color: #eddcde; background: #fff; }
    .actions { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: .65rem; }
    .actions:not(:empty) { margin-top: 1rem; }
    .summary-actions { justify-content: flex-start; }
    .checkout-qr { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; padding: 1rem; border: 1px solid #dde5ee; border-radius: 12px; }
    .checkout-qr img { width: min(150px, 100%); }
    .business-card { padding: 1rem; margin-top: 1rem; border: 1px solid #ebd9dc; border-radius: 12px; background: #fffafa; }
    .business-registration { margin-top: 0; }
    .business-card h2 { margin: 0 0 .5rem; }
    .business-registration-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .7fr) auto; gap: .75rem; align-items: end; }
    .closure-card { padding: 0; }
    .closure-card summary { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: 1rem 1.25rem; list-style: none; font-weight: 750; cursor: pointer; }
    .closure-card summary::-webkit-details-marker { display: none; }
    .closure-card[open] summary i { transform: rotate(180deg); }
    .closure-body { padding: 0 1.25rem 1rem; }
    .closure-body p { margin: 0 0 .65rem; }
    .closure-actions { justify-content: flex-start; }
    @media (max-width: 700px) {
      .billing-container { padding-top: 1rem; }
      .plans, .plans.two-options, .business-registration-form { grid-template-columns: minmax(0, 1fr); }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .checkout-qr { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class BillingPageComponent implements OnInit {
  readonly tenants = signal<TenantItem[]>([]);
  readonly tenantId = signal('');
  readonly closureState = signal<TenantTeam | null>(null);
  readonly account = signal<BillingAccount | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly selectedPlan = signal<'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'>('rubrica_base');
  readonly billingInterval = signal<'month' | 'year'>('month');
  readonly checkoutUrl = signal('');
  readonly checkoutQrCode = signal('');
  businessLegalName = '';
  businessCnpj = '';
  readonly businessReview = signal<BusinessUpgradeReview | null>(null);
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
        'pt-BR':['220 arquivos por mês','10 cadeiras incluídas','Convites e solicitações por e-mail','Cadastro empresarial com CNPJ'],
        en:['220 files per month','10 seats included','Email invitations and requests','Business registration with CNPJ'], es:['220 archivos al mes','10 asientos incluidos','Invitaciones y solicitudes por correo','Registro empresarial con CNPJ'], 'ja-JP':['月220ファイル','10シート込み','メール招待と依頼','CNPJによる法人登録'],
      },
    } as const;
    return [...features[plan][this.i18n.locale()]];
  }
  showPortalAction(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && account.provider_customer_id && account.provider_subscription_id); }
  portalActionLabel(): string { const account = this.account(); if (account?.cancel_at_period_end) return this.i18n.text('reactivateSubscription'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('upgradePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('changePlan'); return this.i18n.text('manageSubscription'); }
  confirmChangeLabel(): string { return this.local({ 'pt-BR':'Confirmar troca no Stripe', en:'Confirm change in Stripe', es:'Confirmar cambio en Stripe', 'ja-JP':'Stripeで変更を確認' }); }
  planPrice(plan: 'rubrica_base' | 'rubrica_intermediate' | 'rubrica_team'): string { if (this.selectedTenantCurrency() !== 'BRL') return this.i18n.text('priceAtCheckout', { currency: this.selectedTenantCurrency() }); if (this.billingInterval() === 'year') { if (plan === 'rubrica_base') return 'R$ 299,90/ano'; if (plan === 'rubrica_intermediate') return 'R$ 699,90/ano'; return 'R$ 1.499,90/ano'; } if (plan === 'rubrica_base') return 'R$ 29,90/mês'; if (plan === 'rubrica_intermediate') return 'R$ 69,90/mês'; return 'R$ 149,90/mês'; }
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
  teamPlanHelp(): string { return this.local({ 'pt-BR':'10 cadeiras, 220 arquivos por mês e expansão por pacotes adicionais.', en:'10 seats, 220 files per month and expansion through additional packages.', es:'10 asientos, 220 archivos al mes y ampliación mediante paquetes adicionales.', 'ja-JP':'10シート、月220ファイル、追加パッケージで拡張可能。' }); }
  monthlyLabel(): string { return this.local({ 'pt-BR':'Mensal', en:'Monthly', es:'Mensual', 'ja-JP':'月払い' }); }
  annualLabel(): string { return this.local({ 'pt-BR':'Anual', en:'Annual', es:'Anual', 'ja-JP':'年払い' }); }
  private local(values: Record<'pt-BR' | 'en' | 'es' | 'ja-JP', string>): string { return values[this.i18n.locale()]; }

  needsBusinessReview(): boolean {
    return this.selectedTenant()?.kind === 'personal' && this.selectedPlan() !== 'rubrica_base';
  }

  businessReviewLabel(): string {
    return this.local({ 'pt-BR': 'Solicitar revisão do CNPJ', en: 'Request CNPJ review', es: 'Solicitar revisión del CNPJ', 'ja-JP': 'CNPJの審査を申請' });
  }

  businessReviewStatus(): string {
    return this.businessReview()?.status === 'approved'
      ? this.local({ 'pt-BR': 'Aprovado', en: 'Approved', es: 'Aprobado', 'ja-JP': '承認済み' })
      : this.local({ 'pt-BR': 'Em análise', en: 'Under review', es: 'En revisión', 'ja-JP': '審査中' });
  }

  async submitBusinessReview(): Promise<void> {
    const id = this.tenantId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    try {
      const review = await firstValueFrom(this.api.post<BusinessUpgradeReview>(`/tenants/${id}/business-upgrade-review`, {
        legal_name: this.businessLegalName.trim(), cnpj: this.businessCnpj.trim(),
      }));
      if (this.tenantId() === id) this.businessReview.set(review);
      this.businessCnpj = '';
      this.businessLegalName = '';
    } catch (error) { await this.feedback.error(error); }
    finally { this.submitting.set(false); }
  }

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

  private async loadAccount(): Promise<void> {
    const id = this.tenantId();
    this.businessReview.set(null);
    this.closureState.set(null);
    this.account.set(null);
    if (this.selectedTenant()?.kind === 'business') {
      const state = await firstValueFrom(this.api.get<TenantTeam>(`/tenants/${id}/team`));
      if (id !== this.tenantId()) return;
      this.closureState.set(state);
      if (state.export_until) return;
    }
    const account = await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${id}/account`));
    if (id !== this.tenantId()) return;
    this.account.set(account);
    this.selectedPlan.set(this.availablePlans()[0] ?? 'rubrica_base');
    if (this.selectedTenant()?.kind !== 'personal') return;
    const review = await firstValueFrom(this.api.get<BusinessUpgradeReview | null>(`/tenants/${id}/business-upgrade-review`));
    if (id === this.tenantId()) this.businessReview.set(review);
  }
  sectionLabel(section: 'current' | 'plans' | 'frequency'): string {
    return this.local({
      current: { 'pt-BR': 'Plano atual', en: 'Current plan', es: 'Plan actual', 'ja-JP': '現在のプラン' },
      plans: { 'pt-BR': 'Planos disponíveis', en: 'Available plans', es: 'Planes disponibles', 'ja-JP': '利用可能なプラン' },
      frequency: { 'pt-BR': 'Frequência de cobrança', en: 'Billing frequency', es: 'Frecuencia de cobro', 'ja-JP': '請求頻度' },
    }[section]);
  }
  manageSubscriptionLabel(): string {
    return this.local({ 'pt-BR': 'Gerenciar ou cancelar assinatura', en: 'Manage or cancel subscription', es: 'Gestionar o cancelar suscripción', 'ja-JP': '契約の管理・解約' });
  }
  async manageSubscription(): Promise<void> {
    await this.redirect<BillingPortal>(`/billing/tenants/${this.tenantId()}/subscription-management`, 'portal_url');
  }
  closureHelp(): string {
    return this.local({
      'pt-BR': 'Para parar a cobrança, cancele a assinatura no Stripe. Encerre o workspace se também quiser bloquear novos envios e iniciar o prazo de 30 dias para baixar os PDFs.',
      en: 'Cancel your Stripe subscription to stop billing. Close the workspace to also block new uploads and start the 30-day PDF download window.',
      es: 'Cancela la suscripción en Stripe para detener los cobros. Cierra el espacio para bloquear las cargas nuevas e iniciar los 30 días de descarga.',
      'ja-JP': '請求を止めるには Stripe で契約を解約します。ワークスペースを閉鎖すると新規アップロードが停止し、30日間PDFをダウンロードできます。',
    });
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
    const tenant = this.selectedTenant();
    if (!tenant || this.submitting()) return;
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
    this.submitting.set(true);
    try {
      this.closureState.set(await firstValueFrom(this.api.post<TenantTeam>(`/tenants/${tenant.id}/close`, {})));
      this.account.set(null);
    } catch (error) { await this.feedback.error(error); }
    finally { this.submitting.set(false); }
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
    const tenant = this.selectedTenant();
    if (!tenant || this.submitting()) return;
    const result = await Swal.fire({
      title: this.closureAction(requested),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.closureAction(requested),
      cancelButtonText: this.i18n.text('cancel'),
    });
    if (!result.isConfirmed) return;
    this.submitting.set(true);
    try {
      const team = await firstValueFrom(this.api.put<TenantTeam>(
        `/tenants/${tenant.id}/closure-request`, { requested },
      ));
      this.closureState.set(team);
    } catch (error) { await this.feedback.error(error); }
    finally { this.submitting.set(false); }
  }
  private planUrl(tenant: TenantItem, accountSlug: string): string { return tenantDashboardUrl(tenant, accountSlug).replace(/dashboard$/, 'plan'); }
  private async leaveComplimentaryBilling(): Promise<boolean> { return false; }
  private fileLimit(account: BillingAccount): number | null { if (typeof account.files_limit === 'number') return account.files_limit; if (!['active', 'past_due'].includes(account.status)) return null; if (account.current_product_code === 'rubrica_base') return 20; if (account.current_product_code === 'rubrica_intermediate') return 80; if (account.current_product_code === 'rubrica_team') return 220; return null; }
  private filesUsed(account: BillingAccount): number { return account.files_uploaded_in_period ?? 0; }
  private async redirect<T extends BillingCheckout | BillingPortal>(path: string, key: keyof T, payload: object = {}): Promise<void> {
    this.submitting.set(true);
    try { const result = await firstValueFrom(this.api.post<T>(path, payload)); window.location.assign(String(result[key])); }
    catch (error) { await this.feedback.error(error); this.submitting.set(false); }
  }
}
