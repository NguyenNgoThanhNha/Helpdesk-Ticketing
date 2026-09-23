import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { TextFormField } from '@/components/common/form-fields';
import { applyFieldErrors, getStatus, showError } from '@/lib/api-errors';
import type { CategoryDto } from '@/types';
import { useSaveCategory } from '../hooks/use-category-mutations';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên danh mục').max(100, 'Tối đa 100 ký tự'),
  defaultSlaHours: z.coerce
    .number({ invalid_type_error: 'Vui lòng nhập số giờ' })
    .int('Phải là số nguyên')
    .min(1, 'Tối thiểu 1 giờ')
    .max(8760, 'Tối đa 8760 giờ'),
});
type CategoryFormInput = z.input<typeof categorySchema>;
type CategoryForm = z.output<typeof categorySchema>;

export function CategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  category: CategoryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveCategory(category);
  const form = useForm<CategoryFormInput, unknown, CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', defaultSlaHours: 24 },
  });

  useEffect(() => {
    if (open) form.reset({ name: category?.name ?? '', defaultSlaHours: category?.defaultSlaHours ?? 24 });
  }, [open, category, form]);

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast.success(category ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
        onOpenChange(false);
      },
      onError: (err) => {
        if (getStatus(err) === 409) form.setError('name', { type: 'server', message: 'Tên danh mục đã tồn tại' });
        else if (!applyFieldErrors(err, ['name', 'defaultSlaHours'] as const, form.setError)) showError(err);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? `Sửa danh mục: ${category.name}` : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>SLA mặc định áp dụng cho ticket thuộc danh mục này.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="category-form" onSubmit={onSubmit} noValidate className="space-y-4">
            <TextFormField control={form.control} name="name" label="Tên" required />
            <TextFormField
              control={form.control}
              name="defaultSlaHours"
              label="SLA mặc định (giờ)"
              required
              type="number"
              min={1}
              inputMode="numeric"
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
