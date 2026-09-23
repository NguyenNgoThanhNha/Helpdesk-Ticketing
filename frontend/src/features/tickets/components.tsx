import { Tag, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import type { SlaState, TicketPriority, TicketStatus } from '@/types';

export const STATUS_META: Record<TicketStatus, { color: string; label: string }> = {
  New: { color: 'blue', label: 'New' },
  Open: { color: 'cyan', label: 'Open' },
  InProgress: { color: 'geekblue', label: 'In Progress' },
  Pending: { color: 'purple', label: 'Pending' },
  Resolved: { color: 'green', label: 'Resolved' },
  Closed: { color: 'default', label: 'Closed' },
};

export const PRIORITY_META: Record<TicketPriority, { color: string; label: string }> = {
  Urgent: { color: 'red', label: 'Urgent' },
  High: { color: 'volcano', label: 'High' },
  Medium: { color: 'gold', label: 'Medium' },
  Low: { color: 'default', label: 'Low' },
};

export const SLA_META: Record<SlaState, { color: string; label: string }> = {
  OnTrack: { color: '#52c41a', label: 'Còn hạn (On track)' },
  AtRisk: { color: '#fa8c16', label: 'Sắp hết hạn (At risk)' },
  Breached: { color: '#f5222d', label: 'Quá hạn (Breached)' },
  Met: { color: '#8c8c8c', label: 'Đạt SLA (Met)' },
};

export function StatusTag({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status] ?? { color: 'default', label: status };
  return (
    <Tag color={meta.color} data-testid="status-tag">
      {meta.label}
    </Tag>
  );
}

export function PriorityTag({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority] ?? { color: 'default', label: priority };
  return (
    <Tag color={meta.color} data-testid="priority-tag">
      {meta.label}
    </Tag>
  );
}

const SLA_ICON: Record<SlaState, React.ReactNode> = {
  OnTrack: <CheckCircleOutlined />,
  AtRisk: <ClockCircleFilled />,
  Breached: <ExclamationCircleFilled />,
  Met: <CheckCircleFilled />,
};

export function SlaBadge({ state, text }: { state: SlaState; text?: string | null }) {
  const meta = SLA_META[state];
  if (!meta) return null;
  return (
    <Tooltip title={meta.label}>
      <span
        role="img"
        aria-label={`SLA ${state}`}
        data-sla-state={state}
        style={{ color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        {SLA_ICON[state]}
        {text && <span>{text}</span>}
      </span>
    </Tooltip>
  );
}
