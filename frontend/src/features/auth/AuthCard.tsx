import type { ReactNode } from 'react';
import { Card, Space, Typography } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 16 }}>
          <CustomerServiceOutlined style={{ fontSize: 36, color: '#1677ff' }} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        </Space>
        {children}
      </Card>
    </div>
  );
}
