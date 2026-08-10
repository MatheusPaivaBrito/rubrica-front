import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { accessTokenKey } from './api-auth.interceptor';

export interface AccessContext {
  subject: string;
  roles: string[];
  permission_keys: string[];
}

interface LoginResponse { access_token: string; refresh_token: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly context = signal<AccessContext | null>(null);

  constructor(private readonly http: HttpClient) {}

  async login(email: string, password: string): Promise<AccessContext> {
    const response = await firstValueFrom(this.http.post<LoginResponse>('/auth/login', { email, password }));
    sessionStorage.setItem(accessTokenKey, response.access_token);
    return this.loadContext();
  }

  async restore(): Promise<AccessContext | null> {
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
    finally { sessionStorage.removeItem(accessTokenKey); this.context.set(null); }
  }

  can(permission: string): boolean {
    const permissions = this.context()?.permission_keys ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  private async loadContext(): Promise<AccessContext> {
    const context = await firstValueFrom(this.http.get<AccessContext>('/access-control/context'));
    this.context.set(context);
    return context;
  }
}
