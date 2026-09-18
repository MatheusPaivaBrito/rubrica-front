import { expect, test } from '@playwright/test';

function pdfBytes(label: string, pages: number): Buffer {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages} >>`,
  ];
  for (let index = 0; index < pages; index += 1) {
    const content = `BT /F1 18 Tf 72 720 Td (${label} ${index + 1}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages * 2} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

const cases: Record<string, { filename: string; pages: number; legacy: boolean }> = {
  'iphone-antigo': { filename: 'Proposta JOA\u0303O.pdf', pages: 1, legacy: true },
  'iphone-novo': { filename: 'Proposta JOÃO.pdf', pages: 2, legacy: false },
  'android-antigo': { filename: 'cnpj.pdf', pages: 1, legacy: true },
  'android-novo': { filename: 'contrato.pdf', pages: 3, legacy: false },
  pc: { filename: 'documento.pdf', pages: 2, legacy: false },
};

test('exibe arquivo no painel e na assinatura sem leitor nativo', async ({ page }, testInfo) => {
  page.on('console', message => { if (message.type() === 'error') console.error('browser:', message.text()); });
  page.on('pageerror', error => console.error('page:', error.message));
  const scenario = cases[testInfo.project.name];
  const pdf = pdfBytes(testInfo.project.name, scenario.pages);
  const document = {
    id: 'doc-1', title: 'Documento teste', original_filename: scenario.filename,
    version: 1, status: 'ready', created_at: '2026-09-18T10:00:00Z', created_by: 'tester',
    sha256: 'test', size_bytes: pdf.length, signature_request_count: 0, completed_signature_count: 0,
  };
  const request = {
    id: 'request-1', document_id: document.id, document_version: 1,
    document_title: document.title, original_filename: scenario.filename,
    status: 'open', expires_at: '2027-01-01T00:00:00Z', created_at: document.created_at,
    created_by: 'tester', completed_at: null, signer_count: 1, signed_count: 0,
  };
  const signer = { id: 'signer-1', name: 'João', email: 'joao@example.com', status: 'viewed', signed_at: null };

  await page.addInitScript(({ legacy }) => {
    sessionStorage.setItem('rubrica.access-token', 'e2e-token');
    if (legacy) {
      delete (Promise as unknown as { withResolvers?: unknown }).withResolvers;
      delete (AbortSignal as unknown as { any?: unknown }).any;
    }
  }, { legacy: scenario.legacy });

  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (value: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/access-control/context') return json({ version: 1, subject: 'tester', preferred_locale: 'pt-BR', mfa_enabled: true, mfa_setup_required: false, roles: ['signature_operator'], permission_keys: ['documents:read', 'documents:write', 'signature_requests:read', 'signature_requests:write', 'signing:read', 'signing:write'] });
    if (path === '/tenants') return json([{ id: 'tenant-1', name: 'Teste', slug: 'teste', role: 'operator', currency: 'BRL' }]);
    if (path === '/documents') return json([document]);
    if (path === '/signature-requests') return json([]);
    if (path === '/signing/links/token-1') return json({ request, signer, document_title: document.title, original_filename: scenario.filename, stamp: null, viewer_mode: 'signer' });
    if (path === '/signing/links/token-1/view') return json(signer);
    if (path === '/documents/doc-1/preview' || path === '/signing/links/token-1/document') {
      return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': `inline; filename="documento.pdf"; filename*=UTF-8''${encodeURIComponent(scenario.filename)}` }, body: pdf });
    }
    return route.continue();
  });

  await page.goto('/tenant/teste/dashboard');
  await page.locator('tr').filter({ hasText: 'Documento teste' }).locator('button').first().click();
  await expect(page.locator('.pdf-modal canvas')).toHaveCount(scenario.pages);
  await expect.poll(() => page.locator('.pdf-modal canvas').first().evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.pdf-modal canvas').last().evaluate(canvas => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data[3])).toBe(255);
  await expect(page.locator('.pdf-modal iframe')).toHaveCount(0);
  await expect(page.locator('.pdf-modal-actions .button')).toBeVisible();
  await page.locator('.pdf-modal .modal-close').click();

  await page.goto('/signing/token-1');
  await expect(page.locator('.signing-document-pane canvas')).toHaveCount(scenario.pages);
  await expect.poll(() => page.locator('.signing-document-pane canvas').first().evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.signing-document-pane canvas').last().evaluate(canvas => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(10, 10, 1, 1).data[3])).toBe(255);
  await expect(page.locator('.signing-document-pane .error')).toHaveCount(0);
  await page.locator('.signing-document-pane .pdf-page').first().click({ position: { x: 80, y: 80 } });
  await expect(page.locator('.signature-stamp')).toBeVisible();
  await expect(page.locator('.signing-actions .button').first()).toBeEnabled();
  await expect.poll(() => page.evaluate(() => typeof Promise.withResolvers)).toBe('function');
  await expect.poll(() => page.evaluate(() => typeof AbortSignal.any)).toBe('function');
});
