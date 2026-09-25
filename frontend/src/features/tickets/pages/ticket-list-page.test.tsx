import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { useLocation } from 'react-router-dom';
import { agentUser, customerUser, ticketDetail, ticketItems } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/render';
import { chooseSelectOption } from '@/test/ui';
import { TicketListPage } from './ticket-list-page';

/** Captures query strings of GET /tickets requests. */
function captureTicketRequests() {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/tickets`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      const status = params.get('status');
      const items = status ? ticketItems.filter((t) => t.status === status) : ticketItems;
      return HttpResponse.json({ items, totalCount: items.length, page: 1, pageSize: 20 });
    }),
  );
  return calls;
}

describe('TicketListPage', () => {
  it('renders rows, badges and the SLA icon returned by the API', async () => {
    loginAs(agentUser);
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });

    expect(await screen.findByText('Không đăng nhập được')).toBeInTheDocument();
    expect(screen.getByText('Lỗi xuất hóa đơn')).toBeInTheDocument();
    expect(screen.getByText('#1024')).toBeInTheDocument();
    expect(screen.getByLabelText(/^SLA: Sắp hết hạn \(At risk\)/)).toBeInTheDocument();
    expect(screen.getByText('Tổng: 2')).toBeInTheDocument();
    // Assignee filter + Created by column are visible for staff (TICKET:R)
    expect(screen.getByRole('combobox', { name: 'Lọc theo người xử lý' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Created by' })).toBeInTheDocument();
  });

  it('reads filters from the URL and sends them to the API', async () => {
    loginAs(agentUser);
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, {
      path: '/tickets',
      route: '/tickets?status=InProgress&priority=Medium&search=hóa%20đơn&page=2&sort=priority_desc',
    });
    expect(await screen.findByText('Lỗi xuất hóa đơn')).toBeInTheDocument();
    const last = calls[calls.length - 1];
    expect(last.get('status')).toBe('InProgress');
    expect(last.get('priority')).toBe('Medium');
    expect(last.get('search')).toBe('hóa đơn');
    expect(last.get('page')).toBe('2');
    expect(last.get('sort')).toBe('priority_desc');
    expect(screen.getByRole('columnheader', { name: /Priority/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('changing the status filter updates the URL and re-queries the API', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets?page=3' });
    expect(await screen.findByText('Lỗi xuất hóa đơn')).toBeInTheDocument();

    await chooseSelectOption(user, 'Lọc theo trạng thái', 'Open');

    // filter change resets paging
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/tickets\?status=Open$/));
    await waitFor(() => expect(calls.some((c) => c.get('status') === 'Open')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Lỗi xuất hóa đơn')).not.toBeInTheDocument());
    expect(screen.getByText('Không đăng nhập được')).toBeInTheDocument();
  });

  it('search box and column sorting write to the URL', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    await screen.findByText('Lỗi xuất hóa đơn');

    await user.type(screen.getByPlaceholderText('Tìm theo tiêu đề / mô tả'), 'login{Enter}');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets?search=login'));
    await waitFor(() => expect(calls.some((c) => c.get('search') === 'login')).toBe(true));

    await user.click(screen.getByRole('button', { name: /Title/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('sort=title_asc'));
    await waitFor(() => expect(calls.some((c) => c.get('sort') === 'title_asc')).toBe(true));
  });

  it('My Queue always queries assigneeId=me and hides the assignee filter; customers never see it', async () => {
    loginAs(agentUser);
    const calls = captureTicketRequests();
    const { unmount } = renderWithProviders(<TicketListPage mode="queue" />, { path: '/my-queue', route: '/my-queue' });
    await screen.findByText('My Queue');
    await waitFor(() => expect(calls.some((c) => c.get('assigneeId') === 'me')).toBe(true));
    expect(screen.queryByRole('combobox', { name: 'Lọc theo người xử lý' })).not.toBeInTheDocument();
    unmount();

    loginAs(customerUser);
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    await screen.findByText('Không đăng nhập được');
    expect(screen.queryByRole('combobox', { name: 'Lọc theo người xử lý' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Created by' })).not.toBeInTheDocument();
    // customers have TICKET:C
    expect(screen.getByRole('button', { name: /New Ticket/ })).toBeInTheDocument();
  });

  it('clicking a row navigates to the ticket detail', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    renderWithProviders(<TicketListPage />, {
      path: '/tickets',
      route: '/tickets',
      extraRoutes: [{ path: '/tickets/:id', element: <div>DETAIL PAGE</div> }],
    });
    await user.click(await screen.findByText('Không đăng nhập được'));
    expect(await screen.findByText('DETAIL PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/tickets/1024');
  });

  it('search is debounced: typing sends one request for the final text, not one per keystroke', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    await screen.findByText('Lỗi xuất hóa đơn');

    await user.type(screen.getByRole('searchbox', { name: 'Tìm kiếm ticket' }), 'login');
    // nothing is applied while typing
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/tickets$/);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets?search=login'));
    await waitFor(() => expect(calls.some((c) => c.get('search') === 'login')).toBe(true));
    const searched = calls.map((c) => c.get('search')).filter(Boolean);
    expect(searched).toEqual(['login']);
  });

  it('clearing filters cancels a pending (debounced) search', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets?status=Open' });
    await screen.findByText('Không đăng nhập được');

    await user.type(screen.getByRole('searchbox', { name: 'Tìm kiếm ticket' }), 'abc');
    await user.click(screen.getByRole('button', { name: /Xóa lọc/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/tickets$/));
    // wait past the debounce window: the typed text must not be re-applied
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/tickets$/);
  });

  it('hovering a row prefetches the ticket detail and history', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    const requested: string[] = [];
    server.use(
      http.get(`${API}/tickets/:id`, ({ params }) => {
        requested.push(`detail:${String(params.id)}`);
        return HttpResponse.json(ticketDetail({ id: Number(params.id) }));
      }),
      http.get(`${API}/tickets/:id/history`, ({ params }) => {
        requested.push(`history:${String(params.id)}`);
        return HttpResponse.json([]);
      }),
    );
    const { queryClient } = renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });

    await user.hover(await screen.findByText('Không đăng nhập được'));
    await waitFor(() => expect(requested).toEqual(expect.arrayContaining(['detail:1024', 'history:1024'])));
    await waitFor(() => expect(queryClient.getQueryData(['tickets', 'detail', 1024])).toBeDefined());
  });

  it('rows are keyboard-activatable and the detail page gets the list URL to return to', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    function Detail() {
      const state = useLocation().state as { from?: string } | null;
      return <div>DETAIL FROM {state?.from}</div>;
    }
    renderWithProviders(<TicketListPage />, {
      path: '/tickets',
      route: '/tickets?status=Open',
      extraRoutes: [{ path: '/tickets/:id', element: <Detail /> }],
    });
    const row = (await screen.findByText('Không đăng nhập được')).closest('tr')!;
    row.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('DETAIL FROM /tickets?status=Open')).toBeInTheDocument();
  });

  it('shows an inline error with a retry button when the list cannot be loaded', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get(`${API}/tickets`, () =>
        fail
          ? HttpResponse.json({ title: 'Boom', status: 500 }, { status: 500 })
          : HttpResponse.json({ items: ticketItems, totalCount: ticketItems.length, page: 1, pageSize: 20 }),
      ),
    );
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    expect(await screen.findByText('Không tải được danh sách ticket')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Không đăng nhập được')).toBeInTheDocument();
  });
});
