import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-layout"><section class="card auth-card">
      <p class="eyebrow">Rubrica</p>
      <h1>{{ title() }}</h1>
      @if (mode === 'register') {
        <form class="form" (ngSubmit)="register()">
          <label>Nome <input name="name" [(ngModel)]="name" required /></label>
          <label>E-mail <input name="email" type="email" [(ngModel)]="email" required /></label>
          <label>Senha <input name="password" type="password" [(ngModel)]="password" minlength="8" required /></label>
          <label>País do documento <select name="country" [(ngModel)]="country"><option value="">Não informar agora</option><option value="BR">Brasil</option><option value="JP">Japão</option><option value="PT">Portugal</option></select></label>
          @if (country) {
            <label>Tipo <select name="type" [(ngModel)]="documentType"><option value="passport">Passaporte</option><option value="national_id">Documento nacional</option><option value="residence_card">Residence Card</option><option value="tax_id">Identificação fiscal</option></select></label>
            <label>Número <input name="document" [(ngModel)]="documentValue" required /></label>
          }
          <button class="button">Criar conta</button>
        </form>
      } @else if (mode === 'forgot-password') {
        <form class="form" (ngSubmit)="requestReset()"><label>E-mail <input name="email" type="email" [(ngModel)]="email" required /></label><button class="button">Enviar recuperação</button></form>
      } @else if (mode === 'reset-password') {
        <form class="form" (ngSubmit)="resetPassword()"><label>Nova senha <input name="password" type="password" [(ngModel)]="password" minlength="8" required /></label><button class="button">Alterar senha</button></form>
      } @else { <p>Processando confirmação de e-mail…</p> }
      <p><a routerLink="/login">Voltar ao login</a></p>
    </section></main>
  `,
})
export class AccountPageComponent implements OnInit {
  readonly title = signal('');
  mode = '';
  name = ''; email = ''; password = ''; country = ''; documentType = 'passport'; documentValue = '';
  private token = '';

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService, private readonly feedback: FeedbackService) {}

  async ngOnInit(): Promise<void> {
    this.mode = this.route.snapshot.routeConfig?.path ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.title.set({ register: 'Criar conta', 'forgot-password': 'Recuperar senha', 'reset-password': 'Nova senha', 'verify-email': 'Confirmar e-mail' }[this.mode] ?? 'Conta');
    if (this.mode === 'verify-email') await this.action('/auth/verify-email', { token: this.token }, 'E-mail confirmado.');
  }

  register() { return this.action('/auth/register', { name: this.name, email: this.email, password: this.password, preferred_locale: navigator.language, identity_document_type: this.country ? this.documentType : null, identity_document_country: this.country || null, identity_document_value: this.country ? this.documentValue : null }, 'Confira seu e-mail para confirmar a conta.'); }
  requestReset() { return this.action('/auth/password-recovery', { email: this.email }, 'Se a conta existir, enviaremos as instruções.'); }
  resetPassword() { return this.action('/auth/password-reset', { token: this.token, new_password: this.password }, 'Senha alterada.'); }
  private async action(path: string, body: unknown, message: string) {
    try { await firstValueFrom(this.api.post(path, body)); await this.feedback.success(message); }
    catch { await this.feedback.error('Revise os dados e tente novamente.'); }
  }
}
