import { SignatureEvidence } from './models';
import type { Locale } from './i18n.service';

const copy = {
  en: { signedBy: 'Signed by', signedOn: 'Signed on', identity: 'Identity document', network: 'Network and device', ip: 'IP address', device: 'Device', browser: 'Browser', platform: 'Platform', language: 'Language', screen: 'Screen', location: 'Location', unavailable: 'Not recorded', consent: 'Evidence collection consent', yes: 'Accepted', no: 'Not accepted', document: 'Document and integrity', version: 'Version', page: 'Signature page', country: 'Stamp country', originalHash: 'Original PDF SHA-256', evidenceHash: 'Evidence SHA-256', signedHash: 'Signed PDF SHA-256', request: 'Request ID', download: 'Download evidence (.json)', technical: 'The download contains the complete technical record.', granted: 'Shared', denied: 'Not authorized', timeout: 'Timed out', desktop: 'Computer', mobile: 'Phone', tablet: 'Tablet' },
  'pt-BR': { signedBy: 'Assinado por', signedOn: 'Assinado em', identity: 'Documento de identidade', network: 'Rede e dispositivo', ip: 'Endereço IP', device: 'Dispositivo', browser: 'Navegador', platform: 'Plataforma', language: 'Idioma', screen: 'Tela', location: 'Localização', unavailable: 'Não registrado', consent: 'Consentimento para coleta de evidências', yes: 'Aceito', no: 'Não aceito', document: 'Documento e integridade', version: 'Versão', page: 'Página da assinatura', country: 'País do carimbo', originalHash: 'SHA-256 do PDF original', evidenceHash: 'SHA-256 da evidência', signedHash: 'SHA-256 do PDF assinado', request: 'ID da solicitação', download: 'Baixar evidências (.json)', technical: 'O download contém o registro técnico completo.', granted: 'Compartilhada', denied: 'Não autorizada', timeout: 'Tempo esgotado', desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet' },
  es: { signedBy: 'Firmado por', signedOn: 'Firmado el', identity: 'Documento de identidad', network: 'Red y dispositivo', ip: 'Dirección IP', device: 'Dispositivo', browser: 'Navegador', platform: 'Plataforma', language: 'Idioma', screen: 'Pantalla', location: 'Ubicación', unavailable: 'No registrado', consent: 'Consentimiento para recopilar evidencias', yes: 'Aceptado', no: 'No aceptado', document: 'Documento e integridad', version: 'Versión', page: 'Página de la firma', country: 'País del sello', originalHash: 'SHA-256 del PDF original', evidenceHash: 'SHA-256 de la evidencia', signedHash: 'SHA-256 del PDF firmado', request: 'ID de solicitud', download: 'Descargar evidencias (.json)', technical: 'La descarga contiene el registro técnico completo.', granted: 'Compartida', denied: 'No autorizada', timeout: 'Tiempo agotado', desktop: 'Computadora', mobile: 'Teléfono', tablet: 'Tableta' },
  'ja-JP': { signedBy: '署名者', signedOn: '署名日時', identity: '本人確認書類', network: 'ネットワークと端末', ip: 'IPアドレス', device: '端末', browser: 'ブラウザ', platform: 'プラットフォーム', language: '言語', screen: '画面', location: '位置情報', unavailable: '記録なし', consent: '証拠情報の収集への同意', yes: '同意済み', no: '未同意', document: '文書と整合性', version: '版', page: '署名ページ', country: '印影の国', originalHash: '元PDFのSHA-256', evidenceHash: '証拠のSHA-256', signedHash: '署名済みPDFのSHA-256', request: '依頼ID', download: '証拠をダウンロード (.json)', technical: 'ダウンロードには完全な技術記録が含まれます。', granted: '共有済み', denied: '許可されていません', timeout: 'タイムアウト', desktop: 'コンピューター', mobile: 'スマートフォン', tablet: 'タブレット' },
} satisfies Record<Locale, Record<string, string>>;

const certificateCopy = {
  en: { heading: 'Signature type', type: 'Method', certified: 'Serpro ID digital certificate (PAdES/CMS)', evidence: 'Rubrica evidence signature', fingerprint: 'Certificate SHA-256', verify: 'To independently check certificate trust and revocation, submit the signed PDF to the ITI VALIDAR service.' },
  'pt-BR': { heading: 'Tipo de assinatura', type: 'Modalidade', certified: 'Certificado digital Serpro ID (PAdES/CMS)', evidence: 'Assinatura Rubrica por evidências', fingerprint: 'SHA-256 do certificado', verify: 'Para conferir a cadeia do certificado e a revogação de forma independente, envie o PDF assinado ao VALIDAR do ITI.' },
  es: { heading: 'Tipo de firma', type: 'Modalidad', certified: 'Certificado digital Serpro ID (PAdES/CMS)', evidence: 'Firma Rubrica basada en evidencias', fingerprint: 'SHA-256 del certificado', verify: 'Para comprobar de forma independiente la cadena y la revocación del certificado, envíe el PDF firmado al servicio VALIDAR del ITI.' },
  'ja-JP': { heading: '署名の種類', type: '方式', certified: 'Serpro ID デジタル証明書 (PAdES/CMS)', evidence: 'Rubrica の証拠情報による署名', fingerprint: '証明書の SHA-256', verify: '証明書の信頼チェーンと失効状態を独立して確認するには、署名済み PDF を ITI の VALIDAR に提出してください。' },
} satisfies Record<Locale, Record<string, string>>;

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function evidenceReportHtml(rows: SignatureEvidence[], locale: Locale, formatDate: (value: string) => string): string {
  const t = copy[locale];
  const certText = certificateCopy[locale];
  const field = (label: string, value: unknown, hash = false) => `<div style="display:grid;grid-template-columns:minmax(130px,35%) 1fr;gap:.5rem;padding:.35rem 0;border-bottom:1px solid #edf0f5"><dt style="color:#536176">${escapeHtml(label)}</dt><dd style="margin:0;overflow-wrap:anywhere;${hash ? 'font-family:monospace;font-size:.82em;' : ''}">${escapeHtml(value === null || value === undefined || value === '' || value === 'unknown' ? t.unavailable : value)}</dd></div>`;
  const localized = (value: unknown) => typeof value === 'string' && value in t ? t[value as keyof typeof t] : value;
  return rows.map(row => {
    const evidence = object(row.evidence);
    const network = object(evidence['network']);
    const client = object(evidence['client']);
    const location = object(evidence['geolocation']);
    const stamp = object(evidence['stamp']);
    const certificate = object(evidence['certificate_signature']);
    const hasSerproCertificate = certificate['provider'] === 'serproid';
    const screen = client['screen_width'] && client['screen_height'] ? `${client['screen_width']} × ${client['screen_height']}` : undefined;
    const coordinates = location['status'] === 'granted' && location['latitude'] != null && location['longitude'] != null ? `${location['latitude']}, ${location['longitude']}` : undefined;
    const identity = evidence['identity_document_masked'] ? `${evidence['identity_document_type'] ?? ''} ${evidence['identity_document_masked']}`.trim() : undefined;
    return `<section style="text-align:left;margin:0 0 1.5rem;padding:1rem;border:1px solid #dce4ef;border-radius:12px;background:#fff;color:#172334">
      <h3 style="margin:0 0 .5rem;font-size:1.1rem">${escapeHtml(row.signer_name)}</h3>
      ${field(t.signedBy, row.signer_email)}${field(t.signedOn, formatDate(row.signed_at))}${identity ? field(t.identity, identity) : ''}${field(t.consent, evidence['consent'] === true ? t.yes : t.no)}
      <h4 style="margin:1rem 0 .35rem">${escapeHtml(certText.heading)}</h4>
      ${field(certText.type, hasSerproCertificate ? certText.certified : certText.evidence)}
      ${hasSerproCertificate ? `${field(certText.fingerprint, certificate['certificate_sha256'], true)}<p style="color:#536176;font-size:.9em">${escapeHtml(certText.verify)} <a href="https://validar.iti.gov.br/" target="_blank" rel="noopener noreferrer">VALIDAR</a></p>` : ''}
      <h4 style="margin:1rem 0 .35rem">${escapeHtml(t.network)}</h4>
      ${field(t.ip, network['ip_address'])}${field(t.device, localized(network['device_type']))}${field(t.browser, network['user_agent'])}${field(t.platform, client['platform'])}${field(t.language, client['language'])}${screen ? field(t.screen, screen) : ''}${field(t.location, coordinates ?? localized(location['status']))}
      <h4 style="margin:1rem 0 .35rem">${escapeHtml(t.document)}</h4>
      ${field(t.version, row.document_version)}${field(t.page, stamp['page'])}${field(t.country, stamp['country_code'])}${field(t.originalHash, row.original_sha256, true)}${field(t.evidenceHash, row.evidence_sha256, true)}${field(t.signedHash, row.artifact_sha256, true)}${field(t.request, row.request_id, true)}
    </section>`;
  }).join('') + `<p style="text-align:left;color:#536176">${escapeHtml(t.technical)}</p>`;
}

export function evidenceDownloadLabel(locale: Locale): string { return copy[locale].download; }
