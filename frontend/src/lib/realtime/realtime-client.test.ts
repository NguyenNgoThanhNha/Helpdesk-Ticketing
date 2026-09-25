import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { agentUser, authResponse } from '@/test/fixtures';
import { loginAs } from '@/test/render';
import { hubMock } from '@/test/signalr-mock';
import { useAuthStore } from '@/stores/auth-store';
import { isHubForbidden, realtime, RESTART_DELAYS_MS } from './realtime-client';

const connected = () => waitFor(() => expect(realtime.getState().status).toBe('connected'));

describe('realtime client (SignalR connection manager)', () => {
  it('connects to /hubs/notifications with automatic reconnect, no credentials and the CURRENT access token', async () => {
    loginAs(agentUser);
    realtime.start();
    realtime.start(); // idempotent
    await connected();

    expect(hubMock.connections).toHaveLength(1);
    const hub = hubMock.current;
    expect(hub.url).toBe('/hubs/notifications');
    expect(hub.automaticReconnect).toBe(true);
    expect(hub.options.withCredentials).toBe(false);
    expect(hub.accessToken()).toBe('access-1');

    // the API client refreshed the token: the next (re)connect must use the new one
    useAuthStore.getState().setSession(authResponse(agentUser, '2'));
    expect(hub.accessToken()).toBe('access-2');
  });

  it('exposes the connection state and bumps the epoch on every (re)connection', async () => {
    loginAs(agentUser);
    const states: string[] = [];
    const unsubscribe = realtime.subscribeState(() => states.push(realtime.getState().status));
    realtime.start();
    await connected();
    const epoch = realtime.getState().epoch;

    const onReconnected = vi.fn();
    const off = realtime.onReconnected(onReconnected);
    hubMock.current.simulateReconnecting();
    expect(realtime.getState().status).toBe('reconnecting');
    hubMock.current.simulateReconnected();
    expect(realtime.getState()).toEqual({ status: 'connected', epoch: epoch + 1 });
    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected']);
    off();
    unsubscribe();
  });

  it('dispatches server events to subscribers and survives reconnects', async () => {
    loginAs(agentUser);
    const handler = vi.fn();
    const off = realtime.on('notification', handler);
    realtime.start();
    await connected();

    hubMock.current.emit('notification', { id: 1 });
    expect(handler).toHaveBeenCalledWith({ id: 1 });
    off();
    hubMock.current.emit('notification', { id: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stop() closes the connection; invoke() rejects while disconnected', async () => {
    loginAs(agentUser);
    realtime.start();
    await connected();
    const hub = hubMock.current;

    await realtime.invoke('JoinTicket', 5);
    expect(hub.calls('JoinTicket')).toEqual([['JoinTicket', 5]]);

    await realtime.stop();
    expect(hub.stop).toHaveBeenCalled();
    expect(realtime.getState().status).toBe('disconnected');
    await expect(realtime.invoke('JoinTicket', 5)).rejects.toThrow(/not connected/);
  });

  it('stop() before the deferred start opens nothing (StrictMode mount → unmount → mount opens one connection)', async () => {
    loginAs(agentUser);
    realtime.start();
    void realtime.stop();
    realtime.start();
    await connected();
    expect(hubMock.connections).toHaveLength(1);
  });

  it('retries with a backoff when the hub cannot be reached, and when automatic reconnect gives up', async () => {
    loginAs(agentUser);
    vi.useFakeTimers();
    try {
      hubMock.failStart = true;
      realtime.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(hubMock.connections).toHaveLength(1);
      expect(realtime.getState().status).toBe('disconnected');

      hubMock.failStart = false;
      await vi.advanceTimersByTimeAsync(RESTART_DELAYS_MS[0]);
      expect(hubMock.connections).toHaveLength(2);
      expect(realtime.getState().status).toBe('connected');

      const onReconnected = vi.fn();
      const off = realtime.onReconnected(onReconnected);
      hubMock.current.simulateClose();
      expect(realtime.getState().status).toBe('disconnected');
      await vi.advanceTimersByTimeAsync(RESTART_DELAYS_MS[0]);
      expect(hubMock.connections).toHaveLength(3);
      expect(realtime.getState().status).toBe('connected');
      // a restart after a lost connection counts as a reconnect (notifications may have been missed)
      expect(onReconnected).toHaveBeenCalledTimes(1);
      off();
    } finally {
      vi.useRealTimers();
    }
  });

  it('recognises the hub\'s "forbidden" HubException', () => {
    expect(
      isHubForbidden(new Error("An unexpected error occurred invoking 'JoinTicket' on the server. HubException: forbidden")),
    ).toBe(true);
    expect(isHubForbidden(new Error('Invocation canceled due to the underlying connection being closed.'))).toBe(false);
  });
});
