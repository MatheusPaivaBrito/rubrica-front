import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount, BillingCheckout, BillingPortal, TenantItem } from '../core/models';
import { LanguagePickerComponent } from '../components/language-picker.component';

@Component({
  standalone: true,
  imports: [RouterLink, LanguagePickerComponent],
  template: `
    <main class="billing-shell">
      <header class="billing-top">
        <a routerLink="/dashboard" class="brand">Rubrica<span>.</span></a>
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
                <button class="plan-option" [class.selected]="selectedPlan() === 'rubrica_base'" (click)="selectedPlan.set('rubrica_base')"><strong>{{ i18n.text('basePlan') }}</strong><span>{{ i18n.text('priceAtCheckout', { currency: selectedTenantCurrency() }) }}</span><span>{{ i18n.text('basePlanHelp') }}</span></button>
                <button class="plan-option" [class.selected]="selectedPlan() === 'rubrica_intermediate'" (click)="selectedPlan.set('rubrica_intermediate')"><strong>{{ i18n.text('intermediatePlan') }}</strong><span>{{ i18n.text('priceAtCheckout', { currency: selectedTenantCurrency() }) }}</span><span>{{ i18n.text('intermediatePlanHelp') }}</span></button>
              </div>
            }
            <div class="actions">
              @if (canSubscribe()) { <button class="button" [disabled]="submitting()" (click)="checkout()"><i class="bi bi-box-arrow-up-right"></i> {{ i18n.text('subscribe') }}</button> }
              @if (showPortalAction()) { <button class="button" [disabled]="submitting()" (click)="portal()"><i class="bi bi-arrow-left-right"></i> {{ portalActionLabel() }}</button> }
            </div>
            @if (checkoutUrl()) { <div class="checkout-qr"><img [src]="checkoutQrCode()" [alt]="i18n.text('checkoutQrAlt')" /><div><strong>{{ i18n.text('checkoutFinalize') }}</strong><p>{{ i18n.text('checkoutScan') }}</p><button class="button" (click)="openCheckout()">{{ i18n.text('openStripe') }}</button></div></div> }
          }
        }
      </section>
    </main>
  `,
  styles: [`
    .billing-shell{min-height:100vh;background:#f4f7fb;padding:2rem}.billing-top,.billing-card{max-width:980px;margin:auto}.billing-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}.top-actions,.actions{display:flex;gap:.75rem;align-items:center}.billing-card{padding:2rem}.heading{display:flex;justify-content:space-between;gap:1rem}.heading>i{font-size:2.5rem;color:#635bff}.tenant-select{display:grid;gap:.45rem;max-width:420px;margin:2rem 0;font-weight:700}.billing-tenant-picker{margin-top:0}.billing-tenant-options small{margin-left:.4rem}.plan-banner{display:flex;justify-content:space-between;gap:1rem;background:linear-gradient(135deg,#8f1d2c,#c63845);color:white;padding:1.5rem;border-radius:18px}.plan-banner h2{margin:.25rem 0}.plan-banner p{margin:0;opacity:.9}.status{align-self:flex-start;background:#fff;color:#641923;padding:.4rem .7rem;border-radius:999px;font-weight:800}.metrics,.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1rem 0}.metrics article{border:1px solid #dde5ee;border-radius:14px;padding:1.1rem;display:grid;gap:.5rem}.metrics strong{font-size:1.1rem}.plans{grid-template-columns:1fr 1fr}.plan-option{display:grid;gap:.45rem;padding:1rem;border:1px solid #d7dde5;border-radius:14px;background:#fff;text-align:left}.plan-option.selected{border-color:#a82035;box-shadow:0 0 0 2px #a8203522}.plan-option span{color:#64748b}.actions{justify-content:flex-end;margin-top:1.5rem}.checkout-qr{display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-top:1.5rem;padding:1.25rem;border:1px solid #dde5ee;border-radius:16px}.checkout-qr img{width:190px;border-radius:10px}.checkout-qr p{color:#64748b}@media(max-width:700px){.billing-shell{padding:1rem}.billing-top{align-items:flex-start}.top-actions{flex-direction:column;align-items:stretch}.billing-card{padding:1.2rem}.plan-banner,.checkout-qr{flex-direction:column}.metrics,.plans{grid-template-columns:1fr}.actions{flex-direction:column}.actions .button{width:100%}}
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
      if (tenants.length) { this.tenantId.set(tenants[0].id); await this.loadAccount(); }
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
  async selectTenant(id: string, menu?: HTMLDetailsElement): Promise<void> { if (menu) menu.open = false; this.tenantId.set(id); await this.loadAccount(); }
  statusLabel(status: string): string { const keys: Record<string, Parameters<I18nService['text']>[0]> = { active:'active', pending:'pending', past_due:'pastDue', cancelled:'cancelled', paused:'paused', not_configured:'notConfigured' }; return this.i18n.text(keys[status] ?? 'notConfigured'); }
  planName(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlan'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlan'); return this.i18n.text('free'); }
  planHelp(): string { const account = this.account(); if (account?.complimentary_lifetime) return this.i18n.text('lifetimePlanHelp'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('intermediatePlanHelp'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('basePlanHelp'); return this.i18n.text('fiveFree'); }
  usageLabel(): string { const account = this.account(); return account && this.fileLimit(account) !== null ? this.i18n.text('monthlyUsage') : this.i18n.text('usage'); }
  usageValue(): string { const account = this.account(); if (!account) return this.i18n.text('unavailable'); return this.fileLimit(account) !== null ? this.i18n.text('files', { count: this.filesUsed(account) }) : this.i18n.text('signatures', { count: account.signatures_used }); }
  canSubscribe(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && this.fileLimit(account) === null && (!account.provider_subscription_id || ['cancelled', 'not_configured'].includes(account.status))); }
  showPortalAction(): boolean { const account = this.account(); return Boolean(account && !account.complimentary_lifetime && (account.provider_customer_id || account.status !== 'not_configured')); }
  portalActionLabel(): string { const account = this.account(); if (account?.cancel_at_period_end) return this.i18n.text('reactivateSubscription'); if (account?.current_product_code === 'rubrica_base' && this.fileLimit(account) !== null) return this.i18n.text('upgradePlan'); if (account?.current_product_code === 'rubrica_intermediate' && this.fileLimit(account) !== null) return this.i18n.text('changePlan'); return this.i18n.text('manageSubscription'); }

  async checkout(): Promise<void> { this.submitting.set(true); try { const result = await firstValueFrom(this.api.post<BillingCheckout>(`/billing/tenants/${this.tenantId()}/checkout`, { product_code: this.selectedPlan() })); this.checkoutUrl.set(result.checkout_url); this.checkoutQrCode.set(await QRCode.toDataURL(result.checkout_url, { width: 260, margin: 2 })); } catch (error) { await this.feedback.error(error); } finally { this.submitting.set(false); } }
  async portal(): Promise<void> { await this.redirect<BillingPortal>(`/billing/tenants/${this.tenantId()}/portal`, 'portal_url'); }
  openCheckout(): void { if (this.checkoutUrl()) window.location.assign(this.checkoutUrl()); }

  private async loadAccount(): Promise<void> { const account = await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${this.tenantId()}/account`)); this.account.set(account); if (account.current_product_code === 'rubrica_base' || account.current_product_code === 'rubrica_intermediate') this.selectedPlan.set(account.current_product_code); }
  private fileLimit(account: BillingAccount): number | null { if (typeof account.files_limit === 'number') return account.files_limit; if (!['active', 'past_due'].includes(account.status)) return null; if (account.current_product_code === 'rubrica_base') return 25; if (account.current_product_code === 'rubrica_intermediate') return 30; return null; }
  private filesUsed(account: BillingAccount): number { return account.files_uploaded_in_period ?? 0; }
  private async redirect<T extends BillingCheckout | BillingPortal>(path: string, key: keyof T): Promise<void> {
    this.submitting.set(true);
    try { const result = await firstValueFrom(this.api.post<T>(path, {})); window.location.assign(String(result[key])); }
    catch (error) { await this.feedback.error(error); this.submitting.set(false); }
  }
}
