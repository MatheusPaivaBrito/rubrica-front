import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';

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
        <button class="button" [disabled]="form.invalid || loading()">{{ loading() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
    </section></main>
  `,
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);

  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly feedback: FeedbackService) {}

  async submit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard');
    } catch { await this.feedback.error('E-mail ou senha incorretos.', 'Não foi possível entrar'); }
    finally { this.loading.set(false); }
  }
}
