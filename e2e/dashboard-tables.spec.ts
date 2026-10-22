import { expect, test } from '@playwright/test';

const createdAt = [
  '2026-10-20T10:00:00Z',
  '2026-10-22T12:00:00Z',
  '2026-10-18T08:00:00Z',
  '2026-10-22T12:00:00Z',
  '2026-10-21T11:00:00Z',
  '2026-10-19T09:00:00Z',
  '2026-10-17T07:00:00Z',
];

const documents = createdAt.map((date, index) => ({
  id: `doc-${index + 1}`,
  title: index === 3 ? 'Contrato recém-enviado' : `Documento ${index + 1}`,
  original_filename: `arquivo-${index + 1}.pdf`,
  version: 1,
  status: 'ready',
  created_at: date,
  created_by: 'tester@example.com',
  sha256: `${index + 1}`.repeat(64),
  size_bytes: 1024 * (index + 1),
  signature_request_count: index % 2,
  completed_signature_count: index % 3,
}));

const requests = createdAt.map((date, index) => ({
  id: `request-${index + 1}`,
  document_id: `doc-${index + 1}`,
  document_version: 1,
  document_title: index === 3 ? 'Contrato recém-enviado' : `Documento ${index + 1}`,
  original_filename: `arquivo-${index + 1}.pdf`,
  status: index % 3 === 0 ? 'open' : index % 3 === 1 ? 'draft' : 'completed',
  expires_at: `2026-12-${String(index + 10).padStart(2, '0')}T18:00:00Z`,
  created_at: date,
  created_by: 'tester@example.com',
  completed_at: null,
  signer_count: 2,
  signed_count: index % 3,
  signature_mode: 'evidence',
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (value: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(value),
    });
    if (path === '/auth/refresh') return json({ access_token: 'e2e-token' });
    if (path === '/access-control/context') return json({
      version: 2,
      subject: 'tester@example.com',
      account_public_slug: 'tester',
      preferred_locale: 'pt-BR',
      mfa_enabled: true,
      mfa_setup_required: false,
      roles: ['signature_operator'],
      permission_keys: [
        'documents:read', 'documents:write', 'signature_requests:read',
        'signature_requests:write', 'signing:read', 'signing:write',
      ],
    });
    if (path === '/tenants') return json([{
      id: 'tenant-1', name: 'Conta de teste', slug: 'teste', kind: 'personal',
      role: 'operator', currency: 'BRL',
    }]);
    if (path === '/documents') return json(documents);
    if (path === '/signature-requests') return json(requests);
    if (path === '/billing/accounts/tenant-1') return json({
      tenant_id: 'tenant-1', status: 'not_configured', signatures_used: 0,
      free_signatures_limit: 5, signatures_remaining: 5,
    });
    return route.continue();
  });
  await page.goto('/tenant/teste/dashboard');
  await expect(page.getByTestId('signature-requests-table')).toBeVisible();
});

test('mantém as duas DataTables legíveis, ordenadas e navegáveis', async ({ page }, testInfo) => {
  const requestCard = page.getByTestId('signature-requests-table');
  const documentCard = page.getByTestId('documents-table');
  const requestRows = requestCard.locator('tbody tr');
  const documentRows = documentCard.locator('tbody tr');

  await expect(requestRows).toHaveCount(5);
  await expect(documentRows).toHaveCount(5);
  await expect(requestRows.first()).toContainText('#request-4');
  await expect(documentRows.first()).toContainText('Contrato recém-enviado');

  await expect(requestCard).toHaveScreenshot(`requests-${testInfo.project.name}.png`, {
    animations: 'disabled',
    caret: 'hide',
  });
  await expect(documentCard).toHaveScreenshot(`documents-${testInfo.project.name}.png`, {
    animations: 'disabled',
    caret: 'hide',
  });

  const nextDocumentPage = documentCard.getByRole('button', { name: /próxima/i });
  await nextDocumentPage.focus();
  await expect(nextDocumentPage).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(documentRows).toHaveCount(2);

  const documentSearch = documentCard.getByRole('textbox', { name: /buscar/i });
  await documentSearch.fill('recém-enviado');
  await expect(documentRows).toHaveCount(1);
  await expect(documentRows.first()).toContainText('Contrato recém-enviado');

  const documentSort = documentCard.getByRole('button', { name: /^documento/i });
  await documentSearch.clear();
  await documentSort.focus();
  await page.keyboard.press('Enter');
  await expect(documentRows.first()).toContainText('Contrato recém-enviado');

  const viewport = page.viewportSize();
  const requestBox = await requestCard.boundingBox();
  const documentBox = await documentCard.boundingBox();
  expect(viewport).not.toBeNull();
  expect(requestBox).not.toBeNull();
  expect(documentBox).not.toBeNull();
  expect(requestBox!.x).toBeGreaterThanOrEqual(0);
  expect(documentBox!.x).toBeGreaterThanOrEqual(0);
  expect(requestBox!.x + requestBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(documentBox!.x + documentBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
});
