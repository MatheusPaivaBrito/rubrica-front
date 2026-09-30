import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService, Locale } from '../core/i18n.service';
import { TenantAccessState, TenantItem } from '../core/models';

interface ReactivationCopy {
  loading: string; eyebrow: string; title: string; help: string; suspended: string;
  invitation: string; workspaceName: string; create: string; logout: string; personal: string;
}

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="login-layout"><section class="card reactivation-card">
      <img class="reactivation-logo" src="icons/rubrica-brand/lockup/192x192/rubrica-lockup-primary-192x192.png" alt="Rubrica Signature" />
      @if (loading()) { <p class="notice">{{ text().loading }}</p> }
      @else {
        <p class="eyebrow">{{ text().eyebrow }}</p>
        <h1>{{ text().title }}</h1>
        <p class="muted">{{ text().help }}</p>
        @if (state()?.suspended_tenants?.length) {
          <div class="suspended-list">
            @for (tenant of state()!.suspended_tenants; track tenant.tenant_id) {
              <div><strong>{{ tenant.tenant_name }}</strong><span>{{ text().suspended }}</span></div>
            }
          </div>
        }
        <div class="notice">{{ text().invitation }}</div>
        @if (state()?.can_create_personal_tenant) {
          <form class="form" (ngSubmit)="createPersonal()">
            <label>{{ text().workspaceName }}<input name="workspaceName" [(ngModel)]="workspaceName" required minlength="2" maxlength="160" /></label>
            <button class="button" [disabled]="submitting() || workspaceName.trim().length < 2">{{ submitting() ? '…' : text().create }}</button>
          </form>
        }
        <button class="button secondary full-width" type="button" (click)="logout()">{{ text().logout }}</button>
      }
    </section></main>
  `,
  styles: [`
    .reactivation-card{width:min(560px,100%)}
    .reactivation-logo{display:block;width:175px;height:70px;object-fit:cover;margin:0 auto 1.5rem}
    .suspended-list{display:grid;gap:.65rem;margin:1.25rem 0}
    .suspended-list div{display:flex;justify-content:space-between;gap:1rem;padding:.9rem 1rem;border:1px solid #e6ccd0;border-radius:10px;background:#fff9f9}
    .suspended-list span{color:#9f1d35;font-weight:700}
    .form{margin:1.25rem 0}
  `],
})
export class AccountReactivationPageComponent implements OnInit {
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly state = signal<TenantAccessState | null>(null);
  workspaceName = '';

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly feedback: FeedbackService,
    private readonly i18n: I18nService,
  ) {}

  async ngOnInit(): Promise<void> {
    const context = await this.auth.restore();
    if (!context) { await this.router.navigate(['/login']); return; }
    try {
      const tenants = await firstValueFrom(this.api.get<TenantItem[]>('/tenants'));
      if (tenants.length) { await this.router.navigateByUrl(await this.auth.dashboardUrl(), { replaceUrl: true }); return; }
      const state = await firstValueFrom(this.api.get<TenantAccessState>('/tenants/access-state'));
      this.state.set(state);
      this.workspaceName = context.subject.split('@')[0] || this.text().personal;
    } catch (error) { await this.feedback.error(error); }
    finally { this.loading.set(false); }
  }

  async createPersonal(): Promise<void> {
    const state = this.state();
    if (!state?.can_create_personal_tenant || this.submitting()) return;
    const previous = state.suspended_tenants[0];
    this.submitting.set(true);
    try {
      await firstValueFrom(this.api.post<TenantItem>('/tenants/personal-after-suspension', {
        name: this.workspaceName.trim(),
        default_locale: previous?.default_locale ?? this.i18n.locale(),
        country_code: previous?.country_code ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        currency: previous?.currency ?? 'USD',
      }));
      await this.router.navigateByUrl(await this.auth.dashboardUrl(), { replaceUrl: true });
    } catch (error) { await this.feedback.error(error); }
    finally { this.submitting.set(false); }
  }

  async logout(): Promise<void> { await this.auth.logout(); await this.router.navigate(['/login']); }

  text(): ReactivationCopy {
    const copy: Record<Locale, ReactivationCopy> = {
      'pt-BR': { loading:'Carregando sua conta…', eyebrow:'ACESSO À CONTA', title:'Escolha como continuar', help:'Seu acesso ao espaço empresarial foi suspenso após uma mudança de plano. Seus dados e o histórico desse espaço continuam preservados.', suspended:'Acesso suspenso', invitation:'Para voltar ao mesmo tenant ou entrar em outro, um administrador precisa reativar ou convidar esta conta. Você também pode criar agora um espaço pessoal independente.', workspaceName:'Nome do novo espaço pessoal', create:'Criar meu espaço pessoal', logout:'Sair', personal:'Minha conta' },
      en: { loading:'Loading your account…', eyebrow:'ACCOUNT ACCESS', title:'Choose how to continue', help:'Your access to the business workspace was suspended after a plan change. Its data and history remain preserved.', suspended:'Access suspended', invitation:'To return to the same tenant or join another one, an administrator must reactivate or invite this account. You can also create an independent personal workspace now.', workspaceName:'New personal workspace name', create:'Create my personal workspace', logout:'Sign out', personal:'My account' },
      es: { loading:'Cargando tu cuenta…', eyebrow:'ACCESO A LA CUENTA', title:'Elige cómo continuar', help:'Tu acceso al espacio empresarial fue suspendido después de un cambio de plan. Sus datos e historial se conservan.', suspended:'Acceso suspendido', invitation:'Para volver al mismo tenant o entrar en otro, un administrador debe reactivar o invitar esta cuenta. También puedes crear un espacio personal independiente.', workspaceName:'Nombre del nuevo espacio personal', create:'Crear mi espacio personal', logout:'Salir', personal:'Mi cuenta' },
      'ja-JP': { loading:'アカウントを読み込んでいます…', eyebrow:'アカウントアクセス', title:'続行方法を選択', help:'プラン変更により企業ワークスペースへのアクセスが停止されました。データと履歴は保持されています。', suspended:'アクセス停止中', invitation:'同じテナントに戻るか別のテナントに参加するには、管理者による再有効化または招待が必要です。個人ワークスペースを作成することもできます。', workspaceName:'新しい個人ワークスペース名', create:'個人ワークスペースを作成', logout:'ログアウト', personal:'マイアカウント' },
    };
    return copy[this.i18n.locale()];
  }
}
