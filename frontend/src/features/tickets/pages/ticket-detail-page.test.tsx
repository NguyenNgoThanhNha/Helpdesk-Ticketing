import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { agentUser, customerUser, ticketDetail } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/render';
import { chooseSelectOption } from '@/test/ui';
import type { UpdateTicketRequest } from '@/types';
import { CONFLICT_MESSAGE, TicketDetailPage } from './ticket-detail-page';

const renderDetail = () => renderWithProviders(<TicketDetailPage />, { path: '/tickets/:id', route: '/tickets/1024' });

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
    expect(screen.getByRole('combobox', { name: 'Đổi trạng thái' })).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Đổi ưu tiên' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Gán người xử lý' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nội dung trả lời')).toBeInTheDocument();
    expect(await screen.findByText(/Hệ thống/)).toBeInTheDocument();
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

    await chooseSelectOption(user, 'Đổi trạng thái', 'In Progress');

    await waitFor(() => expect(patchBody).toEqual({ rowVersion: 'v1', status: 'InProgress' }));
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(2));
  });
});
