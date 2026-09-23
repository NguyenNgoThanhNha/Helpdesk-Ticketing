import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Col, DatePicker, Empty, Progress, Row, Space, Statistic, Table, Typography, type TableProps } from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reportsApi } from '@/api/endpoints';
import { queryKeys } from '@/api/queryClient';
import type { AgentPerformanceDto } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  New: '#1677ff',
  Open: '#13c2c2',
  InProgress: '#2f54eb',
  Pending: '#722ed1',
  Resolved: '#52c41a',
  Closed: '#8c8c8c',
};
const FALLBACK_COLORS = ['#1677ff', '#fa8c16', '#eb2f96', '#a0d911', '#faad14', '#597ef7'];

const fmtHours = (h: number | null | undefined) => (h === null || h === undefined ? '—' : `${h.toFixed(1)}h`);
const fmtPct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : `${p.toFixed(1)}%`);

type Range = [Dayjs, Dayjs];
const defaultRange = (): Range => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')];

export function DashboardPage({ title = 'Dashboard' }: { title?: string }) {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>(defaultRange);
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.reportSummary(params),
    queryFn: () => reportsApi.summary(params),
    placeholderData: keepPreviousData,
  });

  const agentColumns: TableProps<AgentPerformanceDto>['columns'] = [
    { title: 'Agent', dataIndex: 'agentName', key: 'agentName' },
    { title: 'Được gán', dataIndex: 'assigned', key: 'assigned', width: 100, align: 'right' },
    { title: 'Đã giải quyết', dataIndex: 'resolved', key: 'resolved', width: 120, align: 'right' },
    {
      title: 'Tỉ lệ giải quyết',
      key: 'resolvedRate',
      width: 200,
      render: (_, r) => (
        <Progress percent={r.assigned ? Math.round((r.resolved / r.assigned) * 100) : 0} size="small" />
      ),
    },
    {
      title: 'Avg resolution',
      dataIndex: 'avgResolutionHours',
      key: 'avg',
      width: 130,
      align: 'right',
      render: (v: number | null) => fmtHours(v),
    },
    {
      title: 'SLA compliance',
      dataIndex: 'slaComplianceRate',
      key: 'sla',
      width: 200,
      render: (v: number | null) =>
        v === null ? (
          '—'
        ) : (
          <Progress
            percent={Math.round(v)}
            size="small"
            status={v >= 80 ? 'success' : v >= 60 ? 'normal' : 'exception'}
          />
        ),
    },
  ];

  const byStatus = (data?.byStatus ?? []).filter((s) => s.count > 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <DatePicker.RangePicker
          value={range}
          allowClear={false}
          format="DD/MM/YYYY"
          disabledDate={(d) => d.isAfter(dayjs().endOf('day'))}
          presets={[
            { label: '7 ngày', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
            { label: '30 ngày', value: defaultRange() },
            { label: '90 ngày', value: [dayjs().subtract(89, 'day').startOf('day'), dayjs().endOf('day')] },
          ]}
          onChange={(v) => {
            if (v?.[0] && v[1]) setRange([v[0], v[1]]);
          }}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col flex="1 1 200px">
          <Card loading={isLoading} hoverable onClick={() => navigate('/tickets')}>
            <Statistic title="Tổng" value={data?.totalTickets ?? 0} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col flex="1 1 200px">
          <Card loading={isLoading} hoverable onClick={() => navigate('/tickets?status=Open')}>
            <Statistic title="Open" value={data?.openTickets ?? 0} prefix={<FolderOpenOutlined />} />
          </Card>
        </Col>
        <Col flex="1 1 200px">
          <Card loading={isLoading} hoverable onClick={() => navigate('/tickets?slaState=Breached')}>
            <Statistic
              title="Quá SLA"
              value={data?.breachedTickets ?? 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col flex="1 1 200px">
          <Card loading={isLoading}>
            <Statistic
              title="Avg resolution"
              value={fmtHours(data?.avgResolutionHours)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col flex="1 1 200px">
          <Card loading={isLoading}>
            <Statistic
              title="SLA compliance"
              value={fmtPct(data?.slaComplianceRate)}
              valueStyle={{
                color:
                  data?.slaComplianceRate == null
                    ? undefined
                    : data.slaComplianceRate >= 80
                      ? '#3f8600'
                      : '#cf1322',
              }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Ticket theo trạng thái" loading={isLoading}>
            {byStatus.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="key"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label
                  >
                    {byStatus.map((s, i) => (
                      <Cell key={s.key} fill={STATUS_COLORS[s.key] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty style={{ height: 300 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Ticket theo ngày" loading={isLoading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.byDay ?? []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('DD/MM')} minTickGap={16} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(d) => dayjs(String(d)).format('DD/MM/YYYY')} />
                <Line type="monotone" dataKey="count" name="Tickets" stroke="#1677ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Hiệu suất Agent" loading={isLoading}>
            <Table<AgentPerformanceDto>
              rowKey="agentId"
              size="small"
              pagination={false}
              loading={isFetching && !isLoading}
              columns={agentColumns}
              dataSource={data?.agentPerformance ?? []}
              scroll={{ x: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Theo danh mục" loading={isLoading}>
            {data?.byCategory?.length ? (
              <ResponsiveContainer width="100%" height={Math.max(200, data.byCategory.length * 36)}>
                <BarChart data={data.byCategory} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="key" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Tickets" fill="#1677ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
