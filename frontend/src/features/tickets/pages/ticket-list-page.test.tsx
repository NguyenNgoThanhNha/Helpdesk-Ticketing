import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { agentUser, customerUser, ticketItems } from '@/test/fixtures';
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
    expect(screen.getByLabelText('SLA AtRisk')).toBeInTheDocument();
    expect(screen.getByText('Tổng: 2')).toBeInTheDocument();
    // Assignee filter + Created by column are visible for staff (TICKET:R)
    expect(screen.getByRole('combobox', { name: 'Assignee filter' })).toBeInTheDocument();
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

    await chooseSelectOption(user, 'Status filter', 'Open');

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
    expect(screen.queryByRole('combobox', { name: 'Assignee filter' })).not.toBeInTheDocument();
    unmount();

    loginAs(customerUser);
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    await screen.findByText('Không đăng nhập được');
    expect(screen.queryByRole('combobox', { name: 'Assignee filter' })).not.toBeInTheDocument();
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
});
