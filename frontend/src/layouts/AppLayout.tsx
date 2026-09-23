import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Input, Layout, Menu, Space, Tag, Typography, theme, type MenuProps } from 'antd';
import {
  BarChartOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  InboxOutlined,
  LogoutOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { canAny, SETTINGS_PERMISSIONS, useAuthStore, type PermissionRequirement } from '@/stores/authStore';
import { queryKeys } from '@/api/queryClient';
import { NotificationBell } from '@/features/notifications/NotificationBell';

const { Header, Sider, Content } = Layout;

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** visible when the user has any of these permissions (empty = everyone) */
  anyOf: readonly PermissionRequirement[];
}

const NAV_ITEMS: NavItem[] = [
  { key: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined />, anyOf: [['REPORT', 'R']] },
  { key: '/tickets', label: 'Tickets', icon: <UnorderedListOutlined />, anyOf: [] },
  { key: '/my-queue', label: 'My Queue', icon: <InboxOutlined />, anyOf: [['TICKET_ASSIGN', 'R']] },
  { key: '/reports', label: 'Reports', icon: <BarChartOutlined />, anyOf: [['REPORT', 'R']] },
  { key: '/settings', label: 'Settings', icon: <SettingOutlined />, anyOf: SETTINGS_PERMISSIONS },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  // Refresh the current user's roles/permissions once per app load (they may have been changed by an admin).
  const me = useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, staleTime: 5 * 60_000, meta: { suppressGlobalError: true } });
  useEffect(() => {
    if (me.data) setUser(me.data);
  }, [me.data, setUser]);

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      NAV_ITEMS.filter((i) => user && (i.anyOf.length === 0 || canAny(user, i.anyOf))).map((i) => ({
        key: i.key,
        icon: i.icon,
        label: <Link to={i.key}>{i.label}</Link>,
      })),
    [user],
  );

  const selectedKey =
    NAV_ITEMS.map((i) => i.key).find((k) => location.pathname === k || location.pathname.startsWith(`${k}/`)) ??
    '/tickets';

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // ignore — we log out locally anyway
      }
    }
    logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps = {
    items: [
      {
        key: 'info',
        disabled: true,
        label: (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{user?.fullName}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {user?.email}
            </Typography.Text>
            <Space size={4} wrap style={{ marginTop: 4 }}>
              {user?.isAdmin && <Tag color="magenta">Toàn quyền</Tag>}
              {user?.roles.map((r) => (
                <Tag color="blue" key={r}>
                  {r}
                </Tag>
              ))}
            </Space>
          </Space>
        ),
      },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') void handleLogout();
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg">
        <div className="app-logo">
          <CustomerServiceOutlined />
          {!collapsed && <span>Helpdesk</span>}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Helpdesk
          </Typography.Title>
          <Input.Search
            placeholder="Tìm ticket..."
            allowClear
            style={{ maxWidth: 360, marginLeft: 'auto' }}
            onSearch={(value) => {
              const q = value.trim();
              navigate(q ? `/tickets?search=${encodeURIComponent(q)}` : '/tickets');
            }}
          />
          <NotificationBell />
          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }} data-testid="user-menu">
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }}>
                {user?.fullName?.[0]}
              </Avatar>
              <span>{user?.fullName}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
