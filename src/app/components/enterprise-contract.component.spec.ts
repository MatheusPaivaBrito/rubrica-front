import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { EnterpriseContract, EnterpriseContractComponent } from './enterprise-contract.component';

const active: EnterpriseContract = { status: 'active', operational: true, recovery: false, suspends_at: null, delete_after: null,
  automatic_current_copy_purge_enabled: false, internal_retention_complete: false, notices: [] };

describe('EnterpriseContractComponent', () => {
  it('does not reopen without complete closure permission', async () => {
    const { component, calls } = setup(); component.contract.set(active);
    await component.reopen(); expect(calls).toHaveLength(0);
  });
  it('requires explicit confirmation before starting a new empty contract', async () => {
    const { component, calls } = setup(); component.contract.set({ ...active, recontract_allowed: true, closure_id: 'closure' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try { await component.reopen(); expect(calls).toHaveLength(0); } finally { confirm.mockRestore(); }
  });
  it('binds reopening to the server closure receipt', async () => {
    const { component, calls } = setup(); component.contract.set({ ...active, recontract_allowed: true, closure_id: 'closure' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      await component.reopen();
      expect(calls[0]).toEqual({ method: 'POST', path: '/enterprise/tenants/tenant/contract/reopen', body: { confirm_empty_contract: true, closure_id: 'closure' } });
    } finally { confirm.mockRestore(); }
  });
  function setup(overrides: object = {}) {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const api = { get: (path: string) => of(path.endsWith('/contract') ? active : path.endsWith('/webhook') ? { configured: false, deliveries: [] } : []),
      put: (path: string, body: unknown) => { calls.push({ method: 'PUT', path, body }); return of({ secret: 'new-secret' }); },
      post: (path: string, body: unknown) => { calls.push({ method: 'POST', path, body }); return of({}); },
      delete: (path: string) => { calls.push({ method: 'DELETE', path }); return of(null); }, ...overrides };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, { provide: FeedbackService, useValue: { error: () => Promise.resolve() } }] });
    const component = TestBed.runInInjectionContext(() => new EnterpriseContractComponent());
    component.tenantId = 'tenant'; component.integrationId = 'integration';
    return { component, calls };
  }
  it('emits the canonical contract status to gate operational controls', async () => {
    const { component } = setup(); const states: EnterpriseContract[] = [];
    component.stateChange.subscribe(state => states.push(state));
    await component.refresh(); expect(states).toEqual([active]); expect(component.contract()?.operational).toBe(true);
  });
  it('does not permit webhook rotation while operations are suspended', async () => {
    const { component, calls } = setup(); component.contract.set({ ...active, operational: false, recovery: true });
    await component.configure(); expect(calls).toHaveLength(0);
  });
  it('displays a new secret only after a scoped configuration request', async () => {
    const { component, calls } = setup(); component.contract.set(active); component.url = 'https://customer.example/webhook';
    await component.configure();
    expect(calls[0]).toEqual({ method: 'PUT', path: '/enterprise/tenants/tenant/integrations/integration/webhook', body: { url: 'https://customer.example/webhook' } });
    expect(component.secret()).toBe('new-secret');
  });
  it('clears the secret when leaving the integration', () => {
    const { component } = setup(); component.secret.set('sensitive'); component.ngOnDestroy(); expect(component.secret()).toBe('');
  });
  it('ignores stale responses from another integration', async () => {
    const pending = new Subject<EnterpriseContract>(); const { component } = setup({ get: () => pending });
    const loading = component.refresh(); component.ngOnDestroy(); pending.next(active); pending.complete(); await loading;
    expect(component.contract()).toBe(null);
  });
  it('does not cancel an open signature request without confirmation', async () => {
    const { component, calls } = setup(); component.contract.set({ ...active, operational: false, recovery: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try { await component.cancelRequest('request'); expect(calls).toHaveLength(0); } finally { confirm.mockRestore(); }
  });
  it('allows administrators to cancel pending requests during recovery', async () => {
    const { component, calls } = setup(); component.contract.set({ ...active, operational: false, recovery: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try { await component.cancelRequest('request'); expect(calls[0].path).toBe('/enterprise/tenants/tenant/integrations/integration/recovery-requests/request/cancel'); }
    finally { confirm.mockRestore(); }
  });
  it('replays a delivery through its original ID', async () => {
    const { component, calls } = setup(); await component.replay('delivery');
    expect(calls[0].path).toBe('/enterprise/tenants/tenant/integrations/integration/webhook/deliveries/delivery/replay');
  });
  it('erases a previously displayed secret if another configuration fails', async () => {
    const { component } = setup({ put: () => throwError(() => new Error('unavailable')) });
    component.contract.set(active); component.secret.set('old'); await component.configure();
    expect(component.secret()).toBe(''); expect(component.busy()).toBe(false);
  });
  it('shows contract notices in user-facing Portuguese and handles absent dates', () => {
    const { component } = setup(); expect(component.noticeLabel('contract.suspended')).toBe('Acesso suspenso'); expect(component.date(null)).toBe('—');
  });
});
