import { AfterViewInit, Component, computed, ElementRef, inject, NgZone, PLATFORM_ID, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from '../core/seo.service';
import { ActivatedRoute, RouterLink } from '@angular/router';

const pages = {
  contato: { eyebrow:'FALE COM A RUBRICA', title:'Contato', intro:'Estamos disponíveis para dúvidas comerciais, suporte e questões sobre privacidade.', sections:[['Atendimento','Preencha o formulário ou escreva para contact@rubricasignature.com. Para suporte, informe o e-mail da conta e, se necessário, o UUID do tenant — nunca envie sua senha.']] },
  privacidade: { eyebrow:'TRANSPARÊNCIA', title:'Política de privacidade', intro:'Tratamos dados pessoais apenas para operar, proteger e comprovar as assinaturas realizadas na plataforma.', sections:[['Dados tratados','Dados da conta, identificadores do documento, IP, navegador, plataforma, data, posição do carimbo e evidências técnicas da assinatura.'],['Finalidade e segurança','Usamos essas informações para autenticação, execução do serviço, prevenção a fraude, auditoria e cumprimento de obrigações legais.'],['Seus direitos','Você pode solicitar acesso, correção ou exclusão pelos nossos canais de contato, observadas as retenções necessárias para preservar documentos assinados e obrigações legais.']] },
  termos: { eyebrow:'REGRAS DO SERVIÇO', title:'Termos de uso', intro:'Ao utilizar o Rubrica, você concorda com estas condições essenciais.', sections:[['Uso responsável','Você deve fornecer informações verdadeiras, proteger suas credenciais e utilizar a plataforma somente para documentos e finalidades lícitas.'],['Assinaturas e evidências','O Rubrica registra evidências técnicas e incorpora informações ao PDF. A adequação jurídica de cada documento e a autorização dos signatários permanecem sob responsabilidade da conta contratante.'],['Disponibilidade e cobrança','Contas novas recebem cinco assinaturas gratuitas. A modalidade paga oferece assinaturas ilimitadas enquanto a assinatura estiver ativa, conforme as condições apresentadas no checkout.']] },
  'exclusao-de-dados': { eyebrow:'CONTROLE DOS SEUS DADOS', title:'Exclusão de dados', intro:'Você pode solicitar a exclusão da sua conta e dos dados pessoais associados.', sections:[['Como solicitar','Envie um e-mail para privacidade@rubricasignature.com usando o endereço cadastrado e informe o UUID do tenant. Confirmaremos sua identidade antes de executar o pedido.'],['O que pode permanecer','Registros necessários para obrigações legais, prevenção a fraude, cobrança ou integridade de documentos assinados podem ser preservados pelo prazo aplicável.'],['Prazo e retorno','Após validar a solicitação, informaremos o escopo da exclusão e o prazo de atendimento pelo mesmo canal.']] },
} as const;

@Component({ standalone:true, imports:[RouterLink, FormsModule], template:`<main class="legal-shell"><nav class="legal-nav"><a class="landing-brand" routerLink="/"><img src="icons/rubrica-mark.png" alt="" /><strong>Rubrica</strong></a><a class="landing-button small" routerLink="/login">Entrar</a></nav><article class="legal-document"><a routerLink="/" class="back-link"><i class="bi bi-arrow-left"></i> Voltar ao início</a><span class="landing-eyebrow">{{ page().eyebrow }}</span><h1>{{ page().title }}</h1><p class="legal-intro">{{ page().intro }}</p>@for(section of page().sections; track section[0]){<section><h2>{{ section[0] }}</h2><p>{{ section[1] }}</p></section>}
@if (isContact) {
  <form class="contact-form" (ngSubmit)="submit()" #contactForm="ngForm">
    <h2>Envie sua mensagem</h2>
    <div class="contact-fields"><label>Nome<input name="name" [(ngModel)]="form.name" required minlength="2" maxlength="120" autocomplete="name" /></label><label>E-mail<input name="email" type="email" [(ngModel)]="form.email" required email maxlength="254" autocomplete="email" /></label></div>
    <label>Assunto<select name="topic" [(ngModel)]="form.topic" required><option value="comercial">Comercial</option><option value="suporte">Suporte</option><option value="privacidade">Privacidade</option></select></label>
    <label>Mensagem<textarea name="message" [(ngModel)]="form.message" required minlength="10" maxlength="3000" rows="6" placeholder="Como podemos ajudar?"></textarea></label>
    <label class="contact-honeypot" aria-hidden="true">Site<input name="website" [(ngModel)]="form.website" tabindex="-1" autocomplete="off" /></label>
    <div #turnstileContainer class="contact-turnstile"></div>
    @if (state === 'sent') { <p class="contact-success" role="status">Mensagem enviada. Responderemos pelo e-mail informado.</p> }
    @if (state === 'error') { <p class="contact-error" role="alert">Não foi possível enviar agora. Tente novamente ou escreva para <a href="mailto:contact@rubricasignature.com">contact@rubricasignature.com</a>.</p> }
    @if (state === 'unavailable') { <p class="contact-error" role="status">O formulário está indisponível no momento. Escreva para <a href="mailto:contact@rubricasignature.com">contact@rubricasignature.com</a>.</p> }
    <button class="landing-button" type="submit" [disabled]="contactForm.invalid || !turnstileToken || state === 'sending'">{{ state === 'sending' ? 'Enviando...' : 'Enviar mensagem' }}</button>
  </form>
} @else { <small>Última atualização: setembro de 2026.</small> }
</article></main>` })
export class LegalPageComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  readonly page = computed(() => pages[(this.route.snapshot.data['page'] as keyof typeof pages) ?? 'termos']);
  readonly isContact = this.route.snapshot.data['page'] === 'contato';
  @ViewChild('turnstileContainer') turnstileContainer?: ElementRef<HTMLElement>;
  form = { name: '', email: '', topic: 'comercial', message: '', website: '' };
  turnstileToken = '';
  state: 'idle' | 'sending' | 'sent' | 'error' | 'unavailable' = 'idle';
  private widgetId?: string;
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  constructor(title: Title, meta: Meta, seo: SeoService) {
    const page = pages[(this.route.snapshot.data['page'] as keyof typeof pages) ?? 'termos'];
    title.setTitle(`${page.title} · Rubrica`);
    meta.updateTag({ name: 'description', content: page.intro });
    seo.setCanonical(`/${this.route.snapshot.data['page'] ?? 'termos'}`);
  }

  ngAfterViewInit(): void {
    if (!this.isContact || !isPlatformBrowser(this.platformId)) return;
    this.http.get<{ turnstile_site_key: string }>('/contact/config').subscribe({
      next: config => {
        if (!config.turnstile_site_key) { this.state = 'unavailable'; return; }
        this.loadTurnstile(config.turnstile_site_key);
      },
      error: () => { this.state = 'unavailable'; },
    });
  }

  private loadTurnstile(siteKey: string): void {
    const render = () => {
      const widget = (window as TurnstileWindow).turnstile;
      if (!widget || !this.turnstileContainer) { this.state = 'unavailable'; return; }
      this.widgetId = widget.render(this.turnstileContainer.nativeElement, {
        sitekey: siteKey,
        callback: token => this.zone.run(() => { this.turnstileToken = token; }),
        'expired-callback': () => this.zone.run(() => { this.turnstileToken = ''; }),
        'error-callback': () => this.zone.run(() => { this.turnstileToken = ''; this.state = 'error'; }),
      });
    };
    if ((window as TurnstileWindow).turnstile) { render(); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    script.onerror = () => { this.state = 'unavailable'; };
    document.head.appendChild(script);
  }

  submit(): void {
    if (!this.turnstileToken || this.state === 'sending') return;
    this.state = 'sending';
    this.http.post('/contact/messages', { ...this.form, turnstile_token: this.turnstileToken }).subscribe({
      next: () => { this.state = 'sent'; this.form.message = ''; this.resetTurnstile(); },
      error: () => { this.state = 'error'; this.resetTurnstile(); },
    });
  }

  private resetTurnstile(): void {
    this.turnstileToken = '';
    if (this.widgetId) (window as TurnstileWindow).turnstile?.reset(this.widgetId);
  }
}

interface TurnstileWindow extends Window {
  turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string; reset: (id: string) => void };
}
