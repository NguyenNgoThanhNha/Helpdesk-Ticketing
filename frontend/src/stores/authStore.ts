import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActivityAction, AuthResponse, CurrentUserDto } from '@/types';

export const AUTH_STORAGE_KEY = 'helpdesk-auth';

/** [activityCode, action], e.g. ['TICKET', 'R'] */
export type PermissionRequirement = readonly [code: string, action: ActivityAction];

const ACTION_KEY: Record<ActivityAction, 'c' | 'r' | 'u' | 'd'> = { C: 'c', R: 'r', U: 'u', D: 'd' };

/** Pure permission check: Admin → everything; otherwise the effective permission flag. */
export function can(user: CurrentUserDto | null | undefined, code: string, action: ActivityAction): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const key = ACTION_KEY[action];
  return user.permissions.some((p) => p.code === code && p[key]);
}

/** true when the user satisfies at least one of the requirements. */
export function canAny(user: CurrentUserDto | null | undefined, requirements: readonly PermissionRequirement[]) {
  return requirements.some(([code, action]) => can(user, code, action));
}

/** Settings page is visible when the user can manage at least one of its tabs. */
export const SETTINGS_PERMISSIONS: readonly PermissionRequirement[] = [
  ['CATEGORY', 'C'],
  ['CATEGORY', 'U'],
  ['SLA_POLICY', 'U'],
  ['USER', 'R'],
  ['ROLE', 'R'],
];

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  user: CurrentUserDto | null;
  setSession: (auth: AuthResponse) => void;
  setUser: (user: CurrentUserDto) => void;
  logout: () => void;
  /** Permission check for the current user. */
  can: (code: string, action: ActivityAction) => boolean;
}

const empty = {
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  user: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...empty,
      setSession: (auth) =>
        set({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          accessTokenExpiresAt: auth.accessTokenExpiresAt,
          user: auth.user,
        }),
      setUser: (user) => set({ user }),
      logout: () => set({ ...empty }),
      can: (code, action) => can(get().user, code, action),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        accessTokenExpiresAt: s.accessTokenExpiresAt,
        user: s.user,
      }),
    },
  ),
);

export const useIsAuthenticated = () => useAuthStore((s) => !!s.accessToken && !!s.user);

export const useCurrentUser = () => useAuthStore((s) => s.user);

/** Reactive permission check (re-renders when the user / permissions change). */
export const useCan = (code: string, action: ActivityAction) => useAuthStore((s) => can(s.user, code, action));

/** Reactive "any of" permission check. */
export const useCanAny = (requirements: readonly PermissionRequirement[]) =>
  useAuthStore((s) => canAny(s.user, requirements));
