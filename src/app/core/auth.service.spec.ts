import { describe, expect, it } from 'vitest';

import { tenantDashboardUrl } from './auth.service';

describe('tenantDashboardUrl', () => {
  it('uses the compact account route for generated account slugs', () => {
    expect(tenantDashboardUrl('account-d3442cf6ca6b3ac10233')).toBe(
      '/tenant/a/d3442cf6ca6b3ac10233/dashboard',
    );
  });

  it('preserves the legacy route for custom tenant slugs', () => {
    expect(tenantDashboardUrl('legal-team')).toBe('/tenant/legal-team/dashboard');
  });
});
