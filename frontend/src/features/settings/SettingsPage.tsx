import { Card, Tabs, type TabsProps } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { canAny, useAuthStore, type PermissionRequirement } from '@/stores/authStore';
import { CategoriesTab } from './CategoriesTab';
import { RolesTab } from './RolesTab';
import { SlaPoliciesTab } from './SlaPoliciesTab';
import { UsersTab } from './UsersTab';

const TABS: { key: string; label: string; anyOf: readonly PermissionRequirement[]; render: () => React.ReactNode }[] = [
  {
    key: 'categories',
    label: 'Categories',
    anyOf: [
      ['CATEGORY', 'C'],
      ['CATEGORY', 'U'],
    ],
    render: () => <CategoriesTab />,
  },
  { key: 'sla', label: 'SLA Policies', anyOf: [['SLA_POLICY', 'U']], render: () => <SlaPoliciesTab /> },
  { key: 'users', label: 'Users', anyOf: [['USER', 'R']], render: () => <UsersTab /> },
  { key: 'roles', label: 'Roles', anyOf: [['ROLE', 'R']], render: () => <RolesTab /> },
];

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const visible = TABS.filter((t) => canAny(user, t.anyOf));
  const active = visible.find((t) => t.key === params.get('tab'))?.key ?? visible[0]?.key;

  const items: TabsProps['items'] = visible.map((t) => ({ key: t.key, label: t.label, children: t.render() }));

  return (
    <Card title="Settings">
      <Tabs
        activeKey={active}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
        destroyOnHidden
        items={items}
      />
    </Card>
  );
}
