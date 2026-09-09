import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';

interface MfaStatus { enabled: boolean; required_by_policy: boolean; setup_required: boolean; recovery_codes_remaining: number; }
interface MfaSetup { secret: string; provisioning_uri: string; }
interface RecoveryCodes { recovery_codes: string[]; }

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="settings-shell">
      <header class="settings-top"><a routerLink="/dashboard" class="brand">Rubrica<span>.</span></a><button class="button secondary" (click)="logout()">Sair</button></header>
      <section class="settings-card card">
        <p class="eyebrow">Segurança da conta</p><h1>Microsoft Authenticator</h1>
        <p class="muted">Proteja sua conta com um código temporário além da senha.</p>
        @if (loading()) { <p class="notice">Carregando segurança…</p> }
        @else if (!status()?.enabled && !setup()) {
          @if (status()?.setup_required) { <p class="notice warning">Seu perfil exige autenticação em dois fatores. Configure-a para continuar.</p> }
          <button class="button" (click)="startSetup()">Configurar autenticador</button>
        } @else if (setup()) {
          <div class="setup-grid"><div class="qr-panel"><img [src]="qrCode()" alt="QR Code do autenticador" /></div><div><h2>1. Leia o QR Code</h2><p>Abra o Microsoft Authenticator, adicione uma conta e escolha “Outra conta”.</p><p class="secret"><span>Chave manual</span><code>{{ setup()!.secret }}</code></p><h2>2. Confirme o código</h2><form class="form" (ngSubmit)="confirm()"><label>Código de 6 dígitos<input name="code" [(ngModel)]="code" inputmode="numeric" autocomplete="one-time-code" required /></label><button class="button">Ativar MFA</button></form></div></div>
        } @else {
          <p class="status-ok"><i class="bi bi-shield-check"></i> MFA ativo</p>
          <p>{{ status()?.recovery_codes_remaining }} códigos de recuperação disponíveis.</p>
          <hr /><h2>Gerenciar MFA</h2><form class="form" (ngSubmit)="regenerate()"><label>Senha atual<input name="password" type="password" [(ngModel)]="password" required /></label><label>Código atual ou de recuperação<input name="manageCode" [(ngModel)]="code" required /></label><div class="button-row"><button class="button secondary">Gerar novos códigos</button>@if (!status()?.required_by_policy) { <button type="button" class="button danger" (click)="disable()">Desativar MFA</button> }</div></form>
          @if (status()?.required_by_policy) { <p class="muted">Seu perfil exige MFA; por isso ele não pode ser desativado.</p> }
        }
        @if (recoveryCodes().length) { <section class="recovery-panel"><h2>Guarde estes códigos agora</h2><p>Eles não serão mostrados novamente. Cada código funciona uma única vez.</p><div class="codes">@for (item of recoveryCodes(); track item) { <code>{{ item }}</code> }</div><button class="button secondary" (click)="downloadCodes()">Baixar códigos</button></section> }
      </section>
    </main>
  `,
  styles: [`.settings-shell{min-height:100vh;background:#f4f7fb;padding:2rem}.settings-top{max-width:900px;margin:0 auto 1rem;display:flex;justify-content:space-between;align-items:center}.settings-card{max-width:900px;margin:auto;padding:2rem}.setup-grid{display:grid;grid-template-columns:280px 1fr;gap:2rem}.qr-panel{background:white;border:1px solid #dce3ec;border-radius:16px;padding:1rem;display:grid;place-items:center}.qr-panel img{width:100%;max-width:240px}.secret{display:flex;flex-direction:column;gap:.4rem}.secret code,.codes code{background:#edf3f8;padding:.65rem;border-radius:8px}.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin:1rem 0}.status-ok{color:#087b60;font-weight:800;font-size:1.15rem}.recovery-panel{margin-top:2rem;padding:1.25rem;border:1px solid #f0c36a;background:#fffaf0;border-radius:14px}@media(max-width:700px){.settings-shell{padding:1rem}.setup-grid{grid-template-columns:1fr}.codes{grid-template-columns:1fr}}`],
})
export class SecurityPageComponent implements OnInit {
  readonly loading = signal(true); readonly status = signal<MfaStatus | null>(null); readonly setup = signal<MfaSetup | null>(null); readonly qrCode = signal(''); readonly recoveryCodes = signal<string[]>([]);
  code = ''; password = '';
  constructor(private readonly api: ApiService, private readonly auth: AuthService, private readonly router: Router, private readonly feedback: FeedbackService) {}
  async ngOnInit() { if (!await this.auth.restore()) { await this.router.navigate(['/login']); return; } await this.loadStatus(); this.loading.set(false); }
  async startSetup() { try { const setup = await firstValueFrom(this.api.post<MfaSetup>('/auth/mfa/setup', {})); this.setup.set(setup); this.qrCode.set(await QRCode.toDataURL(setup.provisioning_uri, { width: 320, margin: 1 })); } catch (error) { await this.feedback.error(error); } }
  async confirm() { try { const result = await firstValueFrom(this.api.post<RecoveryCodes>('/auth/mfa/confirm', { code: this.code })); this.recoveryCodes.set(result.recovery_codes); this.setup.set(null); this.code=''; await this.auth.refreshContext(); await this.loadStatus(); await this.feedback.success('Autenticação em dois fatores ativada.'); } catch (error) { await this.feedback.error(error); } }
  async regenerate() { try { const result = await firstValueFrom(this.api.post<RecoveryCodes>('/auth/mfa/recovery-codes', { password: this.password, code: this.code })); this.recoveryCodes.set(result.recovery_codes); this.password=''; this.code=''; await this.loadStatus(); } catch (error) { await this.feedback.error(error); } }
  async disable() { try { await firstValueFrom(this.api.deleteWithBody('/auth/mfa', { password: this.password, code: this.code })); this.password=''; this.code=''; this.recoveryCodes.set([]); await this.auth.refreshContext(); await this.loadStatus(); await this.feedback.warning('MFA desativado.'); } catch (error) { await this.feedback.error(error); } }
  downloadCodes() { const blob=new Blob([this.recoveryCodes().join('\n')+'\n'],{type:'text/plain'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='rubrica-recovery-codes.txt'; link.click(); URL.revokeObjectURL(url); }
  async logout() { await this.auth.logout(); await this.router.navigate(['/login']); }
  private async loadStatus() { this.status.set(await firstValueFrom(this.api.get<MfaStatus>('/auth/mfa/status'))); }
}
