import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';
import { hubMock } from './signalr-mock';
import { realtime } from '@/lib/realtime';
import { useAuthStore } from '@/stores/auth-store';

// No test opens a real SignalR connection: the builder is replaced by an in-memory fake (see signalr-mock.ts);
// the rest of the package (enums, error types) stays real.
vi.mock('@microsoft/signalr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@microsoft/signalr')>()),
  HubConnectionBuilder: (await import('./signalr-mock')).HubConnectionBuilder,
}));

configure({ asyncUtilTimeout: 5000 });

// ---- jsdom polyfills needed by Radix UI / cmdk / recharts ----
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Radix Select / Popover use pointer capture and scrollIntoView, which jsdom does not implement
const proto = window.HTMLElement.prototype as HTMLElement & Record<string, unknown>;
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.scrollIntoView ??= () => {};

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock');
  window.URL.revokeObjectURL = vi.fn();
}

// ---- MSW ----
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  cleanup();
  await realtime.stop();
  hubMock.reset();
  server.resetHandlers();
  useAuthStore.getState().logout();
  localStorage.clear();
});
afterAll(() => server.close());
