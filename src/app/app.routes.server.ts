import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'data-deletion', renderMode: RenderMode.Prerender },
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenant/:tenantSlug/dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'signing/:token',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
