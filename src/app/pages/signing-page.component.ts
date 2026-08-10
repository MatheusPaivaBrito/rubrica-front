import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { SigningContext } from '../core/models';

@Component({
  standalone: true,
  template: `
    <main class="signing-layout"><section class="card signing-card">
      <p class="eyebrow">Rubrica · assinatura segura</p>
      @if (loading()) { <h1>Carregando convite…</h1> }
      @else if (error()) { <h1>Não foi possível abrir este convite</h1><p class="error">{{ error() }}</p><button class="button" (click)="login()">Entrar</button> }
      @else if (context()) { <h1>Olá, {{ context()!.signer.name }}</h1><p class="muted">Você está prestes a assinar este documento.</p><div class="document"><strong>{{ context()!.document_title }}</strong><p class="muted">{{ context()!.original_filename }}</p><button class="button secondary" (click)="download()">Baixar documento</button></div><p class="notice">Ao confirmar, registraremos sua identidade, data e o hash desta versão do documento.</p>@if (message()) { <p class="notice">{{ message() }}</p> }<div class="button-row"><button class="button" [disabled]="signing() || completed()" (click)="sign()">{{ signing() ? 'Assinando…' : 'Assinar documento' }}</button><button class="button secondary" [disabled]="signing() || completed()" (click)="decline()">Recusar</button></div> }
    </section></main>
  `,
})
export class SigningPageComponent implements OnInit {
  readonly context = signal<SigningContext | null>(null);
  readonly loading = signal(true);
  readonly signing = signal(false);
  readonly completed = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  private token = '';

  constructor(private readonly auth: AuthService, private readonly api: ApiService, private readonly route: ActivatedRoute, private readonly router: Router) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!await this.auth.restore()) { await this.login(); return; }
    try { this.context.set(await firstValueFrom(this.api.get<SigningContext>(`/signing/${this.token}`))); }
    catch (error: any) { this.error.set(error?.error?.detail || 'Convite inválido ou indisponível.'); }
    finally { this.loading.set(false); }
  }

  async login(): Promise<void> { await this.router.navigate(['/login'], { queryParams: { returnUrl: `/signing/${this.token}` } }); }
  download(): void { const item = this.context(); if (item) window.open(`/documents/${item.request.document_id}/download?version=${item.request.document_version}`, '_blank', 'noopener'); }

  async sign(): Promise<void> { await this.answer('/sign', { consent: true }); }
  async decline(): Promise<void> { await this.answer('/decline', {}); }
  private async answer(action: string, body: unknown): Promise<void> {
    this.signing.set(true); this.error.set(''); this.message.set('');
    try { await firstValueFrom(this.api.post(`/signing/${this.token}${action}`, body)); this.completed.set(true); this.message.set(action === '/sign' ? 'Assinatura concluída com sucesso.' : 'Assinatura recusada.'); }
    catch (error: any) { this.error.set(error?.error?.detail || 'Não foi possível concluir sua resposta.'); }
    finally { this.signing.set(false); }
  }
}
