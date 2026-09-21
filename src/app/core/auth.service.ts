import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { getAccessToken, setAccessToken } from './api-auth.interceptor';
import { I18nService } from './i18n.service';
import { TenantItem } from './models';

export interface AccessContext {
  version: number;
  subject: string;
  preferred_locale: 'pt-BR' | 'en' | 'es' | 'ja-JP';
  mfa_enabled: boolean;
  mfa_setup_required: boolean;
  roles: string[];
  permission_keys: string[];
}

interface LoginResponse { access_token: string; }
export interface MfaChallenge { mfa_required: true; mfa_ticket: string; expires_in: number; }

export function tenantDashboardUrl(slug: string): string {
  const accountPrefix = 'account-';
  return slug.startsWith(accountPrefix)
    ? `/tenant/a/${encodeURIComponent(slug.slice(accountPrefix.length))}/dashboard`
    : `/tenant/${encodeURIComponent(slug)}/dashboard`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly context = signal<AccessContext | null>(null);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly http: HttpClient, private readonly i18n: I18nService) {}

  async login(email: string, password: string, turnstileToken?: string): Promise<AccessContext | MfaChallenge> {
    const response = await firstValueFrom(this.http.post<LoginResponse | MfaChallenge>('/auth/login', { email, password, turnstile_token: turnstileToken || null }));
    if ('mfa_required' in response) return response;
    setAccessToken(response.access_token);
    return this.loadContext();
  }

  async completeMfa(mfaTicket: string, code: string): Promise<AccessContext> {
    const response = await firstValueFrom(this.http.post<LoginResponse>('/auth/mfa/challenge', {
      mfa_ticket: mfaTicket,
      code,
    }));
    setAccessToken(response.access_token);
    return this.loadContext();
  }

  async restore(): Promise<AccessContext | null> {
    if (!this.browser) return null;
    if (!getAccessToken()) {
      try {
        const response = await firstValueFrom(this.http.post<LoginResponse>('/auth/refresh', {}));
        setAccessToken(response.access_token);
      } catch { return null; }
    }
    try { return await this.loadContext(); }
    catch { setAccessToken(null); return null; }
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post('/auth/logout', {})); }
    finally {
      setAccessToken(null);
      this.context.set(null);
    }
  }

  can(permission: string): boolean {
    const permissions = this.context()?.permission_keys ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  refreshContext(): Promise<AccessContext> { return this.loadContext(); }

  async dashboardUrl(): Promise<string> {
    try {
      const tenants = await firstValueFrom(this.http.get<TenantItem[]>('/tenants'));
      return tenants.length ? tenantDashboardUrl(tenants[0].slug) : '/dashboard';
    } catch {
      return '/dashboard';
    }
  }

  private async loadContext(): Promise<AccessContext> {
    const context = await firstValueFrom(this.http.get<AccessContext>('/access-control/context'));
    this.context.set(context);
    this.i18n.applyProfileLocale(context.preferred_locale);
    return context;
  }
}
