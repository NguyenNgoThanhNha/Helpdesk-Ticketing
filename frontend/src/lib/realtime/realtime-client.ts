import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { useAuthStore } from '@/stores/auth-store';

/** SignalR hub (see API contract "Realtime — SignalR"); proxied by Vite (`/hubs`, ws) and nginx (`location /hubs/`). */
export const HUB_URL: string = import.meta.env.VITE_HUB_URL ?? '/hubs/notifications';

/** Server → client events. */
export const HUB_EVENTS = {
  notification: 'notification',
  ticketChanged: 'ticketChanged',
} as const;

/** Client → server methods. */
export const HUB_METHODS = {
  joinTicket: 'JoinTicket',
  leaveTicket: 'LeaveTicket',
} as const;

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RealtimeState {
  status: RealtimeStatus;
  /**
   * Incremented every time a connection is (re)established. Hub groups (e.g. `JoinTicket`) belong to a connection,
   * so anything joined must be joined again when this changes.
   */
  epoch: number;
}

/**
 * Restart delays used when the first `start()` fails or automatic reconnect gives up (`withAutomaticReconnect`
 * only covers a connection that was established once, and stops after ~42s).
 */
export const RESTART_DELAYS_MS = [5_000, 15_000, 30_000, 60_000] as const;

type Handler = (...args: unknown[]) => void;

/** true for the `HubException("forbidden")` the hub throws when the user may not see a ticket. */
export function isHubForbidden(error: unknown): boolean {
  return error instanceof Error && /\bforbidden\b/i.test(error.message);
}

/**
 * Single hub connection for the signed-in user.
 * - `start()` / `stop()` are idempotent and safe to call in any order (StrictMode, logout while connecting…).
 * - the access token is read from the auth store on every (re)connect, so refreshed tokens are picked up.
 * - event handlers survive reconnects and restarts (they are registered on every new connection).
 */
export class RealtimeClient {
  private connection: HubConnection | null = null;
  private wanted = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private restartAttempt = 0;
  /** a connection was established earlier in this session, so the next one is a reconnect */
  private hadConnection = false;
  private state: RealtimeState = { status: 'disconnected', epoch: 0 };
  private readonly stateListeners = new Set<() => void>();
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly reconnectedListeners = new Set<() => void>();

  constructor(private readonly url: string = HUB_URL) {}

  getState = (): RealtimeState => this.state;

  subscribeState = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  /** Opens the connection (no-op when already open / opening). Deferred by a tick so StrictMode's double effect opens one. */
  start(): void {
    this.wanted = true;
    if (this.connection || this.timer !== undefined) return;
    this.schedule(0);
  }

  /** Closes the connection and cancels pending restarts (logout). */
  stop(): Promise<void> {
    this.wanted = false;
    this.clearTimer();
    this.restartAttempt = 0;
    this.hadConnection = false;
    const connection = this.connection;
    this.connection = null;
    this.setState({ status: 'disconnected' });
    return connection ? connection.stop().catch(() => undefined) : Promise.resolve();
  }

  /** Subscribes to a server → client event; returns the unsubscribe function. */
  on<T>(event: string, handler: (payload: T) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
      if (this.connection) this.listen(this.connection, event);
    }
    const h = handler as Handler;
    set.add(h);
    return () => {
      set.delete(h);
    };
  }

  /** Called after the connection was re-established (not on the first connect): refetch what may have been missed. */
  onReconnected(listener: () => void): () => void {
    this.reconnectedListeners.add(listener);
    return () => this.reconnectedListeners.delete(listener);
  }

  /** Invokes a hub method; rejects when not connected. */
  invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    const connection = this.connection;
    if (!connection || this.state.status !== 'connected') {
      return Promise.reject(new Error(`Realtime is not connected (${method})`));
    }
    return connection.invoke<T>(method, ...args);
  }

  private setState(patch: Partial<RealtimeState>) {
    const next = { ...this.state, ...patch };
    if (next.status === this.state.status && next.epoch === this.state.epoch) return;
    this.state = next;
    this.stateListeners.forEach((l) => l());
  }

  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delay: number) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.connect();
    }, delay);
  }

  private scheduleRestart() {
    if (!this.wanted || this.timer !== undefined) return;
    const delay = RESTART_DELAYS_MS[Math.min(this.restartAttempt, RESTART_DELAYS_MS.length - 1)];
    this.restartAttempt++;
    this.schedule(delay);
  }

  private listen(connection: HubConnection, event: string) {
    connection.on(event, (...args: unknown[]) => {
      if (this.connection !== connection) return; // a stale connection that is being stopped
      this.handlers.get(event)?.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[realtime] "${event}" handler failed`, error);
        }
      });
    });
  }

  private async connect() {
    if (!this.wanted || this.connection) return;
    const connection = new HubConnectionBuilder()
      .withUrl(this.url, {
        // read on every (re)connect: the API client refreshes the access token in the auth store
        accessTokenFactory: () => useAuthStore.getState().accessToken ?? '',
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection = connection;
    this.handlers.forEach((_, event) => this.listen(connection, event));
    connection.onreconnecting(() => {
      if (this.connection === connection) this.setState({ status: 'reconnecting' });
    });
    connection.onreconnected(() => {
      if (this.connection === connection) this.established();
    });
    connection.onclose(() => {
      if (this.connection !== connection) return; // stopped on purpose
      // automatic reconnect gave up, or the server closed the connection
      this.connection = null;
      this.setState({ status: 'disconnected' });
      this.scheduleRestart();
    });

    this.setState({ status: 'connecting' });
    try {
      await connection.start();
    } catch {
      if (this.connection !== connection) return; // stopped while connecting
      this.connection = null;
      this.setState({ status: 'disconnected' });
      this.scheduleRestart();
      return;
    }
    if (this.connection === connection) this.established();
  }

  private established() {
    const isReconnect = this.hadConnection;
    this.hadConnection = true;
    this.restartAttempt = 0;
    this.setState({ status: 'connected', epoch: this.state.epoch + 1 });
    if (isReconnect) {
      this.reconnectedListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error('[realtime] reconnected listener failed', error);
        }
      });
    }
  }
}

/** The app-wide connection (started by `useRealtimeConnection` in the authenticated layout). */
export const realtime = new RealtimeClient();
