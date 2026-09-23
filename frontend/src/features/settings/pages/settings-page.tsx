import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/page-header';
import { canAny, type PermissionRequirement } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { CategoriesTab } from '../categories/components/categories-tab';
import { RolesTab } from '../roles/components/roles-tab';
import { SlaPoliciesTab } from '../sla-policies/components/sla-policies-tab';
import { UsersTab } from '../users/components/users-tab';

const TABS: { key: string; label: string; anyOf: readonly PermissionRequirement[]; render: () => ReactNode }[] = [
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

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Danh mục, SLA, người dùng và phân quyền" />
      <Tabs value={active} onValueChange={(key) => setParams({ tab: key }, { replace: true })}>
        <TabsList className="max-w-full overflow-x-auto">
          {visible.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {visible.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardContent>{t.render()}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
