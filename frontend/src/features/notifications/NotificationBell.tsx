import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Dropdown, Empty, List, Spin, Typography, theme } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { notificationsApi } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { NotificationDto } from '@/types';

export const UNREAD_POLL_INTERVAL = 30_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: UNREAD_POLL_INTERVAL,
    meta: { suppressGlobalError: true },
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const { data: unread = 0 } = useUnreadCount();
  const listQuery = useQuery({
    queryKey: queryKeys.notificationList,
    queryFn: () => notificationsApi.list({ take: 20 }),
    enabled: open,
    staleTime: 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate });

  const handleClick = (n: NotificationDto) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
  };

  const panel = (
    <div
      style={{
        width: 360,
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong>Thông báo</Typography.Text>
        <Button type="link" size="small" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
          Đánh dấu đã đọc tất cả
        </Button>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {listQuery.isLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : !listQuery.data?.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo" style={{ padding: 16 }} />
        ) : (
          <List
            dataSource={listQuery.data}
            renderItem={(n) => (
              <List.Item
                onClick={() => handleClick(n)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 16px',
                  background: n.isRead ? undefined : token.colorPrimaryBg,
                }}
                extra={
                  !n.isRead && (
                    <Button
                      type="link"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                    >
                      Đã đọc
                    </Button>
                  )
                }
              >
                <List.Item.Meta
                  title={<span style={{ fontWeight: n.isRead ? 400 : 600 }}>{n.message}</span>}
                  description={dayjs(n.createdAt).fromNow()}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <Dropdown open={open} onOpenChange={setOpen} trigger={['click']} popupRender={() => panel} placement="bottomRight">
      <Badge count={unread} size="small" overflowCount={99}>
        <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18 }} />} aria-label="Thông báo" />
      </Badge>
    </Dropdown>
  );
}
