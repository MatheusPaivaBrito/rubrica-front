import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TeamPageComponent, shouldLeaveTeamPage } from './team-page.component';
import type { TenantMember, TenantTeam } from '../core/models';

function team(memberLimit: number | null, requiresSelection: boolean): TenantTeam {
  return {
    current_member_id: 'admin', member_limit: memberLimit,
    active_count: memberLimit === null ? 12 : requiresSelection ? memberLimit + 1 : memberLimit,
    requires_selection: requiresSelection, can_manage: true, members: [],
    current_seat_member_ids: [], next_cycle_member_ids: [],
    next_cycle_starts_at: null, seat_roster_locked: true,
  };
}

describe('shouldLeaveTeamPage', () => {
  it('keeps the team page open after a downgrade until excess members are suspended', () => {
    expect(shouldLeaveTeamPage(team(1, true))).toBe(false);
  });

  it('leaves the team page when a single-member plan is already regularized', () => {
    expect(shouldLeaveTeamPage(team(1, false))).toBe(true);
  });

  it('keeps the team page available for multi-member plans', () => {
    expect(shouldLeaveTeamPage(team(3, false))).toBe(false);
  });

  it('keeps the team page available for unlimited lifetime tenants', () => {
    expect(shouldLeaveTeamPage(team(null, false))).toBe(false);
  });
});

describe('saving member permissions', () => {
  const member: TenantMember = {
    id: 'member', auth_user_id: 'member@example.test', role: 'member', status: 'active',
    document_scope: 'own', sign_company_only: false,
  };

  function editor() {
    const updated = team(10, false);
    const patch = vi.fn().mockReturnValue(of(updated));
    const state = {
      tenant: () => ({ id: 'workspace-a', kind: 'business' }),
      api: { patch },
      team: signal(team(10, false)),
      selected: signal(new Set(['admin'])),
      draftRole: signal<TenantMember['role']>('auditor'),
      draftScope: signal<'all' | 'own'>('all'),
      draftCompanyOnly: signal(true),
      permissionsSaved: signal(false),
      permissionError: signal(''),
      saving: signal(false),
      feedback: { message: () => 'Falha temporária' },
      permissionsDirty: TeamPageComponent.prototype.permissionsDirty,
    };
    const save = () => TeamPageComponent.prototype.savePermissions.call(state as unknown as TeamPageComponent, member);
    return { state, patch, updated, save };
  }

  it('keeps the draft and next-cycle selections after a failed request and allows retry', async () => {
    const { state, patch, updated, save } = editor();
    patch.mockReturnValueOnce(throwError(() => new Error('temporary')));
    await save();

    expect(state.permissionError()).toBe('Falha temporária');
    expect(state.saving()).toBe(false);
    expect(state.permissionsSaved()).toBe(false);
    expect(state.draftScope()).toBe('all');
    expect(state.selected()).toEqual(new Set(['admin']));
    expect(state.team()).not.toBe(updated);

    await save();
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenLastCalledWith('/tenants/workspace-a/team/member/role', {
      role: 'auditor', document_scope: 'all', sign_company_only: true,
    });
    expect(state.team()).toBe(updated);
    expect(state.permissionsSaved()).toBe(true);
    expect(state.permissionError()).toBe('');
    expect(state.selected()).toEqual(new Set(['admin']));
  });

  it('omits file and signing restrictions when promoting a member to admin', async () => {
    const { state, patch, save } = editor();
    state.draftRole.set('admin');
    await save();
    expect(patch).toHaveBeenCalledWith('/tenants/workspace-a/team/member/role', {
      role: 'admin', document_scope: undefined, sign_company_only: undefined,
    });
  });

  it('sends no request for unchanged permissions', async () => {
    const { state, patch, save } = editor();
    state.draftRole.set('member');
    state.draftScope.set('own');
    state.draftCompanyOnly.set(false);
    await save();
    expect(patch).not.toHaveBeenCalled();
  });
});
