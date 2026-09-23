import { z } from 'zod';
import { TICKET_PRIORITIES } from '@/types';

export const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200, 'Tiêu đề tối đa 200 ký tự'),
  description: z.string().trim().min(1, 'Vui lòng nhập mô tả').max(4000, 'Mô tả tối đa 4000 ký tự'),
  categoryId: z
    .number({ required_error: 'Vui lòng chọn danh mục', invalid_type_error: 'Vui lòng chọn danh mục' })
    .int()
    .positive('Vui lòng chọn danh mục'),
  priority: z.enum(TICKET_PRIORITIES, {
    required_error: 'Vui lòng chọn mức ưu tiên',
    invalid_type_error: 'Vui lòng chọn mức ưu tiên',
  }),
});
export type CreateTicketForm = z.infer<typeof createTicketSchema>;

export const CREATE_TICKET_FIELDS = ['title', 'description', 'categoryId', 'priority'] as const;
