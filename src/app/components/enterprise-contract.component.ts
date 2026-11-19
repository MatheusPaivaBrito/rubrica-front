import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';

export interface EnterpriseContract { status: string; operational: boolean; recovery: boolean; suspends_at: string | null; delete_after: string | null; cycle_end?: string; automatic_current_copy_purge_enabled: boolean; internal_retention_complete: boolean; notices: { id: string; kind: string; email_delivered: boolean }[] }
interface WebhookState { configured: boolean; url?: string; enabled?: boolean; version?: number; deliveries: { id: string; event_id: string; status: string; attempts: number }[] }
interface PendingRequest { id: string; document_id: string; status: string }

@Component({ selector: 'app-enterprise-contract', standalone: true, imports: [FormsModule],
  template: `<article class="card contract-panel"><h2>Contrato da API</h2>
    @if (contract(); as state) {
      <p><strong>{{ state.operational ? 'Acesso operacional disponível' : state.recovery ? 'Prazo para retirar seus arquivos' : 'Operações suspensas' }}</strong></p>
      @if (state.cycle_end) { <p>Próximo corte do ciclo: {{ date(state.cycle_end) }}</p> }
      @if (state.suspends_at) { <p>Suspensão: {{ date(state.suspends_at) }} · Prazo para retirada: {{ date(state.delete_after) }}</p> }
      @if (!state.operational) { <p class="notice">Tokens e novas assinaturas estão bloqueados. Durante a recuperação, o administrador pode exportar ou migrar os arquivos. A migração não estende o prazo. Regularize antes da data limite para recuperar o acesso; depois dela, a recuperação dos dados não é garantida.</p> }
      @if (!state.automatic_current_copy_purge_enabled || !state.internal_retention_complete) { <p class="notice">A política completa de expurgo ainda não está validada neste ambiente. O prazo do contrato continua em vigor; a confirmação da limpeza deve ser acompanhada pelo operador.</p> }
      @for (notice of state.notices; track notice.id) { <p class="muted">{{ noticeLabel(notice.kind) }} · E-mail {{ notice.email_delivered ? 'enviado' : 'pendente' }}</p> }
      @if (state.recovery && requests().length) {
        <h3>Assinaturas que impedem a migração</h3><p>Encerre as solicitações abertas para migrar esses documentos. Assinaturas já concluídas serão preservadas.</p>
        @for (request of requests(); track request.id) { <div class="pending"><code>{{ request.document_id }}</code><button class="button secondary" [disabled]="busy()" (click)="cancelRequest(request.id)">Cancelar solicitação {{ request.id }}</button></div> }
      }
    }
    @if (integrationId && webhook(); as endpoint) {
      <h3>Webhooks da integração</h3><p class="muted">Entrega pode repetir e chegar fora de ordem. Valide o HMAC dos bytes recebidos, aceite timestamps recentes (até 5 minutos) e deduplique pelo ID do evento.</p>
      @if (contract()?.operational) {
        <form (ngSubmit)="configure()" class="form"><label>Destino HTTPS<input name="webhookUrl" type="url" [(ngModel)]="url" maxlength="2048" required placeholder="https://sua-plataforma/webhook" /></label><p class="muted">O hostname precisa estar autorizado pelo operador. Desative o destino antes de trocar sua URL.</p><button class="button secondary" [disabled]="busy() || !url.trim()">Salvar destino / gerar novo segredo</button></form>
      }
      @if (endpoint.configured) { <p>{{ endpoint.url }} · {{ endpoint.enabled ? 'Ativo' : 'Desativado' }} · versão {{ endpoint.version }}</p><button class="button secondary" [disabled]="busy() || !endpoint.enabled" (click)="disable()">Desativar webhook</button> }
      @if (secret()) { <section class="notice"><p>Copie agora. Este segredo não pode ser recuperado. A rotação exige atualizar seu receptor.</p><textarea readonly [value]="secret()" aria-label="Novo segredo HMAC" autocomplete="off" spellcheck="false"></textarea><button class="button secondary" (click)="secret.set('')">Ocultar segredo</button></section> }
      @for (delivery of endpoint.deliveries; track delivery.id) { <p><code>{{ delivery.event_id }}</code> · {{ delivery.status }} · {{ delivery.attempts }} tentativa(s)</p>@if (delivery.status === 'dead' && endpoint.enabled) { <button class="button secondary" [disabled]="busy()" (click)="replay(delivery.id)">Reenviar o mesmo evento</button> } }
    }
    <button class="button secondary" (click)="refresh()" [disabled]="busy()">Atualizar contrato e entregas</button>
  </article>`,
  styles: [`.contract-panel{display:grid;gap:.8rem;margin-bottom:1rem;min-width:0}.form{display:grid;gap:.75rem}.pending{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}code,p{overflow-wrap:anywhere}textarea{width:100%;min-height:5rem}input{max-width:100%}`],
})
export class EnterpriseContractComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) tenantId = '';
  @Input() integrationId = '';
  @Output() stateChange = new EventEmitter<EnterpriseContract>();
  readonly contract = signal<EnterpriseContract | null>(null);
  readonly webhook = signal<WebhookState | null>(null);
  readonly requests = signal<PendingRequest[]>([]);
  readonly secret = signal(''); readonly busy = signal(false);
  private readonly api = inject(ApiService); private readonly feedback = inject(FeedbackService);
  private generation = 0;
  url = '';
  private base() { return `/enterprise/tenants/${this.tenantId}`; }
  private endpoint() { return `${this.base()}/integrations/${this.integrationId}/webhook`; }
  ngOnChanges() { this.generation++; this.secret.set(''); this.contract.set(null); this.webhook.set(null); this.requests.set([]); this.url = ''; void this.refresh(); }
  ngOnDestroy() { this.generation++; this.secret.set(''); }
  async refresh() {
    const generation = this.generation;
    try {
      const state = await firstValueFrom(this.api.get<EnterpriseContract>(`${this.base()}/contract`));
      if (generation !== this.generation) return;
      this.contract.set(state); this.stateChange.emit(state);
      if (!state.operational) this.secret.set('');
      if (!state.recovery) this.requests.set([]);
      if (!state.operational && !state.recovery) this.webhook.set(null);
      if (this.integrationId && (state.operational || state.recovery)) {
        const endpoint = await firstValueFrom(this.api.get<WebhookState>(this.endpoint()));
        if (generation !== this.generation) return;
        this.webhook.set(endpoint); this.url = endpoint.url ?? '';
        if (state.recovery) {
          const requests = await firstValueFrom(this.api.get<PendingRequest[]>(`${this.base()}/integrations/${this.integrationId}/recovery-requests`));
          if (generation === this.generation) this.requests.set(requests);
        }
      }
    } catch (error) { if (generation === this.generation) await this.feedback.error(error); }
  }
  private async perform(operation: () => Promise<void>) {
    if (this.busy()) return; this.busy.set(true);
    try { await operation(); } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async configure() {
    if (!this.contract()?.operational) return;
    const generation = this.generation; this.secret.set('');
    await this.perform(async () => {
      const result = await firstValueFrom(this.api.put<{ secret: string }>(this.endpoint(), { url: this.url }));
      if (generation !== this.generation) return;
      this.secret.set(result.secret); await this.refresh();
    });
  }
  async disable() { this.secret.set(''); await this.perform(async () => { await firstValueFrom(this.api.delete(this.endpoint())); await this.refresh(); }); }
  async replay(id: string) { await this.perform(async () => { await firstValueFrom(this.api.post(`${this.endpoint()}/deliveries/${id}/replay`, {})); await this.refresh(); }); }
  async cancelRequest(id: string) {
    if (!this.contract()?.recovery || !window.confirm('Cancelar esta solicitação para permitir a migração? As assinaturas concluídas serão preservadas.')) return;
    await this.perform(async () => { await firstValueFrom(this.api.post(`${this.base()}/integrations/${this.integrationId}/recovery-requests/${id}/cancel`, {})); await this.refresh(); });
  }
  date(value: string | null) { return value ? new Date(value).toLocaleString('pt-BR') : '—'; }
  noticeLabel(value: string) { return ({ 'contract.suspended': 'Acesso suspenso', 'contract.reactivated': 'Acesso regularizado',
    'contract.cycle_ending': 'Próximo encerramento do ciclo', 'contract.purge_warning': 'Prazo de retirada próximo do fim',
    'contract.current_copies_purged': 'Limpeza das cópias correntes concluída' } as Record<string, string>)[value] ?? 'Aviso do contrato'; }
}
