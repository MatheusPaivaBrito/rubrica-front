import { expect, test } from '@playwright/test';

test('enviar convite para a filial e salvar permissões sem alterar os assentos', async ({ page }) => {
  const owner = { id: 'owner', auth_user_id: 'admin@example.test', role: 'admin', status: 'active' };
  let member = { id: 'member', auth_user_id: 'member@example.test', role: 'member', status: 'active', document_scope: 'own', sign_company_only: false };
  const team = () => ({
    current_member_id: owner.id, member_limit: 10, active_count: 2, members: [owner, member],
    can_manage: true, can_request_branch: true, requires_selection: false,
    current_seat_member_ids: [owner.id, member.id], next_cycle_member_ids: [owner.id, member.id],
    next_cycle_starts_at: '2027-01-01T12:00:00Z', seat_roster_locked: true,
  });
  let permissionsSaved = 0;
  let rosterSaved = 0;
  let invitedEmail = '';
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path === '/auth/refresh') return json({ access_token: 'fixture-token' });
    if (path === '/access-control/context') return json({
      version: 2, subject: owner.auth_user_id, account_public_slug: 'admin', preferred_locale: 'pt-BR',
      mfa_enabled: true, mfa_setup_required: false, roles: ['administrator'],
      permission_keys: ['documents:read', 'documents:write', 'users:read', 'users:write'],
    });
    if (path === '/tenants') return json([{ id: 'home', name: 'Sede de teste', slug: 'sede', kind: 'business', role: 'admin', currency: 'BRL' }]);
    if (path === '/billing/tenants/home/account') return json({ status: 'active', current_product_code: 'rubrica_team' });
    if (path === '/tenants/home/team') return json(team());
    if (path === '/tenants/home/branches') return json([{
      id: 'review-b', business_tenant_id: 'branch-b', legal_name: 'Filial de teste', workspace_active: true,
      cnpj_masked: '••.•••.•••/••••-03', member_count: invitedEmail ? 1 : 0, status: 'approved',
    }]);
    if (path === '/tenants/branch-b/members') return json(invitedEmail ? [{ ...member, auth_user_id: invitedEmail }] : []);
    if (path === '/tenants/branch-b/member-invitations') {
      invitedEmail = route.request().postDataJSON().email;
      return route.fulfill({ status: 204 });
    }
    if (path === '/tenants/home/team/member/role') {
      const changes = route.request().postDataJSON();
      expect(changes).toEqual({ role: 'auditor', document_scope: 'all', sign_company_only: true });
      member = { ...member, ...changes };
      permissionsSaved += 1;
      return json(team());
    }
    if (path === '/tenants/home/team/next-cycle') { rosterSaved += 1; return json(team()); }
    return route.continue();
  });
  await page.goto('/t/sede/a/admin/team');
  await page.getByRole('button', { name: /Filial de teste/ }).click();
  await page.getByRole('button', { name: 'Adicionar membro' }).click();
  const invite = page.getByRole('dialog');
  await expect(invite).toContainText('Filial de teste');
  await invite.locator('input[name=memberName]').fill('Pessoa de teste');
  await invite.locator('input[name=memberDocument]').fill('12345678909');
  await invite.locator('input[name=memberEmail]').fill('filial@example.test');
  await invite.getByRole('button', { name: 'Enviar convite' }).click();
  await page.locator('.swal2-confirm').click();
  await expect(page.getByText('filial@example.test')).toBeVisible();

  await page.getByRole('button', { name: /Sede de teste.*membros/ }).click();
  await page.getByRole('button', { name: 'Permissões' }).click();
  const permissions = page.getByRole('dialog');
  await permissions.locator('summary').filter({ hasText: 'Membro' }).click();
  await permissions.getByRole('option', { name: 'Auditor' }).click();
  await permissions.locator('summary').filter({ hasText: 'Somente próprios' }).click();
  await permissions.getByRole('option', { name: 'Todos os arquivos' }).click();
  await permissions.getByRole('checkbox', { name: /Assina só/ }).check();
  expect(permissionsSaved).toBe(0);
  await permissions.getByRole('button', { name: 'Salvar permissões' }).click();
  await expect(permissions.getByRole('status')).toContainText('Perfil e acessos atualizados');
  expect(permissionsSaved).toBe(1);
  expect(rosterSaved).toBe(0);
});
