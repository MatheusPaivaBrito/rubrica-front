import { evidenceReportHtml } from './evidence-report';
import type { SignatureEvidence } from './models';

describe('evidenceReportHtml', () => {
  it('shows the signature evidence as labeled fields and escapes supplied text', () => {
    const row: SignatureEvidence = {
      signature_id: 'signature-id', signer_id: 'signer-id', request_id: 'request-id', document_id: 'document-id',
      document_version: 2, signed_at: '2026-09-21T12:00:00Z', signer_name: '<img src=x onerror=alert(1)>',
      signer_email: 'signer@example.com', subject_hmac_sha256: 'subject-hash', original_sha256: 'original-hash',
      evidence_sha256: 'evidence-hash', artifact_sha256: 'artifact-hash',
      evidence: { consent: true, network: { ip_address: '203.0.113.8', device_type: 'mobile', user_agent: 'Safari' },
        client: { platform: 'iOS', language: 'pt-BR' }, geolocation: { status: 'denied' }, stamp: { page: 1, country_code: 'BR' } },
    };

    const html = evidenceReportHtml([row], 'pt-BR', () => '21/09/2026 09:00');

    expect(html).toContain('Endereço IP');
    expect(html).toContain('203.0.113.8');
    expect(html).toContain('SHA-256 da evidência');
    expect(html).toContain('evidence-hash');
    expect(html).toContain('Assinatura Rubrica por evidências');
    expect(html).not.toContain('Certificado digital Serpro ID');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('identifies Serpro ID only when certificate metadata is present', () => {
    const row: SignatureEvidence = {
      signature_id: 'signature-id', signer_id: 'signer-id', request_id: 'request-id', document_id: 'document-id',
      document_version: 1, signed_at: '2026-09-21T12:00:00Z', signer_name: 'Matheus',
      signer_email: 'signer@example.com', subject_hmac_sha256: 'subject-hash', original_sha256: 'original-hash',
      evidence_sha256: 'evidence-hash', artifact_sha256: 'artifact-hash',
      evidence: { consent: true, certificate_signature: { provider: 'serproid', format: 'PAdES-CMS', certificate_sha256: 'certificate-hash' } },
    };

    const html = evidenceReportHtml([row], 'pt-BR', () => '21/09/2026 09:00');

    expect(html).toContain('Certificado digital Serpro ID (PAdES/CMS)');
    expect(html).toContain('certificate-hash');
    expect(html).toContain('https://validar.iti.gov.br/');
    expect(html).not.toContain('Assinatura Rubrica por evidências');
  });
});
