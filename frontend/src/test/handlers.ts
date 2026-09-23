import { http, HttpResponse } from 'msw';
import type { CreateTicketRequest, PagedResult, TicketListItemDto } from '@/types';
import { activities, assignees, authResponse, categories, customerUser, ticketDetail, ticketItems } from './fixtures';

export const API = '/api/v1';

/** Default happy-path handlers; individual tests override with server.use(...). */
export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== 'Customer@123') {
      return HttpResponse.json(
        { title: 'Unauthorized', status: 401, detail: 'Invalid credentials' },
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(authResponse({ ...customerUser, email: body.email }));
  }),
  http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse(customerUser, '2'))),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/categories`, () => HttpResponse.json(categories)),
  http.get(`${API}/users/assignees`, () => HttpResponse.json(assignees)),
  http.get(`${API}/activities`, () => HttpResponse.json(activities)),
  http.get(`${API}/auth/me`, () => HttpResponse.json(customerUser)),

  http.get(`${API}/tickets`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const items = status ? ticketItems.filter((t) => t.status === status) : ticketItems;
    const result: PagedResult<TicketListItemDto> = {
      items,
      totalCount: items.length,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    };
    return HttpResponse.json(result);
  }),
  http.post(`${API}/tickets`, async ({ request }) => {
    const body = (await request.json()) as CreateTicketRequest;
    return HttpResponse.json(
      ticketDetail({ id: 2000, title: body.title, description: body.description, priority: body.priority }),
      { status: 201 },
    );
  }),
  http.get(`${API}/tickets/:id`, ({ params }) => HttpResponse.json(ticketDetail({ id: Number(params.id) }))),
  http.get(`${API}/tickets/:id/history`, () => HttpResponse.json([])),

  http.get(`${API}/notifications/unread-count`, () => HttpResponse.json({ count: 3 })),
  http.get(`${API}/notifications`, () => HttpResponse.json([])),
];
