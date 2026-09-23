import type { ReactNode } from 'react';
import { Checkbox, Table, Tooltip, Typography, type TableProps } from 'antd';
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityDto, type ActivityPermissionInput, type CrudFlags } from '@/types';

const FLAG: Record<ActivityAction, keyof CrudFlags> = { C: 'c', R: 'r', U: 'u', D: 'd' };
const ACTION_LABEL: Record<ActivityAction, string> = { C: 'Create', R: 'Read', U: 'Update', D: 'Delete' };

/**
 * Flags that are meaningful for the known activity codes (API contract table).
 * Unknown codes: all flags enabled.
 */
const APPLICABLE: Record<string, ActivityAction[]> = {
  TICKET: ['C', 'R', 'U', 'D'],
  TICKET_ASSIGN: ['R', 'U'],
  COMMENT: ['C'],
  REPORT: ['R'],
  CATEGORY: ['C', 'U'],
  SLA_POLICY: ['U'],
  USER: ['R', 'U'],
  ROLE: ['C', 'R', 'U', 'D'],
};

const isApplicable = (code: string, action: ActivityAction) => (APPLICABLE[code] ?? ACTIVITY_ACTIONS).includes(action);

const emptyFlags: CrudFlags = { c: false, r: false, u: false, d: false };

/** Removes rows where every flag is false (the API drops them anyway). */
export function normalizePermissions(value: ActivityPermissionInput[]): ActivityPermissionInput[] {
  return value.filter((p) => p.c || p.r || p.u || p.d);
}

/** Maps ActivityPermissionDto-like rows to API inputs. */
export function toPermissionInputs(rows: (CrudFlags & { activityId: string })[]): ActivityPermissionInput[] {
  return rows.map(({ activityId, c, r, u, d }) => ({ activityId, c, r, u, d }));
}

/** Returns a new value with one flag toggled. */
export function togglePermission(
  value: ActivityPermissionInput[],
  activityId: string,
  action: ActivityAction,
  checked: boolean,
): ActivityPermissionInput[] {
  const key = FLAG[action];
  const exists = value.some((p) => p.activityId === activityId);
  if (!exists) return [...value, { activityId, ...emptyFlags, [key]: checked }];
  return value.map((p) => (p.activityId === activityId ? { ...p, [key]: checked } : p));
}

export interface PermissionMatrixProps {
  activities: ActivityDto[];
  value: ActivityPermissionInput[];
  onChange?: (next: ActivityPermissionInput[]) => void;
  readOnly?: boolean;
  loading?: boolean;
  /** Optional extra column (e.g. effective permissions). */
  extraColumn?: { title: ReactNode; render: (activity: ActivityDto) => ReactNode; width?: number };
}

/** Reusable activity × C/R/U/D checkbox matrix. */
export function PermissionMatrix({ activities, value, onChange, readOnly, loading, extraColumn }: PermissionMatrixProps) {
  const flagsOf = (activityId: string): CrudFlags => value.find((p) => p.activityId === activityId) ?? emptyFlags;

  const setRow = (activity: ActivityDto, checked: boolean) => {
    let next = value;
    for (const action of ACTIVITY_ACTIONS) {
      if (isApplicable(activity.code, action)) next = togglePermission(next, activity.id, action, checked);
    }
    onChange?.(next);
  };

  const columns: TableProps<ActivityDto>['columns'] = [
    {
      title: 'Chức năng',
      key: 'activity',
      render: (_, a) => (
        <div>
          <Typography.Text strong>{a.name}</Typography.Text>{' '}
          <Typography.Text type="secondary" code style={{ fontSize: 11 }}>
            {a.code}
          </Typography.Text>
          {a.description && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {a.description}
              </Typography.Text>
            </div>
          )}
        </div>
      ),
    },
    ...ACTIVITY_ACTIONS.map((action) => ({
      title: <Tooltip title={ACTION_LABEL[action]}>{action}</Tooltip>,
      key: action,
      width: 56,
      align: 'center' as const,
      render: (_: unknown, a: ActivityDto) => {
        const checked = flagsOf(a.id)[FLAG[action]];
        const applicable = isApplicable(a.code, action);
        return (
          <Checkbox
            aria-label={`${a.code} ${action}`}
            checked={checked}
            disabled={readOnly || (!applicable && !checked)}
            onChange={(e) => onChange?.(togglePermission(value, a.id, action, e.target.checked))}
          />
        );
      },
    })),
  ];

  if (!readOnly) {
    columns.push({
      title: 'Tất cả',
      key: 'all',
      width: 70,
      align: 'center',
      render: (_, a) => {
        const flags = flagsOf(a.id);
        const applicable = ACTIVITY_ACTIONS.filter((x) => isApplicable(a.code, x));
        const on = applicable.filter((x) => flags[FLAG[x]]).length;
        return (
          <Checkbox
            aria-label={`${a.code} all`}
            checked={on > 0 && on === applicable.length}
            indeterminate={on > 0 && on < applicable.length}
            onChange={(e) => setRow(a, e.target.checked)}
          />
        );
      },
    });
  }

  if (extraColumn) {
    columns.push({ title: extraColumn.title, key: 'extra', width: extraColumn.width, render: (_, a) => extraColumn.render(a) });
  }

  return (
    <Table<ActivityDto>
      rowKey="id"
      size="small"
      pagination={false}
      loading={loading}
      columns={columns}
      dataSource={activities}
      data-testid="permission-matrix"
    />
  );
}

/** Small C/R/U/D tag list for read-only display. */
export function FlagsText({ flags }: { flags: CrudFlags | undefined }) {
  const on = ACTIVITY_ACTIONS.filter((a) => flags?.[FLAG[a]]);
  return on.length ? (
    <Typography.Text code>{on.join('')}</Typography.Text>
  ) : (
    <Typography.Text type="secondary">—</Typography.Text>
  );
}
