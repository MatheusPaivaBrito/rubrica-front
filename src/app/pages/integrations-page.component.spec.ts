import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { IntegrationsPageComponent } from './integrations-page.component';
import { TenantItem } from '../core/models';

describe('IntegrationsPageComponent', () => {
  it('disables an integration only after confirmation and erases displayed secrets', async () => {
    const calls: unknown[] = [];
    const page = component({ patch: (_path: string, body: unknown) => { calls.push(body); return of({ id: 'integration', enabled: false }); } });
    page.tenant.set({ id: 'tenant' } as TenantItem);
    page.selected.set({ id: 'integration', name: 'ERP', enabled: true, environment: 'staging', sandbox: true });
    page.secret.set('sensitive');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try { await page.setEnabled(false); expect(calls).toEqual([{ enabled: false }]); expect(page.secret()).toBe(''); expect(page.selected()?.enabled).toBe(false); }
    finally { confirm.mockRestore(); }
  });
  it('does not reconcile while an integration is disabled', async () => {
    const calls: string[] = [];
    const page = component({ post: (path: string) => { calls.push(path); return of({}); } });
    page.selected.set({ id: 'integration', name: 'ERP', enabled: false, environment: 'staging', sandbox: false });
    await page.reconcile('operation'); expect(calls).toHaveLength(0);
  });
  function component(api: object = { post: () => of({ token: 'secret' }) }) {
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api },
      { provide: AuthService, useValue: {} },
      { provide: FeedbackService, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: ActivatedRoute, useValue: {} },
    ] });
    return TestBed.runInInjectionContext(() => new IntegrationsPageComponent());
  }
  it('starts with upload-only permissions', () => {
    const page = component();
    expect([...page.permissions()]).toEqual(['documents:create']);
  });
  it('erases the displayed secret on navigation/destruction', () => {
    const page = component();
    page.secret.set('confidential');
    page.timestampSecret = 'timestamp-secret';
    page.serproClientSecret = 'oauth-secret';
    page.ngOnDestroy();
    expect(page.secret()).toBe('');
    expect(page.timestampSecret).toBe('');
    expect(page.serproClientSecret).toBe('');
  });
  it('changes permissions explicitly', () => {
    const page = component();
    page.toggle('usage:read');
    expect(page.permissions().has('usage:read')).toBe(true);
    page.toggle('documents:create');
    expect(page.permissions().has('documents:create')).toBe(false);
  });
  it('keeps canonical consumption available when telemetry is unavailable', async () => {
    const page = component({ get: (url: string) => of(url.endsWith('/telemetry')
      ? { available: false }
      : { totals: { signatures: 3, amount_minor: 0 }, tokens: [], storage_bytes: 100 }) });
    page.tenant.set({ id: 'tenant' } as TenantItem);
    page.selected.set({ id: 'integration', name: 'ERP', sandbox: true, environment: 'development', enabled: true });
    await page.refreshUsage();
    expect(page.usage()?.totals.signatures).toBe(3);
    expect(page.telemetry()?.available).toBe(false);
    expect(page.busy()).toBe(false);
  });
});
