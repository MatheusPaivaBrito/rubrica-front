import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { I18nService, Locale } from '../core/i18n.service';

const copy = {
  'pt-BR': { navProduct:'Produto', navSecurity:'Segurança', navPrice:'Preço', enter:'Entrar', start:'Criar conta grátis', eyebrow:'ASSINATURAS SEM COMPLICAÇÃO', title:'Assine documentos com clareza, segurança e validade.', lead:'Envie PDFs, convide signatários e acompanhe cada etapa. As evidências ficam incorporadas ao documento assinado.', primary:'Começar com 5 assinaturas grátis', secondary:'Ver como funciona', trust:'Feito para documentos importantes', trustCopy:'Identidade, data, dispositivo, IP e hash do arquivo reunidos em uma trilha de evidências verificável.', step1:'Envie seu PDF', step2:'Convide as pessoas', step3:'Acompanhe e comprove', feature1:'Carimbo visual no PDF', feature2:'Autenticação em dois fatores', feature3:'Histórico e evidências', price:'R$ 19,90', period:'/mês por conta', unlimited:'Assinaturas ilimitadas após o período gratuito.', cta:'Seu próximo documento pode estar assinado hoje.', contact:'Contato', privacy:'Privacidade', terms:'Termos de uso', deletion:'Exclusão de dados', rights:'Rubrica. Documentos assinados, decisões registradas.' },
  en: { navProduct:'Product', navSecurity:'Security', navPrice:'Pricing', enter:'Sign in', start:'Create free account', eyebrow:'SIGNATURES WITHOUT FRICTION', title:'Sign documents with clarity, security and confidence.', lead:'Upload PDFs, invite signers and follow every step. Evidence is embedded into the signed document.', primary:'Start with 5 free signatures', secondary:'See how it works', trust:'Built for important documents', trustCopy:'Identity, date, device, IP and file hash combined into a verifiable evidence trail.', step1:'Upload your PDF', step2:'Invite people', step3:'Track and verify', feature1:'Visual stamp on the PDF', feature2:'Two-factor authentication', feature3:'History and evidence', price:'R$ 19.90', period:'/month per account', unlimited:'Unlimited signatures after the free allowance.', cta:'Your next document could be signed today.', contact:'Contact', privacy:'Privacy', terms:'Terms of use', deletion:'Data deletion', rights:'Rubrica. Signed documents, recorded decisions.' },
  'ja-JP': { navProduct:'製品', navSecurity:'セキュリティ', navPrice:'料金', enter:'ログイン', start:'無料アカウント作成', eyebrow:'シンプルな電子署名', title:'明確で安全、信頼できる電子署名。', lead:'PDFをアップロードし、署名者を招待して進捗を確認。証拠情報は署名済み文書に組み込まれます。', primary:'無料5件から始める', secondary:'仕組みを見る', trust:'大切な文書のために', trustCopy:'本人情報、日時、端末、IP、ファイルハッシュを検証可能な証拠として記録します。', step1:'PDFを送信', step2:'署名者を招待', step3:'追跡・確認', feature1:'PDF上の署名スタンプ', feature2:'二要素認証', feature3:'履歴と証拠', price:'R$ 19.90', period:'／月・アカウント', unlimited:'無料枠の後は署名数無制限。', cta:'次の文書を今日署名しませんか。', contact:'お問い合わせ', privacy:'プライバシー', terms:'利用規約', deletion:'データ削除', rights:'Rubrica。署名された文書、記録された意思決定。' },
} as const;

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="landing">
      <nav class="landing-nav" aria-label="Principal">
        <a class="landing-brand" routerLink="/"><img src="icons/rubrica-mark.png" alt="" /><strong>Rubrica</strong></a>
        <div class="landing-links"><a href="#produto">{{ t().navProduct }}</a><a href="#seguranca">{{ t().navSecurity }}</a><a href="#preco">{{ t().navPrice }}</a></div>
        <div class="landing-actions"><select [ngModel]="i18n.locale()" (ngModelChange)="changeLocale($event)" aria-label="Idioma"><option value="pt-BR">PT</option><option value="en">EN</option><option value="ja-JP">日本語</option></select><a class="text-link" routerLink="/login">{{ t().enter }}</a><a class="landing-button small" routerLink="/register">{{ t().start }}</a></div>
      </nav>

      <section class="landing-hero" id="produto">
        <div class="hero-copy"><span class="landing-eyebrow">{{ t().eyebrow }}</span><h1>{{ t().title }}</h1><p>{{ t().lead }}</p><div class="hero-actions"><a class="landing-button" routerLink="/register">{{ t().primary }} <i class="bi bi-arrow-right"></i></a><a class="landing-button outline" href="#como-funciona">{{ t().secondary }}</a></div><div class="micro-trust"><span><i class="bi bi-check-circle-fill"></i> 5 grátis</span><span><i class="bi bi-check-circle-fill"></i> Sem cartão</span><span><i class="bi bi-check-circle-fill"></i> PT · EN · 日本語</span></div></div>
        <div class="hero-visual" aria-label="Fluxo de assinatura"><div class="document-demo"><div class="demo-top"><span></span><span></span><span></span></div><div class="demo-line wide"></div><div class="demo-line"></div><div class="demo-line short"></div><div class="demo-stamp"><img src="icons/rubrica-mark.png" alt="" /><div><small>ASSINADO POR</small><strong>Matheus</strong><span>Hash verificado · 14:32</span></div></div></div><div class="floating-proof"><i class="bi bi-shield-check"></i><span><strong>Documento íntegro</strong><small>SHA-256 verificado</small></span></div></div>
      </section>

      <section class="trust-band" id="seguranca"><img src="icons/rubrica-mark.png" alt="" /><div><h2>{{ t().trust }}</h2><p>{{ t().trustCopy }}</p></div></section>
      <section class="steps" id="como-funciona"><article><b>01</b><i class="bi bi-file-earmark-arrow-up"></i><h3>{{ t().step1 }}</h3></article><article><b>02</b><i class="bi bi-person-plus"></i><h3>{{ t().step2 }}</h3></article><article><b>03</b><i class="bi bi-patch-check"></i><h3>{{ t().step3 }}</h3></article></section>
      <section class="feature-grid"><article><i class="bi bi-vector-pen"></i><h3>{{ t().feature1 }}</h3></article><article><i class="bi bi-shield-lock"></i><h3>{{ t().feature2 }}</h3></article><article><i class="bi bi-fingerprint"></i><h3>{{ t().feature3 }}</h3></article></section>
      <section class="price-section" id="preco"><div><span class="landing-eyebrow">RUBRICA ILIMITADO</span><h2>{{ t().price }} <small>{{ t().period }}</small></h2><p>{{ t().unlimited }}</p></div><a class="landing-button light" routerLink="/register">{{ t().start }}</a></section>
      <section class="final-cta"><img src="icons/rubrica-mark.png" alt="" /><h2>{{ t().cta }}</h2><a class="landing-button" routerLink="/register">{{ t().primary }}</a></section>
      <footer class="landing-footer"><a class="landing-brand" routerLink="/"><img src="icons/rubrica-mark.png" alt="" /><strong>Rubrica</strong></a><nav><a routerLink="/contato">{{ t().contact }}</a><a routerLink="/privacidade">{{ t().privacy }}</a><a routerLink="/termos">{{ t().terms }}</a><a routerLink="/exclusao-de-dados">{{ t().deletion }}</a></nav><p>© {{ year }} {{ t().rights }}</p></footer>
    </main>
  `,
})
export class LandingPageComponent {
  readonly year = new Date().getFullYear();
  readonly t = computed(() => copy[this.i18n.locale()]);
  constructor(readonly i18n: I18nService) {}
  changeLocale(locale: Locale): void { this.i18n.setLocale(locale); }
}
