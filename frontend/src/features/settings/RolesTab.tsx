import { useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, type TableProps } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { activitiesApi, rolesApi } from '@/api/endpoints';
import { applyFieldErrors, getStatus, showError } from '@/api/errors';
import { queryKeys } from '@/api/queryClient';
import { FormField } from '@/components/FormField';
import { useCan } from '@/stores/authStore';
import type { ActivityPermissionInput, RoleDto } from '@/types';
import { normalizePermissions, PermissionMatrix, toPermissionInputs } from './PermissionMatrix';

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên role').max(100, 'Tối đa 100 ký tự'),
  description: z.string().trim().max(500, 'Tối đa 500 ký tự'),
});
type RoleForm = z.infer<typeof roleSchema>;

/** role === null → create; otherwise edit */
function RoleModal({ open, role, onClose }: { open: boolean; role: RoleDto | null; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [activities, setActivities] = useState<ActivityPermissionInput[]>([]);
  const activityList = useQuery({ queryKey: queryKeys.activities, queryFn: activitiesApi.list, enabled: open });
  const detail = useQuery({
    queryKey: queryKeys.role(role?.id ?? ''),
    queryFn: () => rolesApi.get(role!.id),
    enabled: open && !!role,
    staleTime: 0,
  });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RoleForm>({ resolver: zodResolver(roleSchema), defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (!open) return;
    if (!role) {
      reset({ name: '', description: '' });
      setActivities([]);
    } else if (detail.data) {
      reset({ name: detail.data.name, description: detail.data.description ?? '' });
      setActivities(toPermissionInputs(detail.data.activities));
    }
  }, [open, role, detail.data, reset]);

  const save = useMutation({
    mutationFn: (v: RoleForm) => {
      const body = {
        name: v.name,
        description: v.description || null,
        activities: normalizePermissions(activities),
      };
      return role ? rolesApi.update(role.id, body) : rolesApi.create(body);
    },
    meta: { suppressGlobalError: true },
    onSuccess: (r) => {
      void message.success(role ? `Đã cập nhật role ${r.name}` : `Đã tạo role ${r.name}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      // permissions of users having this role may have changed (including me)
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      onClose();
    },
    onError: (err) => {
      if (getStatus(err) === 409) setError('name', { type: 'server', message: 'Tên role đã tồn tại' });
      else if (!applyFieldErrors(err, ['name', 'description'] as const, setError)) showError(err);
    },
  });

  return (
    <Modal
      title={role ? `Sửa role: ${role.name}` : 'Tạo role'}
      open={open}
      onCancel={onClose}
      onOk={() => void handleSubmit((v) => save.mutate(v))()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: !!role && !detail.data }}
      width={820}
      destroyOnHidden
    >
      <Form layout="vertical" component="div">
        <FormField label="Tên role" required error={errors.name} htmlFor="role-name">
          <Controller name="name" control={control} render={({ field }) => <Input {...field} id="role-name" />} />
        </FormField>
        <FormField label="Mô tả" error={errors.description} htmlFor="role-description">
          <Controller
            name="description"
            control={control}
            render={({ field }) => <Input.TextArea {...field} id="role-description" rows={2} />}
          />
        </FormField>
        <Form.Item label="Quyền">
          <PermissionMatrix
            activities={activityList.data ?? []}
            value={activities}
            onChange={setActivities}
            loading={activityList.isLoading || (!!role && detail.isLoading)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function RolesTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canCreate = useCan('ROLE', 'C');
  const canUpdate = useCan('ROLE', 'U');
  const canDelete = useCan('ROLE', 'D');
  const { data, isLoading } = useQuery({ queryKey: queryKeys.roles, queryFn: rolesApi.list });
  const [modal, setModal] = useState<{ open: boolean; role: RoleDto | null }>({ open: false, role: null });

  const remove = useMutation({
    mutationFn: (r: RoleDto) => rolesApi.remove(r.id),
    onSuccess: () => {
      void message.success('Đã xóa role');
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const columns: TableProps<RoleDto>['columns'] = [
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r) => (
        <Space>
          <strong>{name}</strong>
          {r.isAdmin && <Tag color="magenta">Toàn quyền</Tag>}
        </Space>
      ),
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (v: string | null) => v ?? '—' },
    { title: 'Số user', dataIndex: 'userCount', key: 'userCount', width: 100, align: 'right' },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_, r) =>
        r.isAdmin ? (
          <Tag>Không thể sửa</Tag>
        ) : (
          <Space>
            {canUpdate && (
              <Button size="small" icon={<EditOutlined />} onClick={() => setModal({ open: true, role: r })}>
                Sửa
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title={`Xóa role "${r.name}"?`}
                description={r.userCount ? `${r.userCount} user đang có role này sẽ mất quyền tương ứng.` : undefined}
                okText="Xóa"
                okButtonProps={{ danger: true }}
                cancelText="Hủy"
                onConfirm={() => remove.mutateAsync(r)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Xóa ${r.name}`} />
              </Popconfirm>
            )}
          </Space>
        ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ flex: 1 }}
          message="Quyền hiệu lực của user = OR(quyền các role, quyền riêng). Role Admin có toàn quyền."
        />
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, role: null })}>
            Tạo role
          </Button>
        )}
      </div>
      <Table<RoleDto> rowKey="id" loading={isLoading} columns={columns} dataSource={data ?? []} pagination={false} />
      <RoleModal open={modal.open} role={modal.role} onClose={() => setModal({ open: false, role: null })} />
    </>
  );
}
