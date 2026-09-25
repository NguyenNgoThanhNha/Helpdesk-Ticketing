/**
 * In-memory stand-in for `@microsoft/signalr`'s HubConnectionBuilder / HubConnection (registered for every test in
 * setup.ts, so nothing ever opens a socket). Tests drive the "server" through `hubMock`:
 *
 *   hubMock.current.emit('notification', dto)      // server → client event
 *   hubMock.current.simulateReconnecting()          // network drop
 *   hubMock.current.invoke.mock.calls               // client → server calls (JoinTicket / LeaveTicket)
 */
import { vi } from 'vitest';
import type { HubConnection, IHttpConnectionOptions } from '@microsoft/signalr';

type Callback = (...args: unknown[]) => void;
type FakeState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting';

export class FakeHubConnection {
  state: FakeState = 'Disconnected';
  private readonly handlers = new Map<string, Set<Callback>>();
  private readonly closed: Callback[] = [];
  private readonly reconnecting: Callback[] = [];
  private readonly reconnected: Callback[] = [];

  constructor(
    readonly url: string,
    readonly options: IHttpConnectionOptions,
    readonly automaticReconnect: boolean,
  ) {}

  /** Server-side behaviour of hub methods (default: succeed with no result). */
  invokeImpl: (method: string, ...args: unknown[]) => Promise<unknown> = () => Promise.resolve(undefined);

  start = vi.fn(async () => {
    this.state = 'Connecting';
    await Promise.resolve();
    if (hubMock.failStart) {
      this.state = 'Disconnected';
      throw new Error('Failed to complete negotiation with the server');
    }
    this.state = 'Connected';
  });

  stop = vi.fn(async () => {
    const wasOpen = this.state !== 'Disconnected';
    this.state = 'Disconnected';
    if (wasOpen) this.closed.forEach((cb) => cb());
  });

  invoke = vi.fn((method: string, ...args: unknown[]) => this.invokeImpl(method, ...args));

  on(event: string, cb: Callback) {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(cb);
  }

  off(event: string, cb?: Callback) {
    if (cb) this.handlers.get(event)?.delete(cb);
    else this.handlers.delete(event);
  }

  onclose(cb: Callback) {
    this.closed.push(cb);
  }

  onreconnecting(cb: Callback) {
    this.reconnecting.push(cb);
  }

  onreconnected(cb: Callback) {
    this.reconnected.push(cb);
  }

  // ---- test helpers ----

  /** The token the connection would send (`accessTokenFactory()`). */
  accessToken() {
    return this.options.accessTokenFactory?.();
  }

  /** Server → client message. */
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((cb) => cb(...args));
  }

  simulateReconnecting(error = new Error('WebSocket closed')) {
    this.state = 'Reconnecting';
    this.reconnecting.forEach((cb) => cb(error));
  }

  simulateReconnected() {
    this.state = 'Connected';
    this.reconnected.forEach((cb) => cb('reconnected-id'));
  }

  /** The connection is lost for good (automatic reconnect gave up). */
  simulateClose(error = new Error('Reconnect retries have been exhausted')) {
    this.state = 'Disconnected';
    this.closed.forEach((cb) => cb(error));
  }

  /** Hub method calls, e.g. [['JoinTicket', 1024]]. */
  calls(method?: string) {
    return this.invoke.mock.calls.filter(([m]) => !method || m === method);
  }
}

export const hubMock = {
  /** every connection built, oldest first */
  connections: [] as FakeHubConnection[],
  /** make `start()` reject (hub not reachable) */
  failStart: false,
  get current(): FakeHubConnection {
    const c = this.connections[this.connections.length - 1];
    if (!c) throw new Error('No hub connection was built');
    return c;
  },
  reset() {
    this.connections.length = 0;
    this.failStart = false;
  },
};

export class HubConnectionBuilder {
  private url = '';
  private options: IHttpConnectionOptions = {};
  private automaticReconnect = false;

  withUrl(url: string, options: IHttpConnectionOptions = {}) {
    this.url = url;
    this.options = options;
    return this;
  }

  withAutomaticReconnect() {
    this.automaticReconnect = true;
    return this;
  }

  configureLogging() {
    return this;
  }

  build(): HubConnection {
    const connection = new FakeHubConnection(this.url, this.options, this.automaticReconnect);
    hubMock.connections.push(connection);
    return connection as unknown as HubConnection;
  }
}
