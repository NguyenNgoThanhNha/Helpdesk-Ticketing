import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { FileClock, Headset, Inbox, LayoutDashboard, ListTodo, Settings } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { canAny, PERMISSIONS, type PermissionRequirement } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** visible when the user has any of these permissions (empty = everyone) */
  anyOf: readonly PermissionRequirement[];
}

/** The dashboard also holds the reports (the former /reports page redirects there). */
export const NAV_MAIN: NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, anyOf: PERMISSIONS.dashboard },
  { to: '/tickets', label: 'Danh sách ticket', icon: ListTodo, anyOf: [] },
  { to: '/my-queue', label: 'Việc của tôi', icon: Inbox, anyOf: PERMISSIONS.myQueue },
];

export const NAV_ADMIN: NavItem[] = [
  { to: '/settings', label: 'Cài đặt', icon: Settings, anyOf: PERMISSIONS.settings },
  { to: '/api-logs', label: 'Nhật ký API', icon: FileClock, anyOf: PERMISSIONS.apiLogs },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const visible = items.filter((i) => canAny(user, i.anyOf));
  if (!visible.length) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" aria-label="Điều hướng chính">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Headset className="size-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Helpdesk</span>
                  <span className="truncate text-xs text-muted-foreground">Hệ thống hỗ trợ</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Hỗ trợ" items={NAV_MAIN} />
        <NavGroup label="Quản trị" items={NAV_ADMIN} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
