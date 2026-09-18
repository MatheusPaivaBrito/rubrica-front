import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'contato', renderMode: RenderMode.Prerender },
  { path: 'privacidade', renderMode: RenderMode.Prerender },
  { path: 'termos', renderMode: RenderMode.Prerender },
  { path: 'exclusao-de-dados', renderMode: RenderMode.Prerender },
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
