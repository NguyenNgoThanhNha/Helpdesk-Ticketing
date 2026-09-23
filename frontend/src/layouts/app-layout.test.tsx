import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { PermissionRoute } from '@/app/route-guards';
import { createQueryClient } from '@/lib/query-client';
import { PERMISSIONS } from '@/lib/permissions';
import { adminUser, agentUser, customerUser } from '@/test/fixtures';
import { loginAs } from '@/test/render';
import type { CurrentUserDto } from '@/types';
import { AppLayout } from './app-layout';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { API } from '@/test/handlers';

function renderShell(user: CurrentUserDto, route = '/tickets') {
  loginAs(user);
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json(user)));
  return render(
    <AppProviders queryClient={createQueryClient({ retry: false })}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/tickets" element={<div>TICKETS</div>} />
            <Route path="/my-queue" element={<div>MY QUEUE</div>} />
            <Route element={<PermissionRoute anyOf={PERMISSIONS.settings} />}>
              <Route path="/settings" element={<div>SETTINGS PAGE</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('AppLayout / permission gating', () => {
  it('customer: sidebar hides Dashboard, My Queue, Reports, Settings and API Logs; /settings shows 403', async () => {
    renderShell(customerUser, '/settings');
    expect(await screen.findByText('403 — Không có quyền')).toBeInTheDocument();
    expect(screen.queryByText('SETTINGS PAGE')).not.toBeInTheDocument();
    const links = screen.getAllByRole('link').map((a) => a.textContent?.trim());
    expect(links).toContain('Tickets');
    for (const hidden of ['Dashboard', 'My Queue', 'Reports', 'Settings', 'API Logs']) expect(links).not.toContain(hidden);
    // unread badge is polled from the API
    expect(await screen.findByTestId('unread-count')).toHaveTextContent('3');
  });

  it('agent sees Dashboard / My Queue but not Settings; admin sees everything including API Logs', async () => {
    const { unmount } = renderShell(agentUser);
    await screen.findByText('TICKETS');
    let links = screen.getAllByRole('link').map((a) => a.textContent?.trim());
    expect(links).toEqual(expect.arrayContaining(['Dashboard', 'Tickets', 'My Queue', 'Reports']));
    expect(links).not.toContain('Settings');
    expect(links).not.toContain('API Logs');
    unmount();

    renderShell(adminUser, '/settings');
    expect(await screen.findByText('SETTINGS PAGE')).toBeInTheDocument();
    links = screen.getAllByRole('link').map((a) => a.textContent?.trim());
    expect(links).toEqual(expect.arrayContaining(['Settings', 'API Logs']));
  });

  it('on mobile the sidebar is an off-canvas sheet opened by the topbar trigger', async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    try {
      const user = userEvent.setup();
      renderShell(agentUser);
      await screen.findByText('TICKETS');
      // collapsed: no navigation links rendered until the sheet is opened
      expect(screen.queryByRole('link', { name: 'My Queue' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Thu gọn / mở menu' }));
      const sheet = await screen.findByRole('dialog');
      await user.click(within(sheet).getByRole('link', { name: 'My Queue' }));
      // navigating closes the sheet
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    }
  });
});
