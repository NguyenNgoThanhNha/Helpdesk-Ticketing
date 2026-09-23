import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { agentUser, customerUser, ticketItems } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/utils';
import { TicketListPage } from './TicketListPage';

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
  it('renders rows returned by the API', async () => {
    loginAs(agentUser);
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });

    expect(await screen.findByText('Không đăng nhập được')).toBeInTheDocument();
    expect(screen.getByText('Lỗi xuất hóa đơn')).toBeInTheDocument();
    expect(screen.getByText('#1024')).toBeInTheDocument();
    expect(screen.getByLabelText('SLA AtRisk')).toBeInTheDocument();
    expect(screen.getByText('Tổng: 2')).toBeInTheDocument();
    // Assignee filter is visible for staff
    expect(screen.getByRole('combobox', { name: 'Assignee filter' })).toBeInTheDocument();
  });

  it('reads filters from the URL and sends them to the API', async () => {
    loginAs(agentUser);
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, {
      path: '/tickets',
      route: '/tickets?status=InProgress&priority=Medium&search=hóa%20đơn&page=2',
    });
    expect(await screen.findByText('Lỗi xuất hóa đơn')).toBeInTheDocument();
    const last = calls[calls.length - 1];
    expect(last.get('status')).toBe('InProgress');
    expect(last.get('priority')).toBe('Medium');
    expect(last.get('search')).toBe('hóa đơn');
    expect(last.get('page')).toBe('2');
    expect(last.get('sort')).toBe('createdAt_desc');
  });

  it('changing the status filter updates the URL and re-queries the API', async () => {
    loginAs(agentUser);
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    expect(await screen.findByText('Lỗi xuất hóa đơn')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status filter' }));
    const option = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ant-select-item-option[title="Open"]');
      if (!el) throw new Error('option not rendered');
      return el;
    });
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets?status=Open'));
    await waitFor(() => expect(calls.some((c) => c.get('status') === 'Open')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Lỗi xuất hóa đơn')).not.toBeInTheDocument());
    expect(screen.getByText('Không đăng nhập được')).toBeInTheDocument();
  });

  it('search box writes ?search= to the URL', async () => {
    loginAs(agentUser);
    const user = userEvent.setup();
    const calls = captureTicketRequests();
    renderWithProviders(<TicketListPage />, { path: '/tickets', route: '/tickets' });
    await screen.findByText('Lỗi xuất hóa đơn');

    await user.type(screen.getByPlaceholderText('Tìm theo tiêu đề / mô tả'), 'login{Enter}');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/tickets?search=login'));
    await waitFor(() => expect(calls.some((c) => c.get('search') === 'login')).toBe(true));
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
  });
});
