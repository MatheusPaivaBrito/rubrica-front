import { Component, HostListener, Input, OnChanges, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount, TenantItem } from '../core/models';
import { teamCopy } from '../core/team-copy';
import { LanguagePickerComponent } from './language-picker.component';

@Component({
  selector: 'app-workspace-sidebar', standalone: true, imports: [RouterLink, RouterLinkActive, LanguagePickerComponent],
  template: `@if (tenant) {
    <header class="mobile-workspace-topbar">
      <button type="button" class="mobile-sidebar-toggle" [attr.aria-label]="copy().openMenu" [attr.aria-expanded]="mobileOpen()" (click)="openMobile()">
        <i class="bi bi-list" aria-hidden="true"></i>
      </button>
      <img src="icons/rubrica-brand/lockup/384x384/rubrica-lockup-inverse-384x384.png" alt="Rubrica Signature" />
    </header>
    @if (mobileOpen()) {
      <button type="button" class="workspace-sidebar-backdrop" [attr.aria-label]="copy().closeMenu" (click)="closeMobile()"></button>
    }
    <aside class="workspace-sidebar" [class.mobile-open]="mobileOpen()" [attr.aria-label]="copy().nav">
      <button type="button" class="mobile-sidebar-close" [attr.aria-label]="copy().closeMenu" (click)="closeMobile()"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      <div class="sidebar-main">
        <a class="sidebar-brand" [routerLink]="url('dashboard')" aria-label="Rubrica Signature" (click)="closeMobile()">
          <img src="icons/rubrica-brand/lockup/384x384/rubrica-lockup-inverse-384x384.png" alt="Rubrica Signature" />
        </a>
        <div class="sidebar-account">
          <span>{{ i18n.text('account') }}</span>
          <strong>{{ tenant.name }}</strong>
          <small>{{ auth.context()?.subject }}</small>
          @if (billingAccount(); as account) { <small class="sidebar-plan">Rubrica — {{ accountPlanName(account) }}</small> }
          @if (tenant.kind === 'business') {
            <div class="sidebar-company">
              <span>{{ companyLabel() }}</span>
              <small [title]="tenant.legal_name || tenant.name">{{ legalNameLabel() }}: {{ tenant.legal_name || tenant.name }}</small>
              @if (tenant.registration_masked) { <small>CNPJ: {{ tenant.registration_masked }}</small> }
            </div>
          }
        </div>
        <nav class="sidebar-navigation" [attr.aria-label]="copy().nav">
          <a [routerLink]="url('dashboard')" routerLinkActive="selected" ariaCurrentWhenActive="page" (click)="closeMobile()"><i class="bi bi-grid-1x2" aria-hidden="true"></i><span>{{ copy().dashboard }}</span></a>
          @if (showTeam()) { <a [routerLink]="url('team')" routerLinkActive="selected" ariaCurrentWhenActive="page" (click)="closeMobile()"><i class="bi bi-people" aria-hidden="true"></i><span>{{ copy().team }}</span></a> }
          @if (tenant.role === 'admin') { <a [routerLink]="url('plan')" routerLinkActive="selected" ariaCurrentWhenActive="page" (click)="closeMobile()"><i class="bi bi-credit-card" aria-hidden="true"></i><span>{{ i18n.text('billing') }}</span></a> }
        </nav>
      </div>
      <div class="sidebar-tools">
        <app-language-picker />
        <button type="button" class="sidebar-action" (click)="security()"><i class="bi bi-shield-lock" aria-hidden="true"></i><span>{{ i18n.text('dashboardSecurity') }}</span></button>
        <button type="button" class="sidebar-action" (click)="logout()"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>{{ i18n.text('logout') }}</span></button>
      </div>
    </aside>
  }`,
})
export class WorkspaceSidebarComponent implements OnChanges {
  @Input() tenant?: TenantItem;
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly showTeam = signal(false);
  readonly billingAccount = signal<BillingAccount | null>(null);
  readonly mobileOpen = signal(false);
  async ngOnChanges() {
    this.showTeam.set(false);
    this.billingAccount.set(null);
    if (!this.tenant) return;
    try {
      const account = await firstValueFrom(this.api.get<BillingAccount>(`/billing/tenants/${this.tenant.id}/account`));
      const paid = account.status === 'active' || account.status === 'past_due';
      this.billingAccount.set(account);
      this.showTeam.set(this.tenant.role === 'admin' && (account.complimentary_lifetime || (paid && ['rubrica_intermediate', 'rubrica_team'].includes(account.current_product_code ?? ''))));
    } catch { this.showTeam.set(false); this.billingAccount.set(null); }
  }
  copy() { return teamCopy[this.i18n.locale()]; }
  openMobile() { this.mobileOpen.set(true); }
  closeMobile() { this.mobileOpen.set(false); }
  @HostListener('document:keydown.escape') onEscape() { this.closeMobile(); }
  url(page: 'dashboard' | 'team' | 'plan'): string {
    const slug = this.auth.context()?.account_public_slug;
    return this.tenant && slug ? tenantDashboardUrl(this.tenant, slug).replace(/dashboard$/, page) : `/${page}`;
  }
  security() { this.closeMobile(); return this.router.navigate(['/security']); }
  async logout() { this.closeMobile(); await this.auth.logout(); await this.router.navigate(['/login']); }
  accountPlanName(account: BillingAccount): string {
    if (account.complimentary_lifetime) return this.i18n.text('lifetimePlan').replace(/^Rubrica\s+/i, '');
    if (account.current_product_code === 'rubrica_team' && ['active', 'past_due'].includes(account.status)) return ({ 'pt-BR':'Equipe', en:'Team', es:'Equipo', 'ja-JP':'チーム' })[this.i18n.locale()];
    if (account.current_product_code === 'rubrica_intermediate' && ['active', 'past_due'].includes(account.status)) return this.i18n.text('intermediatePlan');
    if (account.current_product_code === 'rubrica_base' && ['active', 'past_due'].includes(account.status)) return this.i18n.text('basePlan');
    return this.i18n.text('free');
  }
  companyLabel(): string { return ({ 'pt-BR':'Empresa', en:'Company', es:'Empresa', 'ja-JP':'法人' })[this.i18n.locale()]; }
  legalNameLabel(): string { return ({ 'pt-BR':'Razão social', en:'Legal name', es:'Razón social', 'ja-JP':'法人名' })[this.i18n.locale()]; }
}
