import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <p class="eyebrow">Rubrica</p><h1>Entre para assinar</h1>
      <p class="muted">Use sua conta para acessar documentos e convites de assinatura.</p>
      <form class="form" (ngSubmit)="submit()" #form="ngForm">
        <label>E-mail <input name="email" type="email" [(ngModel)]="email" required autocomplete="email" /></label>
        <label>Senha <input name="password" type="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button class="button" [disabled]="form.invalid || loading()">{{ loading() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
    </section></main>
  `,
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute) {}

  async submit(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard');
    } catch { this.error.set('Não foi possível entrar. Confira e-mail e senha.'); }
    finally { this.loading.set(false); }
  }
}
