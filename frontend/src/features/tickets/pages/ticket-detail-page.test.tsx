import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { realtime } from '@/lib/realtime';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { agentUser, customerUser, ticketDetail } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/render';
import { hubMock } from '@/test/signalr-mock';
import { chooseSelectOption } from '@/test/ui';
import type { TicketChangedEvent, UpdateTicketRequest } from '@/types';
import { EMPTY_REPLY_MESSAGE } from '../components/reply-box';
import { TICKET_CHANGED_MESSAGE } from '../hooks/use-ticket-realtime';
import { CONFLICT_MESSAGE, TicketDetailPage } from './ticket-detail-page';

const renderDetail = () => renderWithProviders(<TicketDetailPage />, { path: '/tickets/:id', route: '/tickets/1024' });

async function connect() {
  act(() => realtime.start());
  await waitFor(() => expect(realtime.getState().status).toBe('connected'));
  return hubMock.current;
}

/** Counts GET /tickets/:id and GET /tickets/:id/history requests. */
function countTicketRequests() {
  const counts = { detail: 0, history: 0 };
  server.use(
    http.get(`${API}/tickets/:id`, ({ params }) => {
      counts.detail++;
      return HttpResponse.json(ticketDetail({ id: Number(params.id), rowVersion: `v${counts.detail}` }));
    }),
    http.get(`${API}/tickets/:id/history`, () => {
      counts.history++;
      return HttpResponse.json([]);
    }),
  );
  return counts;
}

const toastRegion = () => screen.getByRole('region', { name: /Thông báo nhanh/ });

describe('TicketDetailPage', () => {
  it('shows comments with requester / support badges, history ("Hệ thống") and hides actions the user cannot perform', async () => {
    loginAs(customerUser);
    server.use(
      http.get(`${API}/tickets/:id`, () =>
        HttpResponse.json(
          ticketDetail({
            allowedTransitions: [],
            canChangePriority: false,
            canAssign: false,
            canComment: true,
            comments: [
              {
                id: 1,
                author: { id: customerUser.id, fullName: 'Khách Hàng' },
                isFromRequester: true,
                body: 'Tôi không đăng nhập được',
                createdAt: '2026-09-20T10:02:00Z',
                attachments: [],
              },
              {
                id: 2,
                author: { id: agentUser.id, fullName: 'An Agent' },
                isFromRequester: false,
                body: 'Anh thử reset mật khẩu giúp em',
                createdAt: '2026-09-20T10:15:00Z',
                attachments: [
                  { id: 7, fileName: 'guide.pdf', contentType: 'application/pdf', size: 2048, commentId: 2, uploadedAt: '2026-09-20T10:15:00Z' },
                ],
              },
            ],
          }),
        ),
      ),
      http.get(`${API}/tickets/:id/history`, () =>
        HttpResponse.json([
          { id: 3, field: 'Status', oldValue: 'New', newValue: 'Open', changedBy: { id: agentUser.id, fullName: 'An Agent' }, changedAt: '2026-09-20T10:10:00Z' },
          { id: 2, field: 'Sla', oldValue: 'OnTrack', newValue: 'AtRisk', changedBy: null, changedAt: '2026-09-20T12:00:00Z' },
          { id: 1, field: 'Created', oldValue: null, newValue: null, changedBy: { id: customerUser.id, fullName: 'Khách Hàng' }, changedAt: '2026-09-20T09:50:00Z' },
        ]),
      ),
    );
    renderDetail();

    expect(await screen.findByText('Anh thử reset mật khẩu giúp em')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên hỗ trợ')).toBeInTheDocument();
    expect(screen.getAllByText('Khách hàng').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /guide\.pdf/ })).toBeInTheDocument();
    // read-only header: status / priority badges and the assignee name instead of editors
    expect(screen.queryByRole('combobox', { name: 'Đổi trạng thái' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Đổi ưu tiên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Gán người xử lý' })).not.toBeInTheDocument();
    const actions = screen.getByRole('group', { name: 'Thao tác ticket' });
    expect(within(actions).getByTestId('status-badge')).toHaveTextContent('Đang mở');
    expect(within(actions).getByTestId('priority-badge')).toHaveTextContent('Cao');
    expect(within(actions).getByTestId('assignee')).toHaveTextContent('Người xử lý:An Agent');
    expect(screen.getByLabelText('Nội dung trả lời')).toBeInTheDocument();
    // history: system entries and enum values in Vietnamese
    const history = await screen.findByRole('list', { name: 'Lịch sử thay đổi' });
    expect(within(history).getByText(/Hệ thống/)).toBeInTheDocument();
    expect(within(history).getByText('Đổi trạng thái:', { exact: false })).toHaveTextContent('Đổi trạng thái: Mới → Đang mở');
    expect(within(history).getByText('SLA:', { exact: false })).toHaveTextContent('SLA: Còn hạn → Sắp hết hạn');
  });

  it('sends rowVersion on PATCH and, on 409, warns and reloads the ticket', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    let getCount = 0;
    let patchBody: UpdateTicketRequest | null = null;
    server.use(
      http.get(`${API}/tickets/:id`, () => {
        getCount++;
        return HttpResponse.json(ticketDetail({ rowVersion: `v${getCount}` }));
      }),
      http.patch(`${API}/tickets/:id`, async ({ request }) => {
        patchBody = (await request.json()) as UpdateTicketRequest;
        return HttpResponse.json({ title: 'Conflict', status: 409 }, { status: 409 });
      }),
    );
    renderDetail();
    expect(await screen.findByRole('combobox', { name: 'Đổi trạng thái' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Đổi ưu tiên' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Gán người xử lý' })).toBeInTheDocument();

    await chooseSelectOption(user, 'Đổi trạng thái', 'Đang xử lý');

    await waitFor(() => expect(patchBody).toEqual({ rowVersion: 'v1', status: 'InProgress' }));
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(2));
  });

  it('puts the status / priority / assign actions in the header, right after the title and before the conversation', async () => {
    loginAs(agentUser);
    renderDetail();
    const heading = await screen.findByRole('heading', { level: 1, name: 'Ticket #1024 — Không đăng nhập được' });
    const actions = screen.getByRole('group', { name: 'Thao tác ticket' });
    const conversation = screen.getByText(/^Trao đổi/);
    const info = screen.getByText('Thông tin').closest('[data-slot="card"]') as HTMLElement;

    // DOM order = order on a phone: title → actions → conversation
    expect(heading.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions.compareDocumentPosition(conversation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.closest('header')).toContainElement(actions);
    for (const name of ['Đổi trạng thái', 'Đổi ưu tiên', 'Gán người xử lý']) {
      expect(within(actions).getByRole('combobox', { name })).toBeInTheDocument();
    }
    expect(within(actions).getByRole('combobox', { name: 'Đổi trạng thái' })).toHaveTextContent('Trạng thái:Đang mở');
    expect(within(actions).getByRole('combobox', { name: 'Gán người xử lý' })).toHaveTextContent('Người xử lý:An Agent');
    // the info card keeps category / requester / created / SLA only
    expect(within(info).getByText('Danh mục')).toBeInTheDocument();
    expect(within(info).getByText('Người yêu cầu')).toBeInTheDocument();
    expect(within(info).getByText('Ngày tạo')).toBeInTheDocument();
    expect(within(info).getByText('SLA')).toBeInTheDocument();
    expect(within(info).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('empty reply: inline field error instead of a toast, and nothing is sent', async () => {
    loginAs(customerUser);
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post(`${API}/tickets/:id/comments`, () => {
        posted = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderDetail();
    const textarea = await screen.findByLabelText('Nội dung trả lời');
    await user.type(textarea, '   ');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(screen.getByText(EMPTY_REPLY_MESSAGE)).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription(EMPTY_REPLY_MESSAGE);
    expect(textarea).toHaveFocus();
    expect(within(toastRegion()).queryByText(EMPTY_REPLY_MESSAGE)).not.toBeInTheDocument();
    expect(posted).toBe(false);

    // typing clears the error
    await user.type(textarea, 'Đã thử lại');
    expect(screen.queryByText(EMPTY_REPLY_MESSAGE)).not.toBeInTheDocument();
    expect(textarea).not.toHaveAttribute('aria-invalid');
  });
});

describe('TicketDetailPage — realtime', () => {
  it('joins the ticket group on mount and after a reconnect, and leaves it on unmount', async () => {
    loginAs(agentUser);
    const hub = await connect();
    const { unmount } = renderDetail();
    await screen.findByRole('heading', { level: 1 });

    await waitFor(() => expect(hub.calls('JoinTicket')).toEqual([['JoinTicket', 1024]]));

    // groups belong to a connection: re-join once it is re-established
    act(() => hub.simulateReconnecting());
    act(() => hub.simulateReconnected());
    await waitFor(() => expect(hub.calls('JoinTicket')).toHaveLength(2));
    // no LeaveTicket while the connection was down
    expect(hub.calls('LeaveTicket')).toEqual([]);

    unmount();
    expect(hub.calls('LeaveTicket')).toEqual([['LeaveTicket', 1024]]);
  });

  it('joins once the connection comes up when the page was opened before', async () => {
    loginAs(agentUser);
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    const hub = await connect();
    await waitFor(() => expect(hub.calls('JoinTicket')).toEqual([['JoinTicket', 1024]]));
  });

  it('ticketChanged by another user refetches the ticket and its history and shows a toast; own changes do not', async () => {
    loginAs(agentUser);
    const counts = countTicketRequests();
    const hub = await connect();
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(counts).toEqual({ detail: 1, history: 1 }));

    const change = (e: Partial<TicketChangedEvent>) =>
      act(() => hub.emit('ticketChanged', { ticketId: 1024, change: 'updated', actorId: agentUser.id, ...e }));

    // own change (already applied from the PATCH response) and another ticket: ignored
    change({});
    change({ ticketId: 999, actorId: customerUser.id });
    await new Promise((r) => setTimeout(r, 100));
    expect(counts).toEqual({ detail: 1, history: 1 });
    expect(within(toastRegion()).queryByText(TICKET_CHANGED_MESSAGE)).not.toBeInTheDocument();

    // someone else commented
    change({ change: 'commented', actorId: customerUser.id });
    await waitFor(() => expect(counts).toEqual({ detail: 2, history: 2 }));
    expect(await within(toastRegion()).findByText(TICKET_CHANGED_MESSAGE)).toBeInTheDocument();

    // the SLA job (actorId = null) counts as "someone else"
    change({ change: 'sla', actorId: null });
    await waitFor(() => expect(counts).toEqual({ detail: 3, history: 3 }));
  });

  it('ignores the "forbidden" HubException when the user may not watch the ticket', async () => {
    loginAs(customerUser);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error');
    try {
      const hub = await connect();
      hub.invokeImpl = (method) =>
        method === 'JoinTicket'
          ? Promise.reject(new Error("An unexpected error occurred invoking 'JoinTicket' on the server. HubException: forbidden"))
          : Promise.resolve();
      renderDetail();
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
      await waitFor(() => expect(hub.calls('JoinTicket')).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 50));
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(within(toastRegion()).queryByText(/forbidden|JoinTicket/i)).not.toBeInTheDocument();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
