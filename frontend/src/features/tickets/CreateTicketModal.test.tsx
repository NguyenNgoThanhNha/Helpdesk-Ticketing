import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '@/test/server';
import { API } from '@/test/handlers';
import { customerUser } from '@/test/fixtures';
import { loginAs, renderWithProviders } from '@/test/utils';
import { CreateTicketModal, createTicketSchema } from './CreateTicketModal';
import type { CreateTicketRequest } from '@/types';

async function chooseOption(label: string, optionText: string) {
  const combobox = screen.getByLabelText(label);
  fireEvent.mouseDown(combobox);
  const option = await waitFor(() => {
    const el = document.querySelector<HTMLElement>(`.ant-select-item-option[title="${optionText}"]`);
    if (!el) throw new Error(`option ${optionText} not found`);
    return el;
  });
  fireEvent.click(option);
}

describe('createTicketSchema', () => {
  it('requires a title and limits it to 200 chars', () => {
    const base = { description: 'd', categoryId: 1, priority: 'Medium' as const };
    expect(createTicketSchema.safeParse({ ...base, title: '' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 'x'.repeat(201) }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, title: 'x'.repeat(200) }).success).toBe(true);
  });
});

describe('CreateTicketModal', () => {
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
    renderWithProviders(<CreateTicketModal open onClose={() => {}} />);

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

  it('submits the ticket to the API and closes on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    let body: CreateTicketRequest | null = null;
    server.use(
      http.post(`${API}/tickets`, async ({ request }) => {
        body = (await request.json()) as CreateTicketRequest;
        await new Promise((r) => setTimeout(r, 30));
        return HttpResponse.json({ id: 2000, title: body.title }, { status: 201 });
      }),
    );
    renderWithProviders(<CreateTicketModal open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Tiêu đề'), 'Máy in không hoạt động');
    await user.type(screen.getByLabelText('Mô tả'), 'Máy in tầng 3 báo lỗi giấy');
    await chooseOption('Danh mục', 'Billing');
    await chooseOption('Ưu tiên', 'High');

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
    expect(onClose).toHaveBeenCalled();
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
    renderWithProviders(<CreateTicketModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText('Tiêu đề'), 'Trùng');
    await user.type(screen.getByLabelText('Mô tả'), 'abc');
    await chooseOption('Danh mục', 'Auth');
    await user.click(screen.getByRole('button', { name: 'Tạo' }));
    expect(await screen.findByText('Title đã tồn tại')).toBeInTheDocument();
  });
});
