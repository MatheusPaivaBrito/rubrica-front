import { expect, test } from '@playwright/test';

function twoPagePdf(): Buffer {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 0>>stream
endstream endobj
5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 792 612]/Rotate 90/Contents 6 0 R>>endobj
6 0 obj<</Length 0>>stream
endstream endobj
xref
0 7
0000000000 65535 f 
trailer<</Size 7/Root 1 0 R>>
startxref
0
%%EOF`;
  return Buffer.from(body);
}

test('configura posições, replica páginas e salva o padrão empresarial', async ({ page }, testInfo) => {
  test.skip(!['android-novo', 'pc'].includes(testInfo.project.name), 'Cobertura representativa de toque e desktop');
  const pdf = twoPagePdf();
  const request = {
    id: 'request-1', document_id: 'doc-1', document_version: 1,
    document_title: 'Contrato empresarial', original_filename: 'contrato.pdf',
    status: 'draft', expires_at: '2027-01-01T00:00:00Z', created_at: '2026-10-22T10:00:00Z',
    created_by: 'admin@example.com', completed_at: null, signer_count: 1, signed_count: 0,
    signature_mode: 'evidence',
  };
  const signer = { id: 'signer-1', name: 'Maria', email: 'maria@example.com', status: 'pending', signed_at: null, participant_role: 'company_representative' };
  let savedDefault: unknown;
  let savedConfiguration: { placements: Array<{ page: number; signer_id: string }>; customization: { template: string } } | undefined;

  await page.route('**/*', async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    const json = (value: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/auth/refresh') return json({ access_token: 'e2e-token' });
    if (path === '/access-control/context') return json({ version: 2, subject: 'admin@example.com', account_public_slug: 'empresa', preferred_locale: 'pt-BR', mfa_enabled: true, mfa_setup_required: false, roles: ['administrator'], permission_keys: ['documents:read', 'documents:write', 'signature_requests:read', 'signature_requests:write'] });
    if (path === '/tenants') return json([{ id: 'tenant-1', name: 'Empresa', slug: 'empresa', kind: 'business', role: 'admin', currency: 'BRL' }]);
    if (path === '/tenants/tenant-1/team') return json({ requires_selection: false, members: [] });
    if (path === '/documents') return json([{ id: 'doc-1', title: 'Contrato empresarial', original_filename: 'contrato.pdf', version: 1, status: 'ready', created_at: request.created_at, created_by: request.created_by, sha256: 'a'.repeat(64), size_bytes: pdf.length, signature_request_count: 1, completed_signature_count: 0 }]);
    if (path === '/signature-requests' && route.request().method() === 'GET') return json([request]);
    if (path === '/signature-requests/request-1') return json(request);
    if (path === '/signature-requests/request-1/signers') return json([signer]);
    if (path === '/signature-requests/signer-contacts') return json([]);
    if (path === '/billing/tenants/tenant-1/account') return json({ tenant_id: 'tenant-1', status: 'active', current_product_code: 'rubrica_intermediate', signatures_used: 0, free_signatures_limit: 5, signatures_remaining: 80, custom_stamp_placement: true, custom_stamp_branding: true, email_invitations: true });
    if (path === '/signature-requests/request-1/stamp-configuration' && route.request().method() === 'GET') return json({ placements: [], customization: null });
    if (path === '/signature-requests/request-1/stamp-configuration' && route.request().method() === 'PUT') { savedConfiguration = route.request().postDataJSON(); return json(savedConfiguration); }
    if (path === '/tenants/tenant-1/stamp-customization' && route.request().method() === 'GET') return json({ template: 'business', primary_color: '#187A66', show_logo: false, logo_png_data_url: null, require_drawn_signature: false });
    if (path === '/tenants/tenant-1/stamp-customization' && route.request().method() === 'PUT') { savedDefault = route.request().postDataJSON(); return json(savedDefault); }
    if (path === '/documents/doc-1/preview') return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf });
    return route.continue();
  });

  await page.goto('/empresa/empresa/dashboard');
  await page.getByRole('button', { name: /detalhes/i }).click();
  await page.getByRole('button', { name: /posicionar carimbos/i }).click();
  const pages = page.locator('.pdf-page');
  await expect(pages).toHaveCount(2);
  await pages.first().click({ position: { x: 160, y: 180 } });
  await page.getByRole('button', { name: /repetir em todas as páginas/i }).click();
  await expect(page.locator('.signature-stamp')).toHaveCount(2);
  await page.getByRole('button', { name: /salvar como padrão da empresa/i }).click();
  await expect.poll(() => savedDefault).toBeTruthy();
  await expect(page.locator('.swal2-container')).toBeHidden({ timeout: 3_000 });
  await page.getByRole('button', { name: /^salvar$/i }).click();
  await expect.poll(() => savedConfiguration?.placements.length).toBe(2);
  expect(savedConfiguration?.placements.map(item => item.page)).toEqual([1, 2]);
  expect(savedConfiguration?.placements.every(item => item.signer_id === 'signer-1')).toBe(true);
  expect(savedConfiguration?.customization.template).toBe('business');
});
