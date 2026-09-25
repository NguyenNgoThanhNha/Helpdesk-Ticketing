import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { realtime } from '@/lib/realtime';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { agentUser } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/render';
import { hubMock } from '@/test/signalr-mock';
import type { NotificationDto } from '@/types';
import { NotificationBell } from '../components/notification-bell';
import { UNREAD_POLL_INTERVAL, UNREAD_POLL_INTERVAL_CONNECTED, useUnreadCount } from './use-notifications';
import { useRealtimeNotifications } from './use-realtime-notifications';

const existing: NotificationDto[] = [
  { id: 1, message: 'Bạn được gán ticket #1024', ticketId: 1024, isRead: false, createdAt: '2026-09-20T10:00:00Z' },
  { id: 2, message: 'Ticket #1023 có trả lời mới', ticketId: 1023, isRead: false, createdAt: '2026-09-20T09:00:00Z' },
];
const pushed: NotificationDto = {
  id: 3,
  message: 'Ticket #1025 vừa được gán cho bạn',
  ticketId: 1025,
  isRead: false,
  createdAt: '2026-09-20T11:00:00Z',
};

async function connect() {
  act(() => realtime.start());
  await waitFor(() => expect(realtime.getState().status).toBe('connected'));
  return hubMock.current;
}

function mockApi() {
  const requests = { count: 0, list: 0, markRead: [] as number[] };
  server.use(
    http.get(`${API}/notifications/unread-count`, () => {
      requests.count++;
      return HttpResponse.json({ count: 2 });
    }),
    http.get(`${API}/notifications`, () => {
      requests.list++;
      return HttpResponse.json(existing);
    }),
    http.post(`${API}/notifications/:id/read`, ({ params }) => {
      requests.markRead.push(Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

function Shell() {
  useRealtimeNotifications();
  return <NotificationBell />;
}

describe('useRealtimeNotifications', () => {
  it('a pushed notification bumps the badge, is prepended to the list and toasts a link to the ticket', async () => {
    loginAs(agentUser);
    const requests = mockApi();
    const user = userEvent.setup();
    renderWithProviders(<Shell />, {
      path: '/',
      route: '/',
      extraRoutes: [{ path: '/tickets/:id', element: <Shell /> }],
    });
    expect(await screen.findByTestId('unread-count')).toHaveTextContent('2');
    // load the bell's list
    await user.click(screen.getByRole('button', { name: 'Thông báo (2 chưa đọc)' }));
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(2);

    const hub = await connect();
    const countRequests = requests.count;
    act(() => hub.emit('notification', pushed));

    // optimistic: no request needed
    await waitFor(() => expect(screen.getByTestId('unread-count')).toHaveTextContent('3'));
    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(pushed.message);
    expect(requests.count).toBe(countRequests);

    // toast with an action opening the ticket (and marking the notification read)
    const toasts = screen.getByRole('region', { name: /Thông báo nhanh/ });
    expect(await within(toasts).findByText(pushed.message)).toBeInTheDocument();
    await user.click(within(toasts).getByRole('button', { name: 'Xem ticket' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets/1025'));
    await waitFor(() => expect(requests.markRead).toEqual([3]));
  });

  it('a notification without a ticket toasts without an action; the same notification is not counted twice', async () => {
    loginAs(agentUser);
    mockApi();
    renderWithProviders(<Shell />);
    expect(await screen.findByTestId('unread-count')).toHaveTextContent('2');
    const hub = await connect();

    const general = { ...pushed, id: 4, ticketId: null, message: 'Hệ thống bảo trì lúc 22:00' };
    act(() => hub.emit('notification', general));
    const toasts = screen.getByRole('region', { name: /Thông báo nhanh/ });
    const toast = (await within(toasts).findByText(general.message)).closest('li')!;
    expect(within(toast).queryByRole('button', { name: 'Xem ticket' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('unread-count')).toHaveTextContent('3'));
  });

  it('refetches the notifications after a reconnect (pushes may have been missed)', async () => {
    loginAs(agentUser);
    const requests = mockApi();
    renderWithProviders(<Shell />);
    await screen.findByTestId('unread-count');
    const hub = await connect();
    const before = requests.count;

    act(() => hub.simulateReconnecting());
    act(() => hub.simulateReconnected());
    await waitFor(() => expect(requests.count).toBe(before + 1));
  });
});

/** waitFor() polls with setInterval, which this test fakes; poll with real timeouts instead. */
async function until(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('condition not met in time');
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
}

describe('unread-count polling vs. connection state', () => {
  afterEach(() => {
    vi.useRealTimers();
    act(() => focusManager.setFocused(undefined));
  });

  it('polls every 30s without a connection, every 5 minutes while connected, and every 30s again while reconnecting', async () => {
    loginAs(agentUser);
    let calls = 0;
    server.use(
      http.get(`${API}/notifications/unread-count`, async () => {
        calls++;
        await delay(0);
        return HttpResponse.json({ count: calls });
      }),
    );
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const client = createQueryClient({ retry: false });
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await until(() => result.current.data === 1);

    // not connected: 30s
    act(() => vi.advanceTimersByTime(UNREAD_POLL_INTERVAL));
    await until(() => calls === 2);

    // connected: pushes keep the badge current, polling slows down to 5 minutes
    act(() => realtime.start());
    await until(() => realtime.getState().status === 'connected');
    const hub = hubMock.current;
    act(() => vi.advanceTimersByTime(UNREAD_POLL_INTERVAL * 2));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls).toBe(2);
    act(() => vi.advanceTimersByTime(UNREAD_POLL_INTERVAL_CONNECTED - UNREAD_POLL_INTERVAL * 2));
    await until(() => calls === 3);

    // connection dropped: back to 30s
    act(() => hub.simulateReconnecting());
    act(() => vi.advanceTimersByTime(UNREAD_POLL_INTERVAL));
    await until(() => calls === 4);
  });
});
