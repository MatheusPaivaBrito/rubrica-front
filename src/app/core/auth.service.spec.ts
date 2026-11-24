import { describe, expect, it } from 'vitest';

import { accountLandingUrl, tenantDashboardUrl } from './auth.service';

describe('tenantDashboardUrl', () => {
  it('uses the compact account route for personal tenants', () => {
    expect(tenantDashboardUrl({ slug: 'tenant-public', kind: 'personal' }, 'account-public')).toBe(
      '/a/account-public/dashboard',
    );
  });

  it('includes both opaque slugs for business tenants', () => {
    expect(tenantDashboardUrl({ slug: 'tenant-public', kind: 'business' }, 'account-public')).toBe('/t/tenant-public/a/account-public/dashboard');
  });

  it('sends an account without active tenants to reactivation', () => {
    expect(accountLandingUrl([], 'account-public')).toBe('/reactivate-account');
  });
});


it('opens the only selectable workspace even if an ineligible workspace is listed first', () => {
  const business = { id: 'business', slug: 'office', name: 'Office', kind: 'business' as const, role: 'member', currency: 'BRL', workspace_selectable: false };
  const personal = { id: 'personal', slug: 'me', name: 'Personal', kind: 'personal' as const, role: 'admin', currency: 'BRL', workspace_selectable: true };
  expect(accountLandingUrl([business, personal], 'account-public')).toBe('/a/account-public/dashboard');
});
