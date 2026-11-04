import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { EnterpriseStorageComponent } from './enterprise-storage.component';

describe('EnterpriseStorageComponent', () => {
  function setup(overrides: object = {}) {
    const calls: { path: string; body: unknown }[] = [];
    const api = { get: () => of([]), post: (path: string, body: unknown) => { calls.push({ path, body }); return of({ id: 'destination' }); }, ...overrides };
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: FeedbackService, useValue: { error: () => Promise.resolve() } },
    ] });
    const component = TestBed.runInInjectionContext(() => new EnterpriseStorageComponent());
    component.tenantId = 'tenant'; component.integrationId = 'integration';
    return { component, calls };
  }
  it('requires explicit export acknowledgement', async () => {
    const { component, calls } = setup(); component.destinationId = 'destination';
    await component.migrate(); expect(calls).toHaveLength(0);
  });
  it('never allows an external destination in sandbox', async () => {
    const { component, calls } = setup(); component.kind = 's3'; component.name = 'Bucket';
    await component.createDestination(); expect(calls).toHaveLength(0);
  });
  it('clears credentials immediately after submitting even if the request fails', async () => {
    const { component } = setup({ post: () => throwError(() => new Error('unavailable')) });
    component.sandbox = false; component.kind = 's3'; component.accessKey = 'key'; component.secretKey = 'secret';
    await component.createDestination();
    expect(component.accessKey).toBe(''); expect(component.secretKey).toBe(''); expect(component.busy()).toBe(false);
  });
  it('sends credentials only to the tenant endpoint and clears on destruction', async () => {
    const { component, calls } = setup(); component.sandbox = false; component.kind = 's3';
    component.name = 'Customer'; component.accessKey = 'key'; component.secretKey = 'secret';
    await component.createDestination();
    expect(calls[0].path).toBe('/enterprise/tenants/tenant/storage/destinations?sandbox=false');
    expect(calls[0].body).toMatchObject({ configuration: { access_key_id: 'key', secret_access_key: 'secret' } });
    component.secretKey = 'again'; component.ngOnDestroy(); expect(component.secretKey).toBe('');
  });
  it('ignores responses from an integration that has been left', async () => {
    const pending = new Subject<unknown>();
    const { component } = setup({ get: () => pending });
    const refreshing = component.refresh(); component.ngOnDestroy();
    pending.next([{ id: 'old-destination' }]); pending.complete(); await refreshing;
    expect(component.destinations()).toEqual([]); expect(component.calculator()).toBe(null);
  });
  it('requires a local download before acknowledging durable delivery', async () => {
    const { component, calls } = setup();
    await component.acknowledge({ id: 'item', kind: 'original', sha256: 'hash', size_bytes: 1, status: 'awaiting_delivery' });
    expect(calls).toHaveLength(0);
  });
  it('resumes the last migration after returning to the panel', async () => {
    const { component } = setup({ get: (path: string) => of(path.endsWith('/migrations') ? [{ id: 'job' }]
      : path.endsWith('/job') ? { id: 'job', status: 'pending', items: [], documents: [], total_count: 0, verified_count: 0 } : []) });
    await component.refresh(); expect(component.migration()?.id).toBe('job');
  });
  it('uses decimal GB and describes pending signatures', () => {
    const { component } = setup();
    expect(component.gb(1_000_000_000)).toBe('1');
    expect(component.status('waiting_signature')).toBe('Aguardando encerramento da assinatura');
  });
  it('never enables a receipt when the downloaded bytes have the wrong hash', async () => {
    const { component } = setup({ getBlob: () => of({ body: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } }) });
    const hashing = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    component.migration.set({ id: 'job', status: 'pending', verified_count: 0, total_count: 1, documents: [], items: [] });
    try {
      await component.download({ id: 'item', kind: 'original', sha256: 'f'.repeat(64), size_bytes: 3, status: 'awaiting_delivery' });
      expect(component.downloaded.has('item')).toBe(false);
      expect(component.busy()).toBe(false);
    } finally { hashing.mockRestore(); }
  });
  it('requires a migration scope when both selections are empty', async () => {
    const { component, calls } = setup();
    component.acknowledged = true; component.destinationId = 'destination'; component.includeExisting = false;
    await component.migrate(); expect(calls).toHaveLength(0);
  });
  it('confirms an already downloaded item with the exact hash and byte count', async () => {
    const { component, calls } = setup();
    component.migration.set({ id: 'job', status: 'pending', verified_count: 0, total_count: 1, documents: [], items: [] });
    component.downloaded.add('item');
    await component.acknowledge({ id: 'item', kind: 'original', sha256: 'a'.repeat(64), size_bytes: 123, status: 'awaiting_delivery' });
    expect(calls[0].path).toBe('/enterprise/tenants/tenant/storage/integrations/integration/migrations/job/items/item/acknowledge');
    expect(calls[0].body).toEqual({ sha256: 'a'.repeat(64), size_bytes: 123, durable_storage_confirmed: true });
  });
  function completed(component: EnterpriseStorageComponent, kind = 's3') {
    component.migration.set({ id: 'job', status: 'completed', destination_kind: kind, total_count: 1, verified_count: 1,
      documents: [{ document_id: 'document', status: 'verified' }], items: [], removals: [] });
  }
  it('requires a new explicit confirmation before requesting removal', async () => {
    const { component, calls } = setup(); completed(component);
    await component.removeCopies('document'); expect(calls).toHaveLength(0);
  });
  it('requires an additional warning acknowledgement for independent storage', async () => {
    const { component, calls } = setup(); completed(component, 'independent'); component.removalConfirmed = true;
    await component.removeCopies('document'); expect(calls).toHaveLength(0);
  });
  it('schedules removal only for the selected document and clears the confirmation', async () => {
    const { component, calls } = setup(); completed(component); component.removalConfirmed = true;
    await component.removeCopies('document');
    expect(calls[0].path).toBe('/enterprise/tenants/tenant/storage/integrations/integration/migrations/job/remove-copies');
    expect(calls[0].body).toEqual({ document_ids: ['document'], confirm_remove_rubrica_copies: true, acknowledge_independent_unavailability: false });
    expect(component.removalConfirmed).toBe(false);
  });
  it('prevents duplicate removal and restoration while the worker is retrying', async () => {
    const { component, calls } = setup(); completed(component); component.removalConfirmed = true;
    component.migration.update(job => ({ ...job!, removals: [{ id: 'removal', document_id: 'document', status: 'retry' }] }));
    expect(component.pendingRemoval('document')).toBe(true);
    await component.removeCopies('document'); await component.restoreCopies('document'); expect(calls).toHaveLength(0);
  });
  it('restores S3 copies through the scoped endpoint', async () => {
    const { component, calls } = setup(); completed(component);
    await component.restoreCopies('document');
    expect(calls[0].path).toBe('/enterprise/tenants/tenant/storage/integrations/integration/migrations/job/restore-copies');
    expect(calls[0].body).toEqual({ document_ids: ['document'] });
  });
  it('does not offer direct restoration from an independent destination', async () => {
    const { component, calls } = setup(); completed(component, 'independent');
    await component.restoreCopies('document'); expect(calls).toHaveLength(0);
  });
  it('clears destructive confirmations after switching migration', async () => {
    const { component } = setup({ get: () => of({ id: 'another' }) });
    component.removalConfirmed = true; component.independentRemovalConfirmed = true;
    await component.selectMigration('another');
    expect(component.removalConfirmed).toBe(false); expect(component.independentRemovalConfirmed).toBe(false);
  });
});
