import { Routes } from '@angular/router';

import { LoginPageComponent } from './pages/login-page.component';
import { AccountPageComponent } from './pages/account-page.component';
import { LandingPageComponent } from './pages/landing-page.component';
import { LegalPageComponent } from './pages/legal-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPageComponent },
  { path: 'contact', component: LegalPageComponent, data: { page: 'contact' } },
  { path: 'enterprise', component: LegalPageComponent, data: { page: 'enterprise' } },
  { path: 'privacy', component: LegalPageComponent, data: { page: 'privacy' } },
  { path: 'terms', component: LegalPageComponent, data: { page: 'terms' } },
  { path: 'data-deletion', component: LegalPageComponent, data: { page: 'data-deletion' } },
  { path: 'contato', pathMatch: 'full', redirectTo: 'contact' },
  { path: 'privacidade', pathMatch: 'full', redirectTo: 'privacy' },
  { path: 'termos', pathMatch: 'full', redirectTo: 'terms' },
  { path: 'exclusao-de-dados', pathMatch: 'full', redirectTo: 'data-deletion' },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: AccountPageComponent },
  { path: 'forgot-password', component: AccountPageComponent },
  { path: 'reset-password', component: AccountPageComponent },
  { path: 'verify-email', component: AccountPageComponent },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard-page.component').then(module => module.DashboardPageComponent) },
  { path: 'tenant/:tenantSlug/dashboard', loadComponent: () => import('./pages/dashboard-page.component').then(module => module.DashboardPageComponent) },
  { path: 'security', loadComponent: () => import('./pages/security-page.component').then(module => module.SecurityPageComponent) },
  { path: 'plan', loadComponent: () => import('./pages/billing-page.component').then(module => module.BillingPageComponent) },
  { path: 'signing/:token', loadComponent: () => import('./pages/signing-page.component').then(module => module.SigningPageComponent) },
  { path: '**', redirectTo: '' },
];
