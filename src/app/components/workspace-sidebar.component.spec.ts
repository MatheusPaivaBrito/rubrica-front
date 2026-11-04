import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { TenantItem } from '../core/models';
import { WorkspaceSidebarComponent } from './workspace-sidebar.component';

describe('WorkspaceSidebarComponent enterprise recovery', () => {
  async function sidebar(product: string, role: string, recovery: boolean) {
    const paths: string[] = [];
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: { get: (path: string) => { paths.push(path); return of(path.endsWith('/contract') ? { recovery } : { status: 'active', current_product_code: product }); } } },
      { provide: AuthService, useValue: {} }, { provide: I18nService, useValue: {} }, { provide: Router, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new WorkspaceSidebarComponent());
    component.tenant = { id: 'tenant', role } as TenantItem; await component.ngOnChanges(); return { component, paths };
  }
  it('keeps the recovery area discoverable after a downgrade', async () => {
    const { component } = await sidebar('rubrica_team', 'admin', true); expect(component.showIntegrations()).toBe(true);
  });
  it('does not expose the recovery link to ordinary team members', async () => {
    const { component, paths } = await sidebar('rubrica_team', 'member', true);
    expect(component.showIntegrations()).toBe(false); expect(paths).toHaveLength(1);
  });
  it('does not grant enterprise navigation to a team without a recovery contract', async () => {
    const { component } = await sidebar('rubrica_team', 'admin', false); expect(component.showIntegrations()).toBe(false);
  });
});
