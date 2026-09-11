import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, Locale } from '../core/i18n.service';
import { BillingAccount, BillingCheckout, BillingPortal, TenantItem } from '../core/models';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="billing-shell">
      <header class="billing-top">
        <a routerLink="/dashboard" class="brand">Rubrica<span>.</span></a>
        <div class="top-actions">
          <select [ngModel]="i18n.locale()" (ngModelChange)="changeLocale($event)" [attr.aria-label]="i18n.text('language')">
            <option value="pt-BR">Português</option><option value="en">English</option><option value="ja-JP">日本語</option>
          </select>
          <a routerLink="/dashboard" class="button secondary">{{ i18n.text('backDashboard') }}</a>
        </div>
      </header>
      <section class="billing-card card">
        <div class="heading"><div><p class="eyebrow">Stripe</p><h1>{{ i18n.text('billing') }}</h1><p class="muted">{{ i18n.text('billingHelp') }}</p></div><i class="bi bi-credit-card-2-front"></i></div>
        @if (loading()) { <p class="notice">{{ i18n.text('loading') }}</p> }
        @else if (!tenants().length) { <p class="notice warning">{{ i18n.text('billingAdminOnly') }}</p> }
        @else {
          <label class="tenant-select">{{ i18n.text('chooseTenant') }}
            <select [ngModel]="tenantId()" (ngModelChange)="selectTenant($event)">@for (tenant of tenants(); track tenant.id) { <option [value]="tenant.id">{{ tenant.name }} · {{ tenant.currency }}</option> }</select>
          </label>
          @if (account()) {
            <div class="plan-banner"><div><small>{{ i18n.text('plan') }}</small><h2>{{ account()!.unlimited_signatures ? i18n.text('paidPlan') : i18n.text('free') }}</h2><p>{{ account()!.unlimited_signatures ? i18n.text('paidPlanHelp') : i18n.text('fiveFree') }}</p></div><span class="status" [attr.data-status]="account()!.status">{{ statusLabel(account()!.status) }}</span></div>
            <div class="metrics">
              <article><small>{{ i18n.text('usage') }}</small><strong>{{ i18n.text('signatures', { count: account()!.signatures_used }) }}</strong></article>
              <article><small>{{ i18n.text('availableNow') }}</small><strong>{{ availability() }}</strong></article>
              <article><small>{{ i18n.text('currentPeriod') }}</small><strong>{{ i18n.formatDate(account()!.current_period_ends_at) }}</strong></article>
            </div>
            <div class="actions">
              @if (!account()!.unlimited_signatures) { <button class="button" [disabled]="submitting()" (click)="checkout()"><i class="bi bi-box-arrow-up-right"></i> {{ i18n.text('subscribe') }}</button> }
              @if (account()!.provider_customer_id || account()!.status !== 'not_configured') { <button class="button secondary" [disabled]="submitting()" (click)="portal()">{{ i18n.text('manageSubscription') }}</button> }
            </div>
          }
        }
      </section>
    </main>
  `,
  styles: [`
    .billing-shell{min-height:100vh;background:#f4f7fb;padding:2rem}.billing-top,.billing-card{max-width:980px;margin:auto}.billing-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}.top-actions,.actions{display:flex;gap:.75rem;align-items:center}.top-actions select,.tenant-select select{border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:.7rem}.billing-card{padding:2rem}.heading{display:flex;justify-content:space-between;gap:1rem}.heading>i{font-size:2.5rem;color:#635bff}.tenant-select{display:grid;gap:.45rem;max-width:420px;margin:2rem 0;font-weight:700}.plan-banner{display:flex;justify-content:space-between;gap:1rem;background:linear-gradient(135deg,#0f766e,#155e75);color:white;padding:1.5rem;border-radius:18px}.plan-banner h2{margin:.25rem 0}.plan-banner p{margin:0;opacity:.9}.status{align-self:flex-start;background:#fff;color:#17423c;padding:.4rem .7rem;border-radius:999px;font-weight:800}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1rem 0}.metrics article{border:1px solid #dde5ee;border-radius:14px;padding:1.1rem;display:grid;gap:.5rem}.metrics strong{font-size:1.1rem}.actions{justify-content:flex-end;margin-top:1.5rem}@media(max-width:700px){.billing-shell{padding:1rem}.billing-top{align-items:flex-start}.top-actions{flex-direction:column;align-items:stretch}.billing-card{padding:1.2rem}.plan-banner{flex-direction:column}.metrics{grid-template-columns:1fr}.actions{flex-direction:column}.actions .button{width:100%}}
  `],
})
export class BillingPageComponent implements OnInit {
  readonly tenants = signal<TenantItem[]>([]);
  readonly tenantId = signal('');
  readonly account = signal<BillingAccount | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly availability = computed(() => {
    const account = this.account();
    if (!account) return this.i18n.text('unavailable');
    return account.unlimited_signatures ? this.i18n.text('unlimited') : this.i18n.text('remainingOf', { remaining: account.signatures_remaining ?? 0, limit: account.free_signatures_limit });
  });

  constructor(readonly i18n: I18nService, private readonly api: ApiService, private readonly auth: AuthService, private readonly feedback: FeedbackService, private readonly route: ActivatedRoute, private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    const context = await this.auth.restore();
    if (!context) { await this.router.navigate(['/login'], { queryParams: { returnUrl: '/plan' } }); return; }
    try {
      const tenants = (await firstValueFrom(this.api.get<TenantItem[]>('/tenants'))).filter(item => item.role === 'admin');
      this.tenants.set(tenants);
      if (tenants.length) { this.tenantId.set(tenants[0].id); await this.loadAccount(); }
      const checkout = this.route.snapshot.queryParamMap.get('checkout');
      if (checkout === 'success') await this.feedback.success(this.i18n.text('checkoutSuccess'));
      if (checkout === 'cancelled') await this.feedback.warning(this.i18n.text('checkoutCancelled'));
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }

  async selectTenant(id: string): Promise<void> { this.tenantId.set(id); await this.loadAccount(); }
  changeLocale(locale: Locale): void { this.i18n.setLocale(locale); }
  statusLabel(status: string): string { const keys: Record<string, Parameters<I18nService['text']>[0]> = { active:'active', pending:'pending', past_due:'pastDue', cancelled:'cancelled', paused:'paused', not_configured:'notConfigured' }; return this.i18n.text(keys[status] ?? 'notConfigured'); }

  async checkout(): Promise<void> { await this.redirect< BillingCheckout >(`/billing/tenants/${this.tenantId()}/checkout`, 'checkout_url'); }
  async portal(): Promise<void> { await this.redirect<BillingPortal>(`/billing/tenants/${this.tenantId()}/portal`, 'portal_url'); }

  private async loadAccount(): Promise<void> { this.account.set(await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${this.tenantId()}/account`))); }
  private async redirect<T extends BillingCheckout | BillingPortal>(path: string, key: keyof T): Promise<void> {
    this.submitting.set(true);
    try { const result = await firstValueFrom(this.api.post<T>(path, {})); window.location.assign(String(result[key])); }
    catch (error) { await this.feedback.error(error); this.submitting.set(false); }
  }
}
