import { Routes } from '@angular/router';

import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { AccountPageComponent } from './pages/account-page.component';
import { LandingPageComponent } from './pages/landing-page.component';
import { LegalPageComponent } from './pages/legal-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPageComponent },
  { path: 'contato', component: LegalPageComponent, data: { page: 'contato' } },
  { path: 'privacidade', component: LegalPageComponent, data: { page: 'privacidade' } },
  { path: 'termos', component: LegalPageComponent, data: { page: 'termos' } },
  { path: 'exclusao-de-dados', component: LegalPageComponent, data: { page: 'exclusao-de-dados' } },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: AccountPageComponent },
  { path: 'forgot-password', component: AccountPageComponent },
  { path: 'reset-password', component: AccountPageComponent },
  { path: 'verify-email', component: AccountPageComponent },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'tenant/:tenantSlug/dashboard', component: DashboardPageComponent },
  { path: 'security', loadComponent: () => import('./pages/security-page.component').then(module => module.SecurityPageComponent) },
  { path: 'plan', loadComponent: () => import('./pages/billing-page.component').then(module => module.BillingPageComponent) },
  { path: 'signing/:token', loadComponent: () => import('./pages/signing-page.component').then(module => module.SigningPageComponent) },
  { path: '**', redirectTo: '' },
];
