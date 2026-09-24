import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, computed, effect, ElementRef, inject, NgZone, PLATFORM_ID, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { LanguagePickerComponent } from '../components/language-picker.component';
import { I18nService, Locale } from '../core/i18n.service';
import { SeoService } from '../core/seo.service';

type PageKey = 'contact' | 'enterprise' | 'privacy' | 'terms' | 'data-deletion';
type Section = readonly [string, string];
interface PageCopy { eyebrow: string; title: string; intro: string; sections: readonly Section[]; }
interface UiCopy { back: string; signIn: string; updated: string; formTitle: string; name: string; email: string; company: string; teamSize: string; sizeSmall: string; sizeMedium: string; sizeLarge: string; topic: string; sales: string; support: string; privacy: string; message: string; placeholder: string; enterprisePlaceholder: string; sent: string; error: string; unavailable: string; sending: string; send: string; }

const pages: Record<Locale, Record<PageKey, PageCopy>> = {
  en: {
    contact: { eyebrow: 'TALK TO RUBRICA', title: 'Contact', intro: 'We are available for sales questions, support and privacy requests.', sections: [['Customer care', 'Complete the form or email contact@rubricasignature.com. For support, include your account email and, when relevant, the tenant UUID. Never send your password.']] },
    enterprise: { eyebrow: 'RUBRICA FOR BUSINESS', title: 'A solution shaped around your company', intro: 'Tell us about your process, expected volume and goals. We will discuss the best way for Rubrica to support your operation.', sections: [['Built together', 'We evaluate your requirements and propose an appropriate commercial and technical path for your organization.']] },
    privacy: { eyebrow: 'TRANSPARENCY', title: 'Privacy policy', intro: 'We process personal data only to operate and protect the service and to produce evidence of signatures.', sections: [['Data we process', 'Account data, document identifiers, IP address, browser, platform, date, stamp position and technical signature evidence.'], ['Purpose and security', 'We use this information for authentication, service delivery, fraud prevention, auditing and compliance with legal obligations.'], ['Your rights', 'You may request access, correction or deletion through our contact channel, subject to retention needed for signed documents and legal obligations.']] },
    terms: { eyebrow: 'SERVICE RULES', title: 'Terms of use', intro: 'By using Rubrica, you agree to these essential conditions.', sections: [['Responsible use', 'You must provide accurate information, protect your credentials and use the platform only for lawful documents and purposes.'], ['Signatures and evidence', 'Rubrica records technical evidence and embeds information in the PDF. The account owner remains responsible for the legal suitability of each document and for signer authorization.'], ['Availability and billing', 'New accounts receive five free signatures. Paid plans provide the allowances shown at checkout while the subscription remains active.']] },
    'data-deletion': { eyebrow: 'CONTROL YOUR DATA', title: 'Data deletion', intro: 'You may request deletion of your account and associated personal data.', sections: [['How to request it', 'Use the contact form and select Privacy, or email contact@rubricasignature.com from your registered address. Include the tenant UUID when available. We will confirm your identity before processing the request.'], ['Data we may retain', 'Records required for legal obligations, fraud prevention, billing or the integrity of signed documents may be retained for the applicable period.'], ['Timeline and response', 'After validating the request, we will confirm the deletion scope and expected completion time through the same channel.']] },
  },
  'pt-BR': {
    contact: { eyebrow: 'FALE COM A RUBRICA', title: 'Contato', intro: 'Estamos disponíveis para dúvidas comerciais, suporte e solicitações sobre privacidade.', sections: [['Atendimento', 'Preencha o formulário ou escreva para contact@rubricasignature.com. Para suporte, informe o e-mail da conta e, quando necessário, o UUID do tenant. Nunca envie sua senha.']] },
    enterprise: { eyebrow: 'RUBRICA PARA EMPRESAS', title: 'Uma solução pensada para sua empresa', intro: 'Conte sobre seu processo, volume esperado e objetivos. Vamos conversar sobre a melhor forma de o Rubrica apoiar sua operação.', sections: [['Construído em conjunto', 'Avaliamos suas necessidades e propomos um caminho comercial e técnico adequado para sua organização.']] },
    privacy: { eyebrow: 'TRANSPARÊNCIA', title: 'Política de privacidade', intro: 'Tratamos dados pessoais apenas para operar e proteger o serviço e produzir evidências das assinaturas.', sections: [['Dados tratados', 'Dados da conta, identificadores do documento, IP, navegador, plataforma, data, posição do carimbo e evidências técnicas da assinatura.'], ['Finalidade e segurança', 'Usamos essas informações para autenticação, execução do serviço, prevenção a fraude, auditoria e cumprimento de obrigações legais.'], ['Seus direitos', 'Você pode solicitar acesso, correção ou exclusão pelo nosso canal de contato, observadas as retenções necessárias para documentos assinados e obrigações legais.']] },
    terms: { eyebrow: 'REGRAS DO SERVIÇO', title: 'Termos de uso', intro: 'Ao utilizar o Rubrica, você concorda com estas condições essenciais.', sections: [['Uso responsável', 'Você deve fornecer informações verdadeiras, proteger suas credenciais e utilizar a plataforma somente para documentos e finalidades lícitas.'], ['Assinaturas e evidências', 'O Rubrica registra evidências técnicas e incorpora informações ao PDF. A conta contratante permanece responsável pela adequação jurídica de cada documento e pela autorização dos signatários.'], ['Disponibilidade e cobrança', 'Contas novas recebem cinco assinaturas gratuitas. Os planos pagos oferecem os limites apresentados no checkout enquanto a assinatura estiver ativa.']] },
    'data-deletion': { eyebrow: 'CONTROLE DOS SEUS DADOS', title: 'Exclusão de dados', intro: 'Você pode solicitar a exclusão da sua conta e dos dados pessoais associados.', sections: [['Como solicitar', 'Use o formulário de contato e selecione Privacidade, ou escreva para contact@rubricasignature.com usando o endereço cadastrado. Informe o UUID do tenant quando disponível. Confirmaremos sua identidade antes de processar o pedido.'], ['O que pode permanecer', 'Registros necessários para obrigações legais, prevenção a fraude, cobrança ou integridade de documentos assinados podem ser preservados pelo prazo aplicável.'], ['Prazo e retorno', 'Após validar a solicitação, informaremos o escopo da exclusão e o prazo previsto pelo mesmo canal.']] },
  },
  es: {
    contact: { eyebrow: 'HABLE CON RUBRICA', title: 'Contacto', intro: 'Estamos disponibles para consultas comerciales, soporte y solicitudes de privacidad.', sections: [['Atención', 'Complete el formulario o escriba a contact@rubricasignature.com. Para soporte, indique el correo de su cuenta y, cuando corresponda, el UUID del tenant. Nunca envíe su contraseña.']] },
    enterprise: { eyebrow: 'RUBRICA PARA EMPRESAS', title: 'Una solución pensada para su empresa', intro: 'Cuéntenos sobre su proceso, volumen esperado y objetivos. Conversaremos sobre la mejor forma de apoyar su operación.', sections: [['Construido en conjunto', 'Evaluamos sus necesidades y proponemos un camino comercial y técnico adecuado para su organización.']] },
    privacy: { eyebrow: 'TRANSPARENCIA', title: 'Política de privacidad', intro: 'Tratamos datos personales únicamente para operar y proteger el servicio y generar evidencias de las firmas.', sections: [['Datos que tratamos', 'Datos de la cuenta, identificadores del documento, dirección IP, navegador, plataforma, fecha, posición del sello y evidencias técnicas de la firma.'], ['Finalidad y seguridad', 'Usamos esta información para autenticación, prestación del servicio, prevención del fraude, auditoría y cumplimiento de obligaciones legales.'], ['Sus derechos', 'Puede solicitar acceso, corrección o eliminación por nuestro canal de contacto, con las retenciones necesarias para documentos firmados y obligaciones legales.']] },
    terms: { eyebrow: 'REGLAS DEL SERVICIO', title: 'Términos de uso', intro: 'Al utilizar Rubrica, acepta estas condiciones esenciales.', sections: [['Uso responsable', 'Debe proporcionar información correcta, proteger sus credenciales y usar la plataforma únicamente para documentos y fines lícitos.'], ['Firmas y evidencias', 'Rubrica registra evidencias técnicas e incorpora información al PDF. El titular de la cuenta sigue siendo responsable de la validez jurídica de cada documento y de la autorización de los firmantes.'], ['Disponibilidad y cobro', 'Las cuentas nuevas reciben cinco firmas gratuitas. Los planes de pago ofrecen los límites mostrados al contratar mientras la suscripción esté activa.']] },
    'data-deletion': { eyebrow: 'CONTROL DE SUS DATOS', title: 'Eliminación de datos', intro: 'Puede solicitar la eliminación de su cuenta y de los datos personales asociados.', sections: [['Cómo solicitarla', 'Use el formulario de contacto y seleccione Privacidad, o escriba a contact@rubricasignature.com desde su dirección registrada. Incluya el UUID del tenant cuando esté disponible. Confirmaremos su identidad antes de procesar la solicitud.'], ['Datos que podemos conservar', 'Podemos conservar durante el plazo aplicable los registros necesarios para obligaciones legales, prevención del fraude, cobros o integridad de documentos firmados.'], ['Plazo y respuesta', 'Después de validar la solicitud, confirmaremos por el mismo canal el alcance y el plazo previsto.']] },
  },
  'ja-JP': {
    contact: { eyebrow: 'RUBRICAへのお問い合わせ', title: 'お問い合わせ', intro: '営業、サポート、プライバシーに関するお問い合わせを受け付けています。', sections: [['お問い合わせ窓口', 'フォームに入力するか、contact@rubricasignature.com までメールをお送りください。サポートをご希望の場合は、アカウントのメールアドレスと、必要に応じてテナントUUIDを記載してください。パスワードは送信しないでください。']] },
    enterprise: { eyebrow: '法人向けRUBRICA', title: '企業に合わせたソリューション', intro: '業務プロセス、想定利用量、目的をお聞かせください。Rubricaがどのように支援できるかご相談します。', sections: [['一緒に構築', '要件を確認し、組織に適した商用・技術的な進め方をご提案します。']] },
    privacy: { eyebrow: '透明性', title: 'プライバシーポリシー', intro: '当社は、サービスの運営と保護、および署名証拠の生成に必要な範囲でのみ個人データを処理します。', sections: [['処理するデータ', 'アカウント情報、文書識別子、IPアドレス、ブラウザ、プラットフォーム、日時、印影位置、署名に関する技術的証拠。'], ['利用目的と安全性', '認証、サービス提供、不正防止、監査、法的義務の履行のためにこれらの情報を使用します。'], ['お客様の権利', '署名済み文書や法的義務に必要な保存期間を除き、お問い合わせ窓口からアクセス、訂正、削除を請求できます。']] },
    terms: { eyebrow: 'サービス利用規則', title: '利用規約', intro: 'Rubricaを利用することで、以下の基本条件に同意したものとみなされます。', sections: [['適切な利用', '正確な情報を提供し、認証情報を保護し、合法的な文書と目的にのみ本サービスを使用してください。'], ['署名と証拠', 'Rubricaは技術的証拠を記録し、情報をPDFに組み込みます。各文書の法的妥当性と署名者の承認については、アカウント所有者が責任を負います。'], ['提供と料金', '新規アカウントには5件の無料署名が付与されます。有料プランでは、契約が有効な間、申込画面に表示された利用枠が適用されます。']] },
    'data-deletion': { eyebrow: 'データの管理', title: 'データの削除', intro: 'アカウントおよび関連する個人データの削除を請求できます。', sections: [['請求方法', 'お問い合わせフォームで「プライバシー」を選択するか、登録済みメールアドレスから contact@rubricasignature.com へご連絡ください。可能な場合はテナントUUIDを記載してください。処理前に本人確認を行います。'], ['保存される場合があるデータ', '法的義務、不正防止、請求処理、署名済み文書の完全性に必要な記録は、適用期間中保存される場合があります。'], ['期間と回答', '請求の確認後、削除範囲と完了予定を同じ連絡手段でお知らせします。']] },
  },
};

const shared: Record<Locale, UiCopy> = {
  en: { back: 'Back to home', signIn: 'Sign in', updated: 'Last updated: September 2026.', formTitle: 'Send us a message', name: 'Name', email: 'Business email', company: 'Company', teamSize: 'Company size', sizeSmall: 'Up to 20 people', sizeMedium: '21 to 100 people', sizeLarge: 'More than 100 people', topic: 'Topic', sales: 'Sales', support: 'Support', privacy: 'Privacy', message: 'Message', placeholder: 'How can we help?', enterprisePlaceholder: 'Describe your process, expected volume and what you would like to achieve with Rubrica.', sent: 'Message sent. We will reply to the email address provided.', error: 'We could not send your message. Try again or email', unavailable: 'The form is temporarily unavailable. Email', sending: 'Sending…', send: 'Send message' },
  'pt-BR': { back: 'Voltar ao início', signIn: 'Entrar', updated: 'Última atualização: setembro de 2026.', formTitle: 'Conte sobre sua empresa', name: 'Nome', email: 'E-mail corporativo', company: 'Empresa', teamSize: 'Porte da empresa', sizeSmall: 'Até 20 pessoas', sizeMedium: '21 a 100 pessoas', sizeLarge: 'Mais de 100 pessoas', topic: 'Assunto', sales: 'Comercial', support: 'Suporte', privacy: 'Privacidade', message: 'Mensagem', placeholder: 'Como podemos ajudar?', enterprisePlaceholder: 'Descreva seu processo, volume esperado e o que deseja alcançar com o Rubrica.', sent: 'Mensagem enviada. Responderemos pelo e-mail informado.', error: 'Não foi possível enviar agora. Tente novamente ou escreva para', unavailable: 'O formulário está indisponível no momento. Escreva para', sending: 'Enviando…', send: 'Enviar mensagem' },
  es: { back: 'Volver al inicio', signIn: 'Entrar', updated: 'Última actualización: septiembre de 2026.', formTitle: 'Cuéntenos sobre su empresa', name: 'Nombre', email: 'Correo corporativo', company: 'Empresa', teamSize: 'Tamaño de la empresa', sizeSmall: 'Hasta 20 personas', sizeMedium: '21 a 100 personas', sizeLarge: 'Más de 100 personas', topic: 'Asunto', sales: 'Comercial', support: 'Soporte', privacy: 'Privacidad', message: 'Mensaje', placeholder: '¿Cómo podemos ayudar?', enterprisePlaceholder: 'Describa su proceso, volumen esperado y lo que desea lograr con Rubrica.', sent: 'Mensaje enviado. Responderemos al correo indicado.', error: 'No pudimos enviar el mensaje. Inténtelo de nuevo o escriba a', unavailable: 'El formulario no está disponible temporalmente. Escriba a', sending: 'Enviando…', send: 'Enviar mensaje' },
  'ja-JP': { back: 'ホームへ戻る', signIn: 'ログイン', updated: '最終更新：2026年9月', formTitle: '企業についてお聞かせください', name: 'お名前', email: '法人メールアドレス', company: '会社名', teamSize: '会社規模', sizeSmall: '20名以下', sizeMedium: '21〜100名', sizeLarge: '100名以上', topic: 'お問い合わせ種別', sales: '営業', support: 'サポート', privacy: 'プライバシー', message: 'メッセージ', placeholder: 'お問い合わせ内容をご記入ください。', enterprisePlaceholder: '業務プロセス、想定利用量、Rubricaで実現したいことをご記入ください。', sent: '送信しました。ご入力のメールアドレスへ返信します。', error: '送信できませんでした。もう一度お試しいただくか、こちらへメールしてください：', unavailable: '現在フォームを利用できません。こちらへメールしてください：', sending: '送信中…', send: '送信' },
};

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, LanguagePickerComponent],
  template: `
    <main class="legal-shell"><nav class="legal-nav"><a class="landing-brand" routerLink="/" aria-label="Rubrica"><img src="icons/rubrica-brand/source/rubrica-lockup-primary.png" alt="Rubrica Signature" /></a><div class="landing-actions"><app-language-picker /><a class="landing-button small" routerLink="/login">{{ ui().signIn }}</a></div></nav>
    <article class="legal-document"><a routerLink="/" class="back-link"><i class="bi bi-arrow-left"></i> {{ ui().back }}</a><span class="landing-eyebrow">{{ page().eyebrow }}</span><h1>{{ page().title }}</h1><p class="legal-intro">{{ page().intro }}</p>
    @for (section of page().sections; track section[0]) { <section><h2>{{ section[0] }}</h2><p>{{ section[1] }}</p></section> }
    @if (hasForm) {
      <form class="contact-form" (ngSubmit)="submit()" #contactForm="ngForm"><h2>{{ ui().formTitle }}</h2><div class="contact-fields"><label>{{ ui().name }}<input name="name" [(ngModel)]="form.name" required minlength="2" maxlength="120" autocomplete="name" /></label><label>{{ ui().email }}<input name="email" type="email" [(ngModel)]="form.email" required email maxlength="254" autocomplete="email" /></label></div>
      @if (isEnterprise) { <div class="contact-fields"><label>{{ ui().company }}<input name="company" [(ngModel)]="form.company" required minlength="2" maxlength="160" autocomplete="organization" /></label><label>{{ ui().teamSize }}<select name="teamSize" [(ngModel)]="form.team_size" required><option value="1-20">{{ ui().sizeSmall }}</option><option value="21-100">{{ ui().sizeMedium }}</option><option value="101+">{{ ui().sizeLarge }}</option></select></label></div> } @else { <label>{{ ui().topic }}<select name="topic" [(ngModel)]="form.topic" required><option value="sales">{{ ui().sales }}</option><option value="support">{{ ui().support }}</option><option value="privacy">{{ ui().privacy }}</option></select></label> }
      <label>{{ ui().message }}<textarea name="message" [(ngModel)]="form.message" required minlength="10" maxlength="3000" rows="6" [placeholder]="isEnterprise ? ui().enterprisePlaceholder : ui().placeholder"></textarea></label><label class="contact-honeypot" aria-hidden="true">Website<input name="website" [(ngModel)]="form.website" tabindex="-1" autocomplete="off" /></label><div #turnstileContainer class="contact-turnstile"></div>
      @if (state === 'sent') { <p class="contact-success" role="status">{{ ui().sent }}</p> } @if (state === 'error') { <p class="contact-error" role="alert">{{ ui().error }} <a href="mailto:contact@rubricasignature.com">contact@rubricasignature.com</a>.</p> } @if (state === 'unavailable') { <p class="contact-error" role="status">{{ ui().unavailable }} <a href="mailto:contact@rubricasignature.com">contact@rubricasignature.com</a>.</p> }
      <button class="landing-button" type="submit" [disabled]="contactForm.invalid || !turnstileToken || state === 'sending'">{{ state === 'sending' ? ui().sending : ui().send }}</button></form>
    } @else { <small>{{ ui().updated }}</small> }</article></main>`,
})
export class LegalPageComponent implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pageKey = (this.route.snapshot.data['page'] as PageKey | undefined) ?? 'terms';
  private readonly i18n = inject(I18nService);
  readonly page = computed(() => pages[this.i18n.locale()][this.pageKey]);
  readonly ui = computed(() => shared[this.i18n.locale()]);
  readonly isContact = this.pageKey === 'contact';
  readonly isEnterprise = this.pageKey === 'enterprise';
  readonly hasForm = this.isContact || this.isEnterprise;
  @ViewChild('turnstileContainer') turnstileContainer?: ElementRef<HTMLElement>;
  form = { name: '', email: '', company: '', team_size: '1-20', topic: this.isEnterprise ? 'enterprise' : 'sales', message: '', website: '' };
  turnstileToken = '';
  state: 'idle' | 'sending' | 'sent' | 'error' | 'unavailable' = 'idle';
  private widgetId?: string;
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  constructor(title: Title, meta: Meta, seo: SeoService) {
    seo.setCanonical(`/${this.pageKey}`);
    effect(() => { const page = this.page(); title.setTitle(`${page.title} · Rubrica`); meta.updateTag({ name: 'description', content: page.intro }); });
  }

  ngAfterViewInit(): void {
    if (!this.hasForm || !isPlatformBrowser(this.platformId)) return;
    this.http.get<{ turnstile_site_key: string }>('/contact/config').subscribe({ next: config => { if (!config.turnstile_site_key) { this.state = 'unavailable'; return; } this.loadTurnstile(config.turnstile_site_key); }, error: () => { this.state = 'unavailable'; } });
  }

  private loadTurnstile(siteKey: string): void {
    const render = () => { const widget = (window as TurnstileWindow).turnstile; if (!widget || !this.turnstileContainer) { this.state = 'unavailable'; return; } this.widgetId = widget.render(this.turnstileContainer.nativeElement, { sitekey: siteKey, action: this.isEnterprise ? 'enterprise_contact' : 'contact', theme: 'light', appearance: 'always', size: 'flexible', callback: token => this.zone.run(() => { this.turnstileToken = token; }), 'expired-callback': () => this.zone.run(() => { this.turnstileToken = ''; }), 'error-callback': () => this.zone.run(() => { this.turnstileToken = ''; this.state = 'error'; }) }); };
    if ((window as TurnstileWindow).turnstile) { render(); return; }
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = render; script.onerror = () => { this.state = 'unavailable'; }; document.head.appendChild(script);
  }

  submit(): void {
    if (!this.turnstileToken || this.state === 'sending') return;
    this.state = 'sending';
    this.http.post('/contact/messages', { ...this.form, turnstile_token: this.turnstileToken }).subscribe({ next: () => { this.state = 'sent'; this.form.message = ''; this.resetTurnstile(); }, error: () => { this.state = 'error'; this.resetTurnstile(); } });
  }

  private resetTurnstile(): void { this.turnstileToken = ''; if (this.widgetId) (window as TurnstileWindow).turnstile?.reset(this.widgetId); }
}

interface TurnstileWindow extends Window { turnstile?: { render: (element: HTMLElement, options: { sitekey: string; action: string; theme: 'light'; appearance: 'always'; size: 'flexible'; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string; reset: (id: string) => void }; }
