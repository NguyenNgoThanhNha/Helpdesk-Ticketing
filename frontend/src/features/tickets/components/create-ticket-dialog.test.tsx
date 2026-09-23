import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { customerUser } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/render';
import { chooseSelectOption } from '@/test/ui';
import type { CreateTicketRequest } from '@/types';
import { createTicketSchema } from '../schemas';
import { CreateTicketDialog } from './create-ticket-dialog';

describe('createTicketSchema', () => {
  it('requires a title and limits it to 200 chars; description ≤ 4000; category and priority required', () => {
    const base = { description: 'd', categoryId: 1, priority: 'Medium' as const };
    expect(createTicketSchema.safeParse({ ...base, title: '' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 'x'.repeat(201) }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 'x'.repeat(200) }).success).toBe(true);
    expect(createTicketSchema.safeParse({ ...base, title: 't', description: 'x'.repeat(4001) }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 't', categoryId: undefined }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 't', priority: undefined }).success).toBe(false);
  });
});

describe('CreateTicketDialog', () => {
  beforeEach(() => loginAs(customerUser));

  it('shows field errors for empty and too-long input and does not call the API', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(`${API}/tickets`, () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderWithProviders(<CreateTicketDialog open onOpenChange={() => {}} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    expect(await screen.findByText('Vui lòng nhập tiêu đề')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mô tả')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn danh mục')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'a'.repeat(201) } });
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));
    expect(await screen.findByText('Tiêu đề tối đa 200 ký tự')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('submits the ticket, uploads attachments, disables the button while submitting and closes on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    let body: CreateTicketRequest | null = null;
    const uploaded: string[] = [];
    server.use(
      http.post(`${API}/tickets`, async ({ request }) => {
        body = (await request.json()) as CreateTicketRequest;
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ id: 2000, title: body.title }, { status: 201 });
      }),
      // (jsdom's FormData body can't be parsed by MSW here, so only the target ticket is recorded)
      http.post(`${API}/tickets/:id/attachments`, ({ params }) => {
        uploaded.push(String(params.id));
        return HttpResponse.json({ id: 1, fileName: 'x', contentType: 'text/plain', size: 1, commentId: null, uploadedAt: '' }, { status: 201 });
      }),
    );
    renderWithProviders(<CreateTicketDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Tiêu đề'), 'Máy in không hoạt động');
    await user.type(screen.getByLabelText('Mô tả'), 'Máy in tầng 3 báo lỗi giấy');
    await chooseSelectOption(user, screen.getByLabelText('Danh mục'), 'Billing');
    await chooseSelectOption(user, screen.getByLabelText('Ưu tiên'), 'High');

    // one valid file and one > 10MB (rejected on the client)
    const ok = new File(['hello'], 'log.txt', { type: 'text/plain' });
    const big = new File(['x'], 'big.bin');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByLabelText('Đính kèm', { selector: 'input' }), [ok, big]);
    expect(screen.getByText('log.txt')).toBeInTheDocument();
    expect(screen.queryByText('big.bin')).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Tạo' });
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toEqual({
      title: 'Máy in không hoạt động',
      description: 'Máy in tầng 3 báo lỗi giấy',
      categoryId: 2,
      priority: 'High',
    });
    // only the valid file is uploaded, to the newly created ticket
    expect(uploaded).toEqual(['2000']);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 2000 });
  });

  it('maps server-side ProblemDetails errors onto fields', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/tickets`, () =>
        HttpResponse.json(
          { title: 'Validation failed', status: 400, errors: { title: ['Title đã tồn tại'] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<CreateTicketDialog open onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText('Tiêu đề'), 'Trùng');
    await user.type(screen.getByLabelText('Mô tả'), 'abc');
    await chooseSelectOption(user, screen.getByLabelText('Danh mục'), 'Auth');
    await user.click(screen.getByRole('button', { name: 'Tạo' }));
    expect(await screen.findByText('Title đã tồn tại')).toBeInTheDocument();
    expect(screen.getByLabelText('Tiêu đề')).toHaveAttribute('aria-invalid', 'true');
  });
});
