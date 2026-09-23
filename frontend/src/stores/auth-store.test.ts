import { adminUser, agentUser, authResponse, customerUser } from '@/test/fixtures';
import { can, canAny, PERMISSIONS, SETTINGS_PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from './auth-store';
import type { CurrentUserDto } from '@/types';

describe('can() permission helper', () => {
  it('returns false when not logged in', () => {
    expect(can(null, 'TICKET', 'R')).toBe(false);
    expect(can(undefined, 'TICKET', 'C')).toBe(false);
  });

  it('grants everything to admins even without explicit permissions', () => {
    expect(adminUser.permissions).toHaveLength(0);
    expect(can(adminUser, 'ROLE', 'D')).toBe(true);
    expect(can(adminUser, 'ANY_UNKNOWN_CODE', 'U')).toBe(true);
  });

  it('checks the specific C/R/U/D flag of the activity', () => {
    expect(can(agentUser, 'TICKET', 'D')).toBe(true);
    expect(can(agentUser, 'TICKET_ASSIGN', 'U')).toBe(true);
    expect(can(agentUser, 'TICKET_ASSIGN', 'C')).toBe(false);
    expect(can(agentUser, 'USER', 'R')).toBe(false);

    expect(can(customerUser, 'TICKET', 'C')).toBe(true);
    expect(can(customerUser, 'TICKET', 'R')).toBe(false);
    expect(can(customerUser, 'REPORT', 'R')).toBe(false);
  });

  it('works for a user with only individual (UserActivity) permissions', () => {
    const user: CurrentUserDto = {
      ...customerUser,
      roles: [],
      permissions: [{ code: 'SLA_POLICY', c: false, r: false, u: true, d: false }],
    };
    expect(can(user, 'SLA_POLICY', 'U')).toBe(true);
    expect(can(user, 'SLA_POLICY', 'R')).toBe(false);
    expect(canAny(user, SETTINGS_PERMISSIONS)).toBe(true);
    expect(canAny(customerUser, SETTINGS_PERMISSIONS)).toBe(false);
  });

  it('store.can() reflects the current session and resets on logout', () => {
    const store = useAuthStore.getState();
    expect(store.can('TICKET', 'C')).toBe(false);
    store.setSession(authResponse(agentUser));
    expect(useAuthStore.getState().can('REPORT', 'R')).toBe(true);
    useAuthStore.getState().setUser({ ...agentUser, permissions: [] });
    expect(useAuthStore.getState().can('REPORT', 'R')).toBe(false);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().can('REPORT', 'R')).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('route / menu permission gates', () => {
  it('customer sees neither Dashboard, My Queue, Settings nor API Logs; agent sees Dashboard + My Queue', () => {
    expect(canAny(customerUser, PERMISSIONS.dashboard)).toBe(false);
    expect(canAny(customerUser, PERMISSIONS.myQueue)).toBe(false);
    expect(canAny(customerUser, PERMISSIONS.apiLogs)).toBe(false);
    expect(canAny(customerUser, PERMISSIONS.createTicket)).toBe(true);
    expect(canAny(agentUser, PERMISSIONS.dashboard)).toBe(true);
    expect(canAny(agentUser, PERMISSIONS.myQueue)).toBe(true);
    expect(canAny(agentUser, PERMISSIONS.settings)).toBe(false);
    expect(canAny(adminUser, PERMISSIONS.apiLogs)).toBe(true);
  });

  it('an empty requirement list means "any logged-in user"', () => {
    expect(canAny(customerUser, [])).toBe(true);
    expect(canAny(null, [])).toBe(false);
  });
});
