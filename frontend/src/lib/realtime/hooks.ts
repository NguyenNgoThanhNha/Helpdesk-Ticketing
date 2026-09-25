import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { realtime, type RealtimeState, type RealtimeStatus } from './realtime-client';

/** Current connection state (re-renders on change). */
export function useRealtimeState(): RealtimeState {
  return useSyncExternalStore(realtime.subscribeState, realtime.getState, realtime.getState);
}

export function useRealtimeStatus(): RealtimeStatus {
  return useRealtimeState().status;
}

/** Keeps the latest callback in a ref so subscriptions don't churn on every render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Subscribes to a server → client hub event for the lifetime of the component. */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const latest = useLatest(handler);
  useEffect(() => realtime.on<T>(event, (payload) => latest.current(payload)), [event, latest]);
}

/** Runs after the connection came back (automatic reconnect or restart), e.g. to refetch what may have been missed. */
export function useRealtimeReconnected(handler: () => void) {
  const latest = useLatest(handler);
  useEffect(() => realtime.onReconnected(() => latest.current()), [latest]);
}

/**
 * Keeps the hub connection open while a user is signed in: starts after login / on app load with a session,
 * stops on logout (or when another user signs in, so the new connection carries the new identity).
 * Mount once, in the authenticated layout.
 */
export function useRealtimeConnection() {
  const userId = useAuthStore((s) => (s.accessToken && s.user ? s.user.id : null));
  useEffect(() => {
    if (!userId) return;
    realtime.start();
    return () => {
      void realtime.stop();
    };
  }, [userId]);
}
