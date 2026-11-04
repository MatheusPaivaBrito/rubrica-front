import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService, tenantDashboardUrl } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { TenantItem } from '../core/models';
import { WorkspaceSidebarComponent } from '../components/workspace-sidebar.component';
import { EnterpriseStorageComponent } from '../components/enterprise-storage.component';
import { EnterpriseContract, EnterpriseContractComponent } from '../components/enterprise-contract.component';

interface Integration { id: string; name: string; environment: string; sandbox: boolean; enabled: boolean }
interface Compartment { id: string; name: string }
interface ProviderOperation { id: string; request_id: string; signer_id: string; status: string; error_code: string | null }
interface ProviderConfiguration { provider: string; status: string; version: number }
interface UsageTotals { signatures: number; billable_signatures: number; uploaded_bytes: number; downloaded_bytes: number; requests: number; errors: number; amount_minor: number }
interface UsageSummary { totals: UsageTotals; tokens: (UsageTotals & { token_public_id: string })[]; storage_bytes: number; tenant_storage_bytes: number; tenant_included_storage_bytes: number }
interface TelemetrySummary { available: boolean; projection?: { totals: { average_duration_ms: number | null; rate_limited: number } } }

@Component({
  standalone: true,
  imports: [FormsModule, WorkspaceSidebarComponent, EnterpriseStorageComponent, EnterpriseContractComponent],
  template: `<main class="shell"><div class="workspace-layout">
    <app-workspace-sidebar [tenant]="tenant()" />
    <section class="container dashboard-container">
      <header class="dashboard-header"><div><p class="eyebrow">Configurações</p><h1>Integrações e API</h1>
        <p class="muted">Credenciais para conectar o servidor da sua plataforma ao Rubrica.</p></div></header>
      @if (loading()) { <p role="status">Carregando…</p> }
      @else if (!available()) { <p class="notice">Disponível para administradores com contrato Empresarial ativo.</p> }
      @else {
        <app-enterprise-contract [tenantId]="tenant()!.id" [integrationId]="selected()?.id ?? ''" (stateChange)="updateContract($event)" />
        @if (contract()?.operational) {
        <form class="card form" (ngSubmit)="create()">
          <h2>Nova integração</h2><label>Nome<input name="name" [(ngModel)]="name" maxlength="160" required /></label>
          <label><input type="checkbox" name="sandbox" [(ngModel)]="sandbox" /> Ambiente de testes</label>
          <button class="button" [disabled]="busy() || !name.trim()">Criar integração</button>
        </form>
        }
        <div class="integrations-grid">
          @for (item of integrations(); track item.id) {
            <button class="card integration-choice" [class.selected]="selected()?.id === item.id" (click)="choose(item)" [disabled]="busy()">
              <strong>{{ item.name }}</strong><span>{{ item.sandbox ? 'Sandbox' : 'Produção' }} · {{ item.environment }}</span>
              <small>{{ item.id }}</small>
            </button>
          }
        </div>
        @if (selected(); as item) {
          <article class="card form"><h2>Estado da integração</h2><p>{{ item.enabled ? 'Ativa' : 'Desativada' }}</p>
            <button class="button secondary" [disabled]="busy() || (!item.enabled && !contract()?.operational)" (click)="setEnabled(!item.enabled)">{{ item.enabled ? 'Desativar integração' : 'Reativar integração' }}</button>
            <p class="muted">Desativar impede novas operações e trabalhos ainda na fila. Uma assinatura já emitida deve ser reconciliada; não é emitida novamente.</p>
            @for (operation of operations(); track operation.id) {
              <p><code>{{ operation.request_id }}</code> · {{ operation.status }} · {{ operation.error_code ?? 'sem erro registrado' }}</p>
              @if (operation.status === 'uncertain' || operation.status === 'result_ready') {
                <button class="button secondary" [disabled]="busy() || !item.enabled || !contract()?.operational" (click)="reconcile(operation.id)">Reconciliar resultado existente</button>
              }
            }
          </article>
          @if (usage(); as consumption) {
            <article class="card form"><h2>Consumo da integração</h2><p class="muted">Atividade dos últimos 30 dias. Armazenamento mostra o volume mantido agora.</p>
              @if (item.sandbox) { <p class="notice">Sandbox: dados e limites separados. Assinaturas são simuladas e não geram cobrança.</p> }
              <div class="integrations-grid"><p><strong>{{ consumption.totals.signatures }}</strong><br />Assinaturas {{ item.sandbox ? 'simuladas' : 'concluídas' }}</p>
                <p><strong>{{ formatBytes(consumption.storage_bytes) }}</strong><br />Armazenamento da integração</p>
                <p><strong>{{ consumption.totals.requests }}</strong><br />Chamadas de API · {{ consumption.totals.errors }} erros</p>
                <p><strong>R$ 0,00</strong><br />Tarifas provisórias</p></div>
              @if (!item.sandbox) { <p class="muted">Armazenamento da API da empresa: {{ formatBytes(consumption.tenant_storage_bytes) }} utilizados · 1 GB incluído, compartilhado entre integrações.</p> }
              <h3>Por token</h3>
              @for (token of consumption.tokens; track token.token_public_id) {
                <p><code>{{ token.token_public_id }}</code><br />{{ token.signatures }} assinaturas · {{ token.requests }} chamadas · {{ formatBytes(token.uploaded_bytes) }} enviados</p>
              }
              <p class="muted">Até 100 tokens exibidos. Os totais incluem todos os tokens do período, inclusive os revogados.</p>
              <button class="button secondary" (click)="refreshUsage()" [disabled]="busy()">Atualizar consumo e métricas</button>
              @if (telemetry(); as metrics) {
                @if (metrics.available && metrics.projection; as projection) { <p class="muted">Tempo médio até resposta: {{ projection.totals.average_duration_ms?.toFixed(1) ?? '—' }} ms · {{ projection.totals.rate_limited }} bloqueios por limite. Métricas sincronizadas em segundo plano.</p> }
                @else { <p class="muted">Métricas temporariamente indisponíveis. O consumo registrado continua disponível.</p> }
              }
            </article>
          }
          @if (contract()?.operational || contract()?.recovery) { <app-enterprise-storage [tenantId]="tenant()!.id" [integrationId]="item.id" [sandbox]="item.sandbox" /> }
          @if (contract()?.operational && item.enabled) {
          <article class="card form"><h2>{{ item.name }}</h2>
            <p class="notice">O token deve ficar no servidor da sua plataforma. Gerar outro invalida imediatamente o anterior desta integração.</p>
            <label>Validade<select [(ngModel)]="validity"><option value="never">Sem expiração</option><option value="15">15 dias</option><option value="30">30 dias</option></select></label>
            <fieldset><legend>Permissões do token</legend>
              @for (scope of scopes; track scope.value) {
                <label><input type="checkbox" [checked]="permissions().has(scope.value)" (change)="toggle(scope.value)" /> {{ scope.label }}</label>
              }
            </fieldset>
            <div class="actions"><button class="button" (click)="rotate()" [disabled]="busy() || !permissions().size">Gerar / substituir token</button>
              <button class="button secondary" (click)="revoke()" [disabled]="busy()">Revogar token</button></div>
            @if (secret()) {
              <section class="notice" role="status"><strong>Copie agora. O token não poderá ser recuperado.</strong>
                <textarea readonly [value]="secret()" aria-label="Token recém-gerado" autocomplete="off" spellcheck="false"></textarea>
                <button class="button secondary" (click)="secret.set('')">Ocultar token</button>
              </section>
            }
          </article>
          <article class="card form"><h2>Compartimentos</h2><p class="muted">Separe os clientes atendidos pela integração. Estes IDs identificam o destino dos uploads.</p>
            <form class="form" (ngSubmit)="createCompartment()"><label>Nome do cliente ou compartimento<input name="compartment" [(ngModel)]="compartmentName" required maxlength="160" /></label>
              <button class="button" [disabled]="busy() || !compartmentName.trim()">Adicionar compartimento</button></form>
            @for (compartment of compartments(); track compartment.id) { <p><strong>{{ compartment.name }}</strong><br /><code>{{ compartment.id }}</code></p> }
          </article>
          <article class="card form"><h2>Provedores da empresa · {{ item.sandbox ? 'Sandbox' : 'Produção' }}</h2>
            <p class="notice">Configuração compartilhada pelas integrações da empresa neste modo. Secrets são protegidos e não podem ser consultados após salvar. Salvar cadastra as credenciais; o funcionamento é verificado na assinatura. Sandbox usa simulação e não chama provedores reais.</p>
            @for (provider of providers(); track provider.provider) { <p>{{ provider.provider }} · versão {{ provider.version }} · {{ provider.status === 'configured_unverified' ? 'Configurado, não verificado' : provider.status }}</p> }
            <form class="form" (ngSubmit)="saveTimestamp()"><h3>Carimbo do tempo</h3>
              <label>Consumer key<input name="timestampKey" type="password" [(ngModel)]="timestampKey" required maxlength="512" autocomplete="new-password" /></label>
              <label>Consumer secret<input name="timestampSecret" type="password" [(ngModel)]="timestampSecret" required maxlength="1024" autocomplete="new-password" /></label>
              <button class="button" [disabled]="busy() || !timestampKey || !timestampSecret">Salvar credenciais do carimbo</button>
            </form>
            <form class="form" (ngSubmit)="saveSerproID()"><h3>SerproID</h3>
              <label>Client ID<input name="serproClientId" [(ngModel)]="serproClientId" required maxlength="36" autocomplete="off" /></label>
              <label>Client secret<input name="serproClientSecret" type="password" [(ngModel)]="serproClientSecret" required maxlength="1024" autocomplete="new-password" /></label>
              <label>Ambiente SerproID<select name="providerEnvironment" [(ngModel)]="providerEnvironment"><option value="production">Produção</option><option value="homologation">Homologação</option></select></label>
              <button class="button" [disabled]="busy() || !serproClientId || !serproClientSecret">Salvar credenciais SerproID</button>
            </form>
          </article>
          }
        }
      }
    </section></div></main>`,
  styles: [`:host{display:block}.form{margin-bottom:1rem}.integrations-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem;margin:1rem 0}.integration-choice{text-align:left;display:grid;gap:.5rem;min-width:0;cursor:pointer}.integration-choice small,code{overflow-wrap:anywhere}.integration-choice.selected{border-color:#a82035}.actions{display:flex;gap:.75rem;flex-wrap:wrap}fieldset{display:grid;gap:.5rem;border:1px solid #ddd;border-radius:.5rem}textarea{display:block;width:100%;min-height:7rem;resize:vertical;margin:.75rem 0}select{max-width:100%}`],
})
export class IntegrationsPageComponent implements OnInit, OnDestroy {
  readonly operations = signal<ProviderOperation[]>([]);
  readonly contract = signal<EnterpriseContract | null>(null);
  updateContract(state: EnterpriseContract) {
    this.contract.set(state);
    if (!state.operational) { this.secret.set(''); this.clearProviderSecrets(); this.usage.set(null); this.telemetry.set(null); }
  }
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly tenant = signal<TenantItem | undefined>(undefined);
  readonly available = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly integrations = signal<Integration[]>([]);
  readonly selected = signal<Integration | null>(null);
  readonly compartments = signal<Compartment[]>([]);
  readonly secret = signal('');
  readonly providers = signal<ProviderConfiguration[]>([]);
  readonly usage = signal<UsageSummary | null>(null);
  readonly telemetry = signal<TelemetrySummary | null>(null);
  readonly permissions = signal(new Set(['documents:create']));
  readonly scopes = [
    { value: 'documents:create', label: 'Enviar documentos' },
    { value: 'documents:read', label: 'Consultar documentos' },
    { value: 'documents:download', label: 'Baixar documentos' },
    { value: 'signature_requests:create', label: 'Preparar solicitações' },
    { value: 'signature_requests:open', label: 'Abrir para assinatura' },
    { value: 'signature_requests:read', label: 'Consultar solicitações' },
    { value: 'signing_sessions:create', label: 'Gerar sessões de assinatura' },
    { value: 'usage:read', label: 'Consultar consumo' },
  ];
  name = '';
  sandbox = true;
  validity = '30';
  compartmentName = '';
  timestampKey = '';
  timestampSecret = '';
  serproClientId = '';
  serproClientSecret = '';
  providerEnvironment: 'production' | 'homologation' = 'production';
  private alive = true;
  async ngOnInit() {
    try {
      const context = await this.auth.restore();
      if (!context) { await this.router.navigateByUrl('/login'); return; }
      if (context.mfa_setup_required) { await this.router.navigateByUrl('/security'); return; }
      const tenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants'));
      const slug = this.route.snapshot.paramMap.get('tenantSlug');
      const tenant = tenants.find(item => slug ? item.slug === slug : item.kind === 'personal') ?? (slug ? undefined : tenants[0]);
      this.tenant.set(tenant);
      if (!tenant || tenant.role !== 'admin') return;
      const canonical = tenantDashboardUrl(tenant, context.account_public_slug).replace(/dashboard$/, 'integrations');
      if (this.router.url.split('?')[0] !== canonical) { await this.router.navigateByUrl(canonical, { replaceUrl: true }); return; }
      let state: EnterpriseContract;
      try { state = await firstValueFrom(this.api.get<EnterpriseContract>(`/enterprise/tenants/${tenant.id}/contract`)); }
      catch (error) { if ((error as { status?: number })?.status === 403) return; throw error; }
      this.available.set(true); this.updateContract(state);
      if (state.operational || state.recovery) this.integrations.set(await firstValueFrom(this.api.get<Integration[]>(this.base())));
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }
  ngOnDestroy() { this.alive = false; this.secret.set(''); this.clearProviderSecrets(); }
  private clearProviderSecrets() { this.timestampKey = ''; this.timestampSecret = ''; this.serproClientSecret = ''; this.serproClientId = ''; }
  private providerBase() { return `/enterprise/tenants/${this.tenant()!.id}/providers`; }
  private base() { return `/enterprise/tenants/${this.tenant()!.id}/integrations`; }
  toggle(scope: string) { this.permissions.update(current => { const next = new Set(current); if (next.has(scope)) next.delete(scope); else next.add(scope); return next; }); }
  async create() {
    if (this.busy() || !this.name.trim()) return;
    this.busy.set(true);
    try {
      const item = await firstValueFrom(this.api.post<Integration>(this.base(), { name: this.name.trim(), sandbox: this.sandbox }));
      this.integrations.update(items => [...items, item]); this.name = ''; this.selected.set(item); this.compartments.set([]); this.secret.set(''); this.providers.set([]); this.clearProviderSecrets(); this.usage.set(null); this.telemetry.set(null);
    } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async choose(item: Integration) {
    if (this.busy()) return;
    this.busy.set(true); this.secret.set(''); this.selected.set(item); this.compartments.set([]); this.providers.set([]); this.clearProviderSecrets(); this.usage.set(null); this.telemetry.set(null); this.operations.set([]);
    try {
      if (!this.contract()?.operational || !item.enabled) return;
      this.operations.set(await firstValueFrom(this.api.get<ProviderOperation[]>(`${this.base()}/${item.id}/operations`)));
      this.compartments.set(await firstValueFrom(this.api.get<Compartment[]>(`${this.base()}/${item.id}/compartments`)));
      this.providers.set(await firstValueFrom(this.api.get<ProviderConfiguration[]>(`${this.providerBase()}?sandbox=${item.sandbox}`)));
      this.usage.set(await firstValueFrom(this.api.get<UsageSummary>(`${this.base()}/${item.id}/usage`)));
    }
    catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async setEnabled(enabled: boolean) {
    const item = this.selected();
    if (!item || this.busy() || (!enabled && !window.confirm('Desativar esta integração e impedir novas operações?'))) return;
    this.busy.set(true); this.secret.set(''); this.clearProviderSecrets();
    try {
      const updated = await firstValueFrom(this.api.patch<Integration>(`${this.base()}/${item.id}`, { enabled }));
      if (!this.alive || this.selected()?.id !== item.id) return;
      this.selected.set(updated); this.integrations.update(items => items.map(value => value.id === item.id ? updated : value));
    } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async reconcile(id: string) {
    const item = this.selected();
    if (!item?.enabled || !this.contract()?.operational || this.busy()) return;
    this.busy.set(true);
    try { await firstValueFrom(this.api.post(`${this.base()}/${item.id}/operations/${id}/reconcile`, {})); }
    catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async rotate() {
    const item = this.selected();
    if (!item || this.busy() || !this.permissions().size || !window.confirm('Gerar um novo token invalida imediatamente o anterior. Continuar?')) return;
    this.busy.set(true); this.secret.set('');
    try {
      const result = await firstValueFrom(this.api.post<{ token: string }>(`${this.base()}/${item.id}/token`, {
        scopes: [...this.permissions()], expires_at: this.validity === 'never' ? null : new Date(Date.now() + Number(this.validity) * 86400000).toISOString(),
      }));
      if (this.alive) this.secret.set(result.token);
    } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async revoke() {
    const item = this.selected();
    if (!item || this.busy() || !window.confirm('Revogar o token desta integração agora?')) return;
    this.busy.set(true); this.secret.set('');
    try { await firstValueFrom(this.api.delete(`${this.base()}/${item.id}/token`)); await this.feedback.success('Token revogado.'); }
    catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async createCompartment() {
    const item = this.selected();
    if (!item || this.busy() || !this.compartmentName.trim()) return;
    this.busy.set(true);
    try {
      const compartment = await firstValueFrom(this.api.post<Compartment>(`${this.base()}/${item.id}/compartments`, { name: this.compartmentName.trim() }));
      this.compartments.update(items => [...items, compartment]); this.compartmentName = '';
    } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
  async saveTimestamp() {
    if (!this.timestampKey || !this.timestampSecret) return;
    await this.saveProvider('serpro-timestamp', { consumer_key: this.timestampKey, consumer_secret: this.timestampSecret });
  }
  async saveSerproID() {
    if (!this.serproClientId || !this.serproClientSecret) return;
    await this.saveProvider('serproid', { client_id: this.serproClientId, client_secret: this.serproClientSecret, environment: this.providerEnvironment });
  }
  private async saveProvider(provider: string, payload: unknown) {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.put(`${this.providerBase()}/${provider}?sandbox=${item.sandbox}`, payload));
      this.clearProviderSecrets();
      this.providers.set(await firstValueFrom(this.api.get<ProviderConfiguration[]>(`${this.providerBase()}?sandbox=${item.sandbox}`)));
      await this.feedback.success('Credenciais salvas. O funcionamento será verificado na assinatura.');
    } catch (error) { await this.feedback.error(error); }
    finally { this.clearProviderSecrets(); this.busy.set(false); }
  }
  formatBytes(value: number) { return value >= 1_000_000_000 ? `${(value / 1_000_000_000).toFixed(3)} GB` : `${(value / 1_000_000).toFixed(2)} MB`; }
  async refreshUsage() {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    try {
      this.usage.set(await firstValueFrom(this.api.get<UsageSummary>(`${this.base()}/${item.id}/usage`)));
      this.telemetry.set(await firstValueFrom(this.api.get<TelemetrySummary>(`${this.base()}/${item.id}/telemetry`)));
    } catch (error) { await this.feedback.error(error); } finally { this.busy.set(false); }
  }
}
