import { routes } from './app.routes';

describe('public routes', () => {
  it('uses English canonical paths', () => {
    for (const path of ['contact', 'privacy', 'terms', 'data-deletion']) {
      const route = routes.find(candidate => candidate.path === path);
      expect(route?.component).toBeTruthy();
    }
  });

  it('redirects the former Portuguese paths', () => {
    expect(routes.find(route => route.path === 'contato')?.redirectTo).toBe('contact');
    expect(routes.find(route => route.path === 'privacidade')?.redirectTo).toBe('privacy');
    expect(routes.find(route => route.path === 'termos')?.redirectTo).toBe('terms');
    expect(routes.find(route => route.path === 'exclusao-de-dados')?.redirectTo).toBe('data-deletion');
  });

  it('exposes canonical personal and business account routes', () => {
    expect(routes.some(route => route.path === 'a/:accountSlug/dashboard')).toBe(true);
    expect(routes.some(route => route.path === 't/:tenantSlug/a/:accountSlug/dashboard')).toBe(true);
  });
});
