import { shouldLeaveTeamPage } from './team-page.component';
import type { TenantTeam } from '../core/models';

function team(memberLimit: number, requiresSelection: boolean): TenantTeam {
  return {
    current_member_id: 'admin', member_limit: memberLimit,
    active_count: requiresSelection ? memberLimit + 1 : memberLimit,
    requires_selection: requiresSelection, can_manage: true, members: [],
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
});
