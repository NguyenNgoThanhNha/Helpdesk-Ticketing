import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Table, type TableProps } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { categoriesApi } from '@/api/endpoints';
import { applyFieldErrors, getStatus, showError } from '@/api/errors';
import { queryKeys } from '@/api/queryClient';
import { FormField } from '@/components/FormField';
import { useCategories } from '@/features/tickets/hooks';
import { useCan } from '@/stores/authStore';
import type { CategoryDto } from '@/types';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên danh mục').max(100, 'Tối đa 100 ký tự'),
  defaultSlaHours: z
    .number({ required_error: 'Vui lòng nhập số giờ', invalid_type_error: 'Vui lòng nhập số giờ' })
    .int('Phải là số nguyên')
    .min(1, 'Tối thiểu 1 giờ')
    .max(8760, 'Tối đa 8760 giờ'),
});
type CategoryForm = z.infer<typeof categorySchema>;

function CategoryModal({ category, open, onClose }: { category: CategoryDto | null; open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: '', defaultSlaHours: 24 } });

  useEffect(() => {
    if (open) reset({ name: category?.name ?? '', defaultSlaHours: category?.defaultSlaHours ?? 24 });
  }, [open, category, reset]);

  const save = useMutation({
    mutationFn: (v: CategoryForm) => (category ? categoriesApi.update(category.id, v) : categoriesApi.create(v)),
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      void message.success(category ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      onClose();
    },
    onError: (err) => {
      if (getStatus(err) === 409) {
        setError('name', { type: 'server', message: 'Tên danh mục đã tồn tại' });
      } else if (!applyFieldErrors(err, ['name', 'defaultSlaHours'] as const, setError)) {
        showError(err);
      }
    },
  });

  return (
    <Modal
      title={category ? `Sửa danh mục: ${category.name}` : 'Thêm danh mục'}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit((v) => save.mutate(v))()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Form layout="vertical" component="div">
        <FormField label="Tên" required error={errors.name} htmlFor="category-name">
          <Controller name="name" control={control} render={({ field }) => <Input {...field} id="category-name" />} />
        </FormField>
        <FormField label="SLA mặc định (giờ)" required error={errors.defaultSlaHours} htmlFor="category-sla">
          <Controller
            name="defaultSlaHours"
            control={control}
            render={({ field }) => (
              <InputNumber
                id="category-sla"
                min={1}
                style={{ width: '100%' }}
                value={field.value}
                onChange={(v) => field.onChange(v ?? undefined)}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>
      </Form>
    </Modal>
  );
}

export function CategoriesTab() {
  const { data, isLoading } = useCategories();
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [open, setOpen] = useState(false);
  const canCreate = useCan('CATEGORY', 'C');
  const canUpdate = useCan('CATEGORY', 'U');

  const columns: TableProps<CategoryDto>['columns'] = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: 'Tên', dataIndex: 'name', key: 'name' },
    { title: 'SLA mặc định (giờ)', dataIndex: 'defaultSlaHours', key: 'sla', width: 180 },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, c) =>
        canUpdate && (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => {
            setEditing(c);
            setOpen(true);
          }}
        >
          Sửa
        </Button>
        ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        {canCreate && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Thêm danh mục
        </Button>
        )}
      </div>
      <Table<CategoryDto> rowKey="id" loading={isLoading} columns={columns} dataSource={data ?? []} pagination={false} />
      <CategoryModal category={editing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
