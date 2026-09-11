import { Routes } from '@angular/router';

import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { AccountPageComponent } from './pages/account-page.component';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: AccountPageComponent },
  { path: 'forgot-password', component: AccountPageComponent },
  { path: 'reset-password', component: AccountPageComponent },
  { path: 'verify-email', component: AccountPageComponent },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'security', loadComponent: () => import('./pages/security-page.component').then(module => module.SecurityPageComponent) },
  { path: 'plan', loadComponent: () => import('./pages/billing-page.component').then(module => module.BillingPageComponent) },
  { path: 'signing/:token', loadComponent: () => import('./pages/signing-page.component').then(module => module.SigningPageComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
