import { describe, expect, it } from 'vitest';

import { tenantDashboardUrl } from './auth.service';

describe('tenantDashboardUrl', () => {
  it('uses the compact account route for personal tenants', () => {
    expect(tenantDashboardUrl({ slug: 'tenant-public', kind: 'personal' }, 'account-public')).toBe(
      '/a/account-public/dashboard',
    );
  });

  it('includes both opaque slugs for business tenants', () => {
    expect(tenantDashboardUrl({ slug: 'tenant-public', kind: 'business' }, 'account-public')).toBe('/t/tenant-public/a/account-public/dashboard');
  });
});
