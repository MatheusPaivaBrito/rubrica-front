import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { accessTokenKey } from './api-auth.interceptor';

export interface AccessContext {
  version: number;
  subject: string;
  preferred_locale: 'pt-BR' | 'en' | 'ja-JP';
  mfa_enabled: boolean;
  mfa_setup_required: boolean;
  roles: string[];
  permission_keys: string[];
}

interface LoginResponse { access_token: string; refresh_token: string; }
export interface MfaChallenge { mfa_required: true; mfa_ticket: string; expires_in: number; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly context = signal<AccessContext | null>(null);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly http: HttpClient) {}

  async login(email: string, password: string): Promise<AccessContext | MfaChallenge> {
    const response = await firstValueFrom(this.http.post<LoginResponse | MfaChallenge>('/auth/login', { email, password }));
    if ('mfa_required' in response) return response;
    sessionStorage.setItem(accessTokenKey, response.access_token);
    return this.loadContext();
  }

  async completeMfa(mfaTicket: string, code: string): Promise<AccessContext> {
    const response = await firstValueFrom(this.http.post<LoginResponse>('/auth/mfa/challenge', {
      mfa_ticket: mfaTicket,
      code,
    }));
    sessionStorage.setItem(accessTokenKey, response.access_token);
    return this.loadContext();
  }

  async restore(): Promise<AccessContext | null> {
    if (!this.browser) return null;
    if (!sessionStorage.getItem(accessTokenKey)) {
      try {
        const response = await firstValueFrom(this.http.post<LoginResponse>('/auth/refresh', {}));
        sessionStorage.setItem(accessTokenKey, response.access_token);
      } catch { return null; }
    }
    try { return await this.loadContext(); }
    catch { sessionStorage.removeItem(accessTokenKey); return null; }
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post('/auth/logout', {})); }
    finally {
      if (this.browser) sessionStorage.removeItem(accessTokenKey);
      this.context.set(null);
    }
  }

  can(permission: string): boolean {
    const permissions = this.context()?.permission_keys ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  refreshContext(): Promise<AccessContext> { return this.loadContext(); }

  private async loadContext(): Promise<AccessContext> {
    const context = await firstValueFrom(this.http.get<AccessContext>('/access-control/context'));
    this.context.set(context);
    return context;
  }
}
