import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { CategoryDto, CategoryRequest } from '@/types';
import { categoriesApi } from '../api/categories-api';

/** Create (category === null) or update a category. Errors are handled by the dialog. */
export function useSaveCategory(category: CategoryDto | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryRequest) => (category ? categoriesApi.update(category.id, body) : categoriesApi.create(body)),
    meta: { suppressGlobalError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}
