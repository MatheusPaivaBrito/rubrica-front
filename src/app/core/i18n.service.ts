import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Locale = 'pt-BR' | 'en' | 'ja-JP';

const messages = {
  'pt-BR': {
    login: 'Entre para assinar', loginHelp: 'Use sua conta para acessar documentos e convites de assinatura.',
    email: 'E-mail', password: 'Senha', enter: 'Entrar', authenticatorCode: 'Código do autenticador',
    authenticatorHelp: 'Abra o Microsoft Authenticator e informe o código de seis dígitos.',
    forgotPassword: 'Esqueci minha senha', createAccount: 'Criar conta', name: 'Nome', newPassword: 'Nova senha',
    documentCountry: 'País emissor do documento', documentType: 'Tipo de documento', documentNumber: 'Número do documento',
    optionalIdentity: 'Documento opcional', doNotProvide: 'Não informar agora', passport: 'Passaporte',
    nationalId: 'Documento nacional', residenceCard: 'Cartão de residência', driverLicense: 'Carteira de habilitação',
    taxId: 'Identificação fiscal', other: 'Outro', cpf: 'CPF', nif: 'NIF', sendRecovery: 'Enviar recuperação',
    changePassword: 'Alterar senha', backToLogin: 'Voltar ao login', verifyingEmail: 'Confirmando seu e-mail…',
    account: 'Conta', recovery: 'Recuperar senha', verifyEmail: 'Confirmar e-mail', reviewData: 'Revise os dados e tente novamente.',
    registrationSent: 'Confira seu e-mail para confirmar a conta.', recoverySent: 'Se a conta existir, enviaremos as instruções.',
    passwordChanged: 'Senha alterada.', emailVerified: 'E-mail confirmado.', invalidCredentials: 'E-mail ou senha incorretos.',
    loginFailed: 'Não foi possível entrar', language: 'Idioma',
  },
  en: {
    login: 'Sign in to sign', loginHelp: 'Use your account to access documents and signing invitations.',
    email: 'Email', password: 'Password', enter: 'Sign in', authenticatorCode: 'Authenticator code',
    authenticatorHelp: 'Open Microsoft Authenticator and enter the six-digit code.',
    forgotPassword: 'Forgot my password', createAccount: 'Create account', name: 'Name', newPassword: 'New password',
    documentCountry: 'Document issuing country', documentType: 'Document type', documentNumber: 'Document number',
    optionalIdentity: 'Optional document', doNotProvide: 'Not now', passport: 'Passport',
    nationalId: 'National ID', residenceCard: 'Residence card', driverLicense: 'Driver license',
    taxId: 'Tax ID', other: 'Other', cpf: 'CPF', nif: 'NIF', sendRecovery: 'Send recovery email',
    changePassword: 'Change password', backToLogin: 'Back to sign in', verifyingEmail: 'Confirming your email…',
    account: 'Account', recovery: 'Recover password', verifyEmail: 'Confirm email', reviewData: 'Review the information and try again.',
    registrationSent: 'Check your email to confirm your account.', recoverySent: 'If the account exists, we will send instructions.',
    passwordChanged: 'Password changed.', emailVerified: 'Email confirmed.', invalidCredentials: 'Incorrect email or password.',
    loginFailed: 'Unable to sign in', language: 'Language',
  },
  'ja-JP': {
    login: '署名するためにログイン', loginHelp: 'アカウントで文書と署名依頼にアクセスします。',
    email: 'メールアドレス', password: 'パスワード', enter: 'ログイン', authenticatorCode: '認証コード',
    authenticatorHelp: 'Microsoft Authenticatorを開き、6桁のコードを入力してください。',
    forgotPassword: 'パスワードを忘れた場合', createAccount: 'アカウント作成', name: '氏名', newPassword: '新しいパスワード',
    documentCountry: '身分証明書の発行国', documentType: '身分証明書の種類', documentNumber: '文書番号',
    optionalIdentity: '身分証明書（任意）', doNotProvide: '今は登録しない', passport: 'パスポート',
    nationalId: '国民身分証明書', residenceCard: '在留カード', driverLicense: '運転免許証',
    taxId: '納税者番号', other: 'その他', cpf: 'ブラジルCPF', nif: 'ポルトガルNIF', sendRecovery: '再設定メールを送信',
    changePassword: 'パスワードを変更', backToLogin: 'ログインに戻る', verifyingEmail: 'メールを確認しています…',
    account: 'アカウント', recovery: 'パスワード再設定', verifyEmail: 'メール確認', reviewData: '入力内容を確認して、もう一度お試しください。',
    registrationSent: '確認メールをご確認ください。', recoverySent: 'アカウントが存在する場合、手順を送信します。',
    passwordChanged: 'パスワードを変更しました。', emailVerified: 'メールを確認しました。', invalidCredentials: 'メールアドレスまたはパスワードが正しくありません。',
    loginFailed: 'ログインできませんでした', language: '言語',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly locale = signal<Locale>(this.initialLocale());

  text(key: MessageKey): string { return messages[this.locale()][key]; }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    if (this.browser) localStorage.setItem('rubrica_locale', locale);
    if (this.browser) document.documentElement.lang = locale;
  }

  applyProfileLocale(locale: string | null | undefined): void {
    if (locale === 'pt-BR' || locale === 'en' || locale === 'ja-JP') this.setLocale(locale);
  }

  private initialLocale(): Locale {
    if (!this.browser) return 'en';
    const stored = localStorage.getItem('rubrica_locale');
    if (stored === 'pt-BR' || stored === 'en' || stored === 'ja-JP') return stored;
    for (const candidate of navigator.languages.length ? navigator.languages : [navigator.language]) {
      const language = candidate.toLowerCase();
      if (language.startsWith('pt')) return 'pt-BR';
      if (language.startsWith('ja')) return 'ja-JP';
    }
    return 'en';
  }
}
