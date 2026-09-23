import { useEffect, useState } from 'react';
import { Alert, App, Button, Drawer, Input, Modal, Select, Space, Switch, Table, Tag, type TableProps } from 'antd';
import { KeyOutlined, TeamOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activitiesApi, rolesApi, usersApi } from '@/api/endpoints';
import { getErrorMessage, getStatus, showError } from '@/api/errors';
import { queryKeys } from '@/api/queryClient';
import { useCan, useCurrentUser } from '@/stores/authStore';
import type { ActivityPermissionInput, UserListItemDto, UsersQuery } from '@/types';
import { formatDate } from '@/utils/format';
import { FlagsText, normalizePermissions, PermissionMatrix, toPermissionInputs } from './PermissionMatrix';

function useRoles(enabled = true) {
  return useQuery({ queryKey: queryKeys.roles, queryFn: rolesApi.list, enabled, staleTime: 60_000 });
}

function useActivities(enabled = true) {
  return useQuery({ queryKey: queryKeys.activities, queryFn: activitiesApi.list, enabled, staleTime: 5 * 60_000 });
}

/** After changing the current user's own roles/permissions, refresh /auth/me so the UI updates. */
function useRefreshMeIfSelf() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  return (userId: string) => {
    if (userId === me?.id) void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

function AssignRolesModal({ user, onClose }: { user: UserListItemDto | null; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const refreshMe = useRefreshMeIfSelf();
  const roles = useRoles(!!user);
  const [roleIds, setRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) setRoleIds(user.roles.map((r) => r.id));
  }, [user]);

  const save = useMutation({
    mutationFn: () => usersApi.setRoles(user!.id, roleIds),
    meta: { suppressGlobalError: true },
    onSuccess: (u) => {
      void message.success(`Đã cập nhật role cho ${u.fullName}`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      refreshMe(u.id);
      onClose();
    },
    onError: (err) =>
      showError(err, getStatus(err) === 409 ? 'Không thể tự gỡ role Admin của chính mình' : undefined),
  });

  return (
    <Modal
      title={`Gán role — ${user?.fullName ?? ''}`}
      open={!!user}
      onCancel={onClose}
      onOk={() => save.mutate()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Select
        aria-label="Chọn role"
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="Chọn role"
        loading={roles.isLoading}
        value={roleIds}
        onChange={setRoleIds}
        optionFilterProp="label"
        options={(roles.data ?? []).map((r) => ({
          value: r.id,
          label: r.isAdmin ? `${r.name} (Toàn quyền)` : r.name,
        }))}
      />
    </Modal>
  );
}

function UserPermissionsDrawer({ user, onClose }: { user: UserListItemDto | null; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const refreshMe = useRefreshMeIfSelf();
  const canEdit = useCan('USER', 'U');
  const activities = useActivities(!!user);
  const detail = useQuery({
    queryKey: queryKeys.userPermissions(user?.id ?? ''),
    queryFn: () => usersApi.getPermissions(user!.id),
    enabled: !!user,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<ActivityPermissionInput[]>([]);

  useEffect(() => {
    if (detail.data) setDraft(toPermissionInputs(detail.data.userActivities));
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => usersApi.setPermissions(user!.id, normalizePermissions(draft)),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userPermissions(data.userId), data);
      void message.success('Đã lưu quyền riêng');
      refreshMe(data.userId);
    },
  });

  const effective = detail.data?.effective ?? [];

  return (
    <Drawer
      title={`Quyền riêng — ${user?.fullName ?? ''}`}
      open={!!user}
      onClose={onClose}
      width={760}
      destroyOnHidden
      extra={
        canEdit && (
          <Button type="primary" loading={save.isPending} disabled={!detail.data} onClick={() => save.mutate()}>
            Lưu
          </Button>
        )
      }
    >
      {detail.isError && <Alert type="error" showIcon message={getErrorMessage(detail.error)} />}
      {detail.data && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
          <div>
            Role:{' '}
            {detail.data.roles.length
              ? detail.data.roles.map((r) => (
                  <Tag key={r.id} color="blue">
                    {r.name}
                  </Tag>
                ))
              : '—'}
          </div>
          {detail.data.isAdmin && (
            <Alert type="info" showIcon message="Tài khoản có role Admin → toàn quyền, quyền riêng không có tác dụng." />
          )}
          <Alert
            type="warning"
            showIcon
            message="Quyền riêng được cộng thêm vào quyền của role. Cột 'Quyền hiệu lực' là kết quả sau khi gộp (cập nhật sau khi Lưu)."
          />
        </Space>
      )}
      <PermissionMatrix
        activities={activities.data ?? []}
        value={draft}
        onChange={setDraft}
        readOnly={!canEdit}
        loading={activities.isLoading || detail.isLoading}
        extraColumn={{
          title: 'Quyền hiệu lực',
          width: 120,
          render: (a) =>
            detail.data?.isAdmin ? (
              <Tag color="magenta">Toàn quyền</Tag>
            ) : (
              <FlagsText flags={effective.find((e) => e.activityId === a.id)} />
            ),
        }}
      />
    </Drawer>
  );
}

export function UsersTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const canEdit = useCan('USER', 'U');
  const [query, setQuery] = useState<UsersQuery>({ page: 1, pageSize: 20 });
  const [rolesFor, setRolesFor] = useState<UserListItemDto | null>(null);
  const [permsFor, setPermsFor] = useState<UserListItemDto | null>(null);
  const roles = useRoles();

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () => usersApi.list(query),
    placeholderData: keepPreviousData,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.update(id, { isActive }),
    onSuccess: (u) => {
      void message.success(`${u.isActive ? 'Đã mở khóa' : 'Đã khóa'} ${u.fullName}`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const pendingId = toggleActive.isPending ? toggleActive.variables?.id : undefined;

  const columns: TableProps<UserListItemDto>['columns'] = [
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Roles',
      key: 'roles',
      render: (_, u) =>
        u.roles.length ? (
          <Space size={[4, 4]} wrap>
            {u.roles.map((r) => (
              <Tag key={r.id} color="blue">
                {r.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag>Chưa có role</Tag>
        ),
    },
    { title: 'Ngày tạo', dataIndex: 'createdDate', key: 'createdDate', width: 120, render: (v: string) => formatDate(v) },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean, u) => (
        <Switch
          aria-label={`Active ${u.email}`}
          checked={active}
          disabled={!canEdit || u.id === me?.id}
          loading={pendingId === u.id}
          onChange={(checked) => toggleActive.mutate({ id: u.id, isActive: checked })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 230,
      render: (_, u) => (
        <Space>
          {canEdit && (
            <Button size="small" icon={<TeamOutlined />} onClick={() => setRolesFor(u)}>
              Gán role
            </Button>
          )}
          <Button size="small" icon={<KeyOutlined />} onClick={() => setPermsFor(u)}>
            Quyền riêng
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Tìm theo tên / email"
          allowClear
          style={{ width: 280 }}
          onSearch={(v) => setQuery((q) => ({ ...q, search: v.trim() || undefined, page: 1 }))}
        />
        <Select
          allowClear
          placeholder="Role"
          style={{ width: 180 }}
          value={query.roleId}
          loading={roles.isLoading}
          options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
          onChange={(roleId?: string) => setQuery((q) => ({ ...q, roleId, page: 1 }))}
        />
      </Space>
      <Table<UserListItemDto>
        rowKey="id"
        loading={isFetching}
        columns={columns}
        dataSource={data?.items ?? []}
        scroll={{ x: 900 }}
        onChange={(p) => setQuery((q) => ({ ...q, page: p.current ?? 1, pageSize: p.pageSize ?? 20 }))}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.totalCount ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `Tổng: ${t}`,
        }}
      />
      <AssignRolesModal user={rolesFor} onClose={() => setRolesFor(null)} />
      <UserPermissionsDrawer user={permsFor} onClose={() => setPermsFor(null)} />
    </>
  );
}
