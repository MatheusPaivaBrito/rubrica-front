import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, Locale } from '../core/i18n.service';

interface MfaStatus { enabled: boolean; required_by_policy: boolean; setup_required: boolean; recovery_codes_remaining: number; }
interface MfaSetup { secret: string; provisioning_uri: string; }
interface RecoveryCodes { recovery_codes: string[]; }

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="settings-shell">
      <header class="settings-top"><a routerLink="/dashboard" class="brand">Rubrica<span>.</span></a><div class="button-row"><select [ngModel]="i18n.locale()" (ngModelChange)="changeLocale($event)" [attr.aria-label]="i18n.text('language')"><option value="pt-BR">Português</option><option value="en">English</option><option value="es">Español</option><option value="ja-JP">日本語</option></select><button class="button secondary" (click)="logout()">{{ i18n.text('logout') }}</button></div></header>
      <section class="settings-card card">
        <p class="eyebrow">{{ i18n.text('security') }}</p><h1>Microsoft Authenticator</h1>
        <p class="muted">{{ i18n.text('securityHelp') }}</p>
        @if (loading()) { <p class="notice">{{ i18n.text('loadingSecurity') }}</p> }
        @else if (!status()?.enabled && !setup()) {
          @if (status()?.setup_required) { <p class="notice warning">{{ i18n.text('mfaRequired') }}</p> }
          <div class="button-row"><button class="button" (click)="startSetup()">{{ i18n.text('configureAuthenticator') }}</button>@if (status()?.setup_required) { <button class="button secondary" (click)="deferMfa()">{{ i18n.text('later') }}</button> }</div>
        } @else if (setup()) {
          <div class="setup-grid"><div class="qr-panel"><img [src]="qrCode()" alt="Microsoft Authenticator QR Code" /></div><div><h2>{{ i18n.text('scanQr') }}</h2><p>{{ i18n.text('scanQrHelp') }}</p><p class="secret"><span>{{ i18n.text('manualKey') }}</span><code>{{ setup()!.secret }}</code></p><h2>{{ i18n.text('confirmCode') }}</h2><form class="form" (ngSubmit)="confirm()"><label>{{ i18n.text('sixDigitCode') }}<input name="code" [(ngModel)]="code" inputmode="numeric" autocomplete="one-time-code" required /></label><button class="button">{{ i18n.text('activateMfa') }}</button></form></div></div>
        } @else {
          <p class="status-ok"><i class="bi bi-shield-check"></i> {{ i18n.text('mfaActive') }}</p>
          <p>{{ i18n.text('recoveryAvailable', { count: status()?.recovery_codes_remaining ?? 0 }) }}</p>
          <hr /><h2>{{ i18n.text('manageMfa') }}</h2><form class="form" (ngSubmit)="regenerate()"><label>{{ i18n.text('currentPassword') }}<input name="password" type="password" [(ngModel)]="password" required /></label><label>{{ i18n.text('currentOrRecoveryCode') }}<input name="manageCode" [(ngModel)]="code" required /></label><div class="button-row"><button class="button secondary">{{ i18n.text('generateCodes') }}</button>@if (!status()?.required_by_policy) { <button type="button" class="button danger" (click)="disable()">{{ i18n.text('disableMfa') }}</button> }</div></form>
          @if (status()?.required_by_policy) { <p class="muted">{{ i18n.text('mfaCannotDisable') }}</p> }
        }
        @if (recoveryCodes().length) { <section class="recovery-panel"><h2>{{ i18n.text('saveCodes') }}</h2><p>{{ i18n.text('saveCodesHelp') }}</p><div class="codes">@for (item of recoveryCodes(); track item) { <code>{{ item }}</code> }</div><button class="button secondary" (click)="downloadCodes()">{{ i18n.text('downloadCodes') }}</button></section> }
      </section>
    </main>
  `,
  styles: [`.settings-shell{min-height:100vh;background:#f4f7fb;padding:2rem}.settings-top{max-width:900px;margin:0 auto 1rem;display:flex;justify-content:space-between;align-items:center}.settings-card{max-width:900px;margin:auto;padding:2rem}.setup-grid{display:grid;grid-template-columns:280px 1fr;gap:2rem}.qr-panel{background:white;border:1px solid #dce3ec;border-radius:16px;padding:1rem;display:grid;place-items:center}.qr-panel img{width:100%;max-width:240px}.secret{display:flex;flex-direction:column;gap:.4rem}.secret code,.codes code{background:#edf3f8;padding:.65rem;border-radius:8px}.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin:1rem 0}.status-ok{color:#087b60;font-weight:800;font-size:1.15rem}.recovery-panel{margin-top:2rem;padding:1.25rem;border:1px solid #f0c36a;background:#fffaf0;border-radius:14px}@media(max-width:700px){.settings-shell{padding:1rem}.setup-grid{grid-template-columns:1fr}.codes{grid-template-columns:1fr}}`],
})
export class SecurityPageComponent implements OnInit {
  readonly loading = signal(true); readonly status = signal<MfaStatus | null>(null); readonly setup = signal<MfaSetup | null>(null); readonly qrCode = signal(''); readonly recoveryCodes = signal<string[]>([]);
  code = ''; password = '';
  constructor(private readonly api: ApiService, private readonly auth: AuthService, private readonly router: Router, private readonly feedback: FeedbackService, readonly i18n: I18nService) {}
  changeLocale(locale: Locale): void { this.i18n.setLocale(locale); }
  async ngOnInit() { if (!await this.auth.restore()) { await this.router.navigate(['/login']); return; } await this.loadStatus(); this.loading.set(false); }
  async startSetup() { try { const setup = await firstValueFrom(this.api.post<MfaSetup>('/auth/mfa/setup', {})); this.setup.set(setup); this.qrCode.set(await QRCode.toDataURL(setup.provisioning_uri, { width: 320, margin: 1 })); } catch (error) { await this.feedback.error(error); } }
  async deferMfa() {
    try {
      await firstValueFrom(this.api.post('/auth/mfa/defer', {}));
      this.auth.deferMfaForSession();
      await this.auth.refreshContext();
      await this.router.navigateByUrl(await this.auth.dashboardUrl(), { replaceUrl: true });
    } catch (error) { await this.feedback.error(error); }
  }
  async confirm() { try { const result = await firstValueFrom(this.api.post<RecoveryCodes>('/auth/mfa/confirm', { code: this.code })); this.recoveryCodes.set(result.recovery_codes); this.setup.set(null); this.code=''; await this.auth.refreshContext(); await this.loadStatus(); await this.feedback.success(this.i18n.text('mfaEnabled')); } catch (error) { await this.feedback.error(error); } }
  async regenerate() { try { const result = await firstValueFrom(this.api.post<RecoveryCodes>('/auth/mfa/recovery-codes', { password: this.password, code: this.code })); this.recoveryCodes.set(result.recovery_codes); this.password=''; this.code=''; await this.loadStatus(); } catch (error) { await this.feedback.error(error); } }
  async disable() { try { await firstValueFrom(this.api.deleteWithBody('/auth/mfa', { password: this.password, code: this.code })); this.password=''; this.code=''; this.recoveryCodes.set([]); await this.auth.refreshContext(); await this.loadStatus(); await this.feedback.warning(this.i18n.text('mfaDisabled')); } catch (error) { await this.feedback.error(error); } }
  downloadCodes() { const blob=new Blob([this.recoveryCodes().join('\n')+'\n'],{type:'text/plain'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='rubrica-recovery-codes.txt'; link.click(); URL.revokeObjectURL(url); }
  async logout() { await this.auth.logout(); await this.router.navigate(['/login']); }
  private async loadStatus() { this.status.set(await firstValueFrom(this.api.get<MfaStatus>('/auth/mfa/status'))); }
}
