import { api } from '@/lib/api-client';
import type { CategoryDto, CategoryRequest } from '@/types';

/** Write side of categories (the read list comes from the tickets feature's `useCategories`). */
export const categoriesApi = {
  create: (body: CategoryRequest) => api.post<CategoryDto>('/categories', body).then((r) => r.data),
  update: (id: number, body: CategoryRequest) => api.put<CategoryDto>(`/categories/${id}`, body).then((r) => r.data),
};
