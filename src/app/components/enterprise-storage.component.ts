import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';

interface Destination { id: string; name: string; kind: string; validated_at: string | null }
interface Calculator { current_bytes: number; included_bytes: number; excess_bytes: number; accrued_gb_month: string; cycle_end: string }
interface MigrationItem { id: string; kind: string; sha256: string; size_bytes: number; status: string }
interface Migration { id: string; status: string; destination_kind?: string; verified_count: number; total_count: number; documents: { document_id: string; status: string; rubrica_copy_removed?: boolean }[]; items: MigrationItem[]; removals?: { id: string; document_id: string; status: string }[] }

@Component({
  selector: 'app-enterprise-storage', standalone: true, imports: [FormsModule],
  template: `<article class="card form storage-panel"><h2>Armazenamento da API</h2>
    @if (calculator(); as usage) {
      <p><strong>{{ gb(usage.current_bytes) }} GB</strong> mantidos · {{ gb(usage.included_bytes) }} GB incluídos</p>
      <p class="muted">Excedente atual: {{ gb(usage.excess_bytes) }} GB · Acumulado: {{ decimal(usage.accrued_gb_month) }} GB/mês.</p>
      <p>Tarifa provisória: R$ 0,00/GB/mês · Estimativa: R$ 0,00. Próximo corte: {{ date(usage.cycle_end) }}.</p>
      <p class="muted">Bytes lógicos de originais e resultados; franquia compartilhada pela empresa. Esta estimativa não é uma fatura.</p>
    }
    <p class="notice">O Rubrica mantém a cópia cifrada. Ao exportar, a empresa passa a proteger os arquivos no destino. A migração preserva as cópias no Rubrica.</p>
    <form class="form" (ngSubmit)="createDestination()">
      <h3>Novo destino</h3><label>Nome<input name="storageName" [(ngModel)]="name" maxlength="160" required /></label>
      <label>Armazenamento<select name="storageKind" [(ngModel)]="kind"><option value="rubrica">Rubrica</option><option value="independent">Entrega independente (download e confirmação)</option>@if (!sandbox) { <option value="s3">Bucket S3 compatível da empresa</option> }</select></label>
      @if (kind === 's3' && !sandbox) {
        <label>Endpoint HTTPS<input name="endpoint" [(ngModel)]="endpoint" type="url" required maxlength="512" placeholder="https://…r2.cloudflarestorage.com" /></label>
        <label>Bucket<input name="bucket" [(ngModel)]="bucket" required maxlength="63" /></label>
        <label>Região<input name="region" [(ngModel)]="region" required maxlength="63" /></label>
        <label>Prefixo opcional<input name="prefix" [(ngModel)]="prefix" maxlength="120" /></label>
        <label>Access key ID<input name="accessKey" [(ngModel)]="accessKey" type="password" autocomplete="new-password" required maxlength="512" /></label>
        <label>Secret access key<input name="secretKey" [(ngModel)]="secretKey" type="password" autocomplete="new-password" required maxlength="1024" /></label>
        <p class="muted">S3 e R2 oficiais são aceitos. Outros hosts precisam de autorização do operador. As credenciais não podem ser recuperadas após salvar.</p>
      }
      <button class="button secondary" [disabled]="busy() || !name.trim()">Cadastrar destino</button>
    </form>
    <label>Destino da migração<select [(ngModel)]="destinationId" (ngModelChange)="acknowledged = false"><option value="">Selecione</option>@for (destination of destinations(); track destination.id) { <option [value]="destination.id">{{ destination.name }} · {{ destination.validated_at ? 'Validado' : 'Não validado' }}</option> }</select></label>
    <div class="actions"><button class="button secondary" [disabled]="busy() || !destinationId" (click)="validate()">Testar destino</button></div>
    <label class="consent"><input type="checkbox" [(ngModel)]="acknowledged" /> Entendo que os PDFs exportados são utilizáveis fora do Rubrica e assumo sua proteção e armazenamento no destino.</label>
    <label class="consent"><input type="checkbox" [(ngModel)]="includeExisting" /> Incluir os arquivos existentes</label>
    <label class="consent"><input type="checkbox" [(ngModel)]="applyToNewUploads" /> Usar este destino também para próximos uploads e novas solicitações</label>
    <p class="muted">Arquivos em assinatura aguardam conclusão, cancelamento ou expiração. Novos uploads passam primeiro pelo armazenamento cifrado e análise do Rubrica.</p>
    <button class="button" [disabled]="busy() || !destinationId || !acknowledged || (!includeExisting && !applyToNewUploads)" (click)="migrate()">Iniciar migração</button>
    @if (jobsList().length) { <label>Migrações recentes<select [ngModel]="migration()?.id ?? ''" (ngModelChange)="selectMigration($event)" [disabled]="busy()">@for (job of jobsList(); track job.id) { <option [value]="job.id">{{ job.status === 'completed' ? 'Concluída' : 'Pendente' }} · {{ job.id }}</option> }</select></label> }
    @if (migration(); as job) {
      <h3>Migração {{ job.status === 'completed' ? 'concluída' : 'em andamento' }}</h3>
      <progress [value]="job.verified_count" [max]="job.total_count || 1" aria-label="Itens com entrega verificada"></progress>
      <p>{{ job.verified_count }} de {{ job.total_count }} itens verificados. O total pode aumentar quando assinaturas pendentes terminarem.</p>
      @for (document of job.documents; track document.document_id) { @if (document.status !== 'verified') { <p class="muted"><code>{{ document.document_id }}</code> · {{ status(document.status) }}</p> } }
      @for (item of job.items; track item.id) {
        @if (item.status === 'awaiting_delivery') {
          <div class="delivery"><p>{{ item.kind }} · <code>{{ item.id }}</code> · {{ gb(item.size_bytes) }} GB</p>
            <button class="button secondary" [disabled]="busy()" (click)="download(item)">Baixar arquivo</button>
            <button class="button secondary" [disabled]="busy() || !downloaded.has(item.id)" (click)="acknowledge(item)">Confirmar que salvei no meu armazenamento</button>
          </div>
        }
      }
      @if (job.status === 'completed' && (job.destination_kind === 's3' || job.destination_kind === 'independent')) {
        <h3>Cópias no Rubrica</h3>
        <p class="notice">Excluir a cópia interrompe a contabilização desses bytes após a confirmação da remoção. Metadados e evidências são preservados. Novas assinaturas deste arquivo exigem restaurar as cópias ou enviar outro arquivo.</p>
        <label class="consent"><input type="checkbox" [(ngModel)]="removalConfirmed" /> Confirmo que quero excluir as cópias selecionadas do armazenamento Rubrica após a entrega verificada.</label>
        @if (job.destination_kind === 'independent') {
          <label class="consent"><input type="checkbox" [(ngModel)]="independentRemovalConfirmed" /> Já guardei os arquivos e entendo que eles deixarão de estar disponíveis para download no Rubrica.</label>
        } @else {
          <p class="muted">Após a exclusão, consultas usam a cópia S3 verificada. Mantenha o bucket e as credenciais acessíveis. Restaurar grava uma nova cópia protegida no Rubrica e volta a contabilizar os bytes.</p>
        }
        @for (entry of job.documents; track entry.document_id) {
          <div class="delivery"><p><code>{{ entry.document_id }}</code> · {{ entry.rubrica_copy_removed ? 'Original removido do Rubrica' : 'Original mantido no Rubrica' }}</p>
            @if (pendingRemoval(entry.document_id)) { <p role="status">Remoção aguardando confirmação. Falhas de armazenamento serão tentadas novamente.</p> }
            @if (!entry.rubrica_copy_removed) { <button class="button danger" [disabled]="busy() || !removalConfirmed || pendingRemoval(entry.document_id) || (job.destination_kind === 'independent' && !independentRemovalConfirmed)" (click)="removeCopies(entry.document_id)">Excluir cópias deste arquivo no Rubrica</button> }
            @else if (job.destination_kind === 's3') { <button class="button secondary" [disabled]="busy() || pendingRemoval(entry.document_id)" (click)="restoreCopies(entry.document_id)">Restaurar cópias e retomar armazenamento</button> }
          </div>
        }
      }
    }
    <button class="button secondary refresh" [disabled]="busy()" (click)="refresh()">Atualizar armazenamento e migração</button>
  </article>`,
  styles: [`.storage-panel{display:grid;gap:1rem;min-width:0;margin-bottom:1rem}.form{display:grid;gap:.75rem}.actions,.delivery{display:flex;gap:.75rem;flex-wrap:wrap}.delivery p{flex-basis:100%;margin:0}.delivery{padding:1rem;border:1px solid var(--border-color,#ddd);border-radius:.5rem}.consent{display:flex;align-items:flex-start;gap:.6rem}code{overflow-wrap:anywhere}progress{width:100%;accent-color:#a82035}select,input{max-width:100%;min-width:0}.refresh{justify-self:start}`],
})
export class EnterpriseStorageComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) tenantId = '';
  @Input({ required: true }) integrationId = '';
  @Input() sandbox = true;
  private readonly api = inject(ApiService);
  private readonly feedback = inject(FeedbackService);
  readonly calculator = signal<Calculator | null>(null);
  readonly destinations = signal<Destination[]>([]);
  readonly migration = signal<Migration | null>(null);
  readonly jobsList = signal<Migration[]>([]);
  readonly busy = signal(false);
  readonly downloaded = new Set<string>();
  name = ''; kind = 'rubrica'; endpoint = ''; bucket = ''; region = 'auto'; prefix = ''; accessKey = ''; secretKey = '';
  destinationId = ''; acknowledged = false;
  includeExisting = true; applyToNewUploads = false;
  removalConfirmed = false; independentRemovalConfirmed = false;
  private generation = 0;
  private base() { return `/enterprise/tenants/${this.tenantId}/storage`; }
  private jobs() { return `${this.base()}/integrations/${this.integrationId}/migrations`; }
  ngOnChanges() {
    this.generation++; this.clearSecrets(); this.migration.set(null); this.calculator.set(null); this.destinations.set([]); this.jobsList.set([]);
    this.destinationId = ''; this.acknowledged = false; this.kind = 'rubrica'; this.downloaded.clear(); this.applyToNewUploads = false; this.includeExisting = true;
    this.removalConfirmed = false; this.independentRemovalConfirmed = false;
    void this.refresh();
  }
  ngOnDestroy() { this.generation++; this.clearSecrets(); this.downloaded.clear(); }
  clearSecrets() { this.accessKey = ''; this.secretKey = ''; }
  async refresh() {
    const generation = this.generation;
    try {
      const [destinations, calculator, jobs] = await Promise.all([
        firstValueFrom(this.api.get<Destination[]>(`${this.base()}/destinations?sandbox=${this.sandbox}`)),
        firstValueFrom(this.api.get<Calculator>(`${this.base()}/calculator?sandbox=${this.sandbox}`)),
        firstValueFrom(this.api.get<Migration[]>(this.jobs())),
      ]);
      if (generation !== this.generation) return;
      this.destinations.set(destinations); this.calculator.set(calculator); this.jobsList.set(jobs);
      let job = this.migration();
      if (!job) {
        job = jobs[0] ?? null;
      }
      if (job) {
        const latest = await firstValueFrom(this.api.get<Migration>(`${this.jobs()}/${job.id}`));
        if (generation === this.generation) this.migration.set(latest);
      }
    } catch (error) { if (generation === this.generation) await this.feedback.error(error); }
  }
  async selectMigration(id: string) {
    const generation = this.generation;
    await this.perform(async () => {
      const job = await firstValueFrom(this.api.get<Migration>(`${this.jobs()}/${id}`));
      if (generation === this.generation) { this.migration.set(job); this.downloaded.clear(); this.removalConfirmed = false; this.independentRemovalConfirmed = false; }
    });
  }
  private async perform(operation: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    try { await operation(); } catch (error) { await this.feedback.error(error); }
    finally { this.busy.set(false); }
  }
  async createDestination() {
    const generation = this.generation;
    if (this.sandbox && this.kind === 's3') return;
    await this.perform(async () => {
      const payload = { name: this.name.trim(), kind: this.kind, ...(this.kind === 's3' ? { configuration: {
        endpoint: this.endpoint, bucket: this.bucket, region: this.region, prefix: this.prefix,
        access_key_id: this.accessKey, secret_access_key: this.secretKey,
      } } : {}) };
      this.clearSecrets();
      const result = await firstValueFrom(this.api.post<Destination>(`${this.base()}/destinations?sandbox=${this.sandbox}`, payload));
      if (generation !== this.generation) return;
      this.destinationId = result.id; this.name = ''; await this.refresh();
    });
  }
  async validate() {
    await this.perform(async () => {
      await firstValueFrom(this.api.post(`${this.base()}/destinations/${this.destinationId}/validate?sandbox=${this.sandbox}`, {}));
      await this.refresh();
    });
  }
  async migrate() {
    if (!this.acknowledged || !this.destinationId || (!this.includeExisting && !this.applyToNewUploads)) return;
    const generation = this.generation;
    await this.perform(async () => {
      const job = await firstValueFrom(this.api.post<Migration>(this.jobs(), { destination_id: this.destinationId, acknowledge_plaintext_export: true,
        include_existing: this.includeExisting, apply_to_new_uploads: this.applyToNewUploads }));
      if (generation !== this.generation) return;
      this.migration.set(job); await this.refresh();
    });
  }
  async download(item: MigrationItem) {
    const generation = this.generation;
    await this.perform(async () => {
      const response = await firstValueFrom(this.api.getBlob(`${this.jobs()}/${this.migration()!.id}/items/${item.id}/download`));
      if (generation !== this.generation || !response.body) return;
      const bytes = await response.body.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
      if (generation !== this.generation) return;
      if (digest !== item.sha256 || bytes.byteLength !== item.size_bytes) throw new Error('Arquivo recebido não corresponde à entrega esperada.');
      const url = URL.createObjectURL(response.body);
      const link = document.createElement('a'); link.href = url; link.download = `${item.id}.${item.kind === 'evidence' ? 'json' : 'pdf'}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.downloaded.add(item.id);
    });
  }
  async acknowledge(item: MigrationItem) {
    if (!this.downloaded.has(item.id)) return;
    await this.perform(async () => {
      await firstValueFrom(this.api.post(`${this.jobs()}/${this.migration()!.id}/items/${item.id}/acknowledge`, {
        sha256: item.sha256, size_bytes: item.size_bytes, durable_storage_confirmed: true,
      })); await this.refresh();
    });
  }
  pendingRemoval(documentId: string) {
    return this.migration()?.removals?.some(item => item.document_id === documentId && ['pending', 'retry'].includes(item.status)) ?? false;
  }
  async removeCopies(documentId: string) {
    const job = this.migration();
    if (!job || job.status !== 'completed' || !['s3', 'independent'].includes(job.destination_kind ?? '') || !this.removalConfirmed || this.pendingRemoval(documentId)
      || (job.destination_kind === 'independent' && !this.independentRemovalConfirmed)) return;
    const generation = this.generation;
    await this.perform(async () => {
      await firstValueFrom(this.api.post(`${this.jobs()}/${job.id}/remove-copies`, { document_ids: [documentId],
        confirm_remove_rubrica_copies: true, acknowledge_independent_unavailability: this.independentRemovalConfirmed }));
      if (generation !== this.generation) return;
      this.removalConfirmed = false; this.independentRemovalConfirmed = false; await this.refresh();
    });
  }
  async restoreCopies(documentId: string) {
    const job = this.migration();
    if (!job || job.destination_kind !== 's3' || this.pendingRemoval(documentId)) return;
    await this.perform(async () => {
      await firstValueFrom(this.api.post(`${this.jobs()}/${job.id}/restore-copies`, { document_ids: [documentId] }));
      await this.refresh();
    });
  }
  gb(bytes: number) { return this.decimal(String(bytes / 1_000_000_000)); }
  decimal(value: string) { return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 6 }); }
  date(value: string) { return new Date(value).toLocaleString('pt-BR'); }
  status(value: string) { return ({ waiting_signature: 'Aguardando encerramento da assinatura', waiting_scan: 'Aguardando análise do arquivo', copying: 'Verificando entrega', blocked: 'Arquivo bloqueado', manifest_invalid: 'Integridade do manifesto precisa de revisão', pending: 'Na fila' } as Record<string, string>)[value] ?? value; }
}
