import { useEffect, useState } from 'react';
import { FilterX, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/common/combobox';
import { useDebouncedCallback } from '@/lib/hooks/use-debounced-callback';
import type { ParamPatch } from '@/lib/hooks/use-url-params';
import { SLA_STATES, TICKET_PRIORITIES, TICKET_STATUSES, type TicketsQuery } from '@/types';
import { useAssignees, useCategories } from '../hooks/use-lookups';
import { hasActiveFilters } from '../ticket-query';
import { PRIORITY_META, SEARCH_PLACEHOLDER, SLA_META, STATUS_META, TICKET_FIELD_LABEL as F } from './ticket-meta';

const ALL = '__all__';

function FilterSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  className = 'w-full sm:w-36',
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>
          <span className="text-muted-foreground">{placeholder}: tất cả</span>
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface TicketFiltersProps {
  query: TicketsQuery;
  onChange: (patch: ParamPatch) => void;
  /** removes every filter and the search */
  onClear: () => void;
  /** Assignee filter (only for TICKET:R and not on My Queue) */
  showAssignee: boolean;
}

/** Status / priority / category / assignee / SLA / search filters; values come from and go to the URL. */
export function TicketFilters({ query, onChange, onClear, showAssignee }: TicketFiltersProps) {
  const categories = useCategories();
  const assignees = useAssignees();
  const [searchText, setSearchText] = useState(query.search ?? '');
  useEffect(() => setSearchText(query.search ?? ''), [query.search]);

  /** Search is applied once the user stops typing (Enter applies it immediately). */
  const applySearch = useDebouncedCallback((text: string) => {
    const search = text.trim() || undefined;
    if (search !== query.search) onChange({ search });
  });

  const hasFilters = hasActiveFilters(query, showAssignee);

  const assigneeOptions = [
    { value: 'me', label: 'Của tôi' },
    { value: 'unassigned', label: 'Chưa gán' },
    ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.fullName })),
  ];

  return (
    // 2-column grid on phones (instead of one full-width row per filter), wrapping row from sm up
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <FilterSelect
        label="Lọc theo trạng thái"
        placeholder={F.status}
        value={query.status}
        onChange={(v) => onChange({ status: v })}
        options={TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
      />
      <FilterSelect
        label="Lọc theo ưu tiên"
        placeholder={F.priority}
        value={query.priority}
        onChange={(v) => onChange({ priority: v })}
        options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
      />
      <FilterSelect
        label="Lọc theo danh mục"
        placeholder={F.category}
        className="w-full sm:w-40"
        value={query.categoryId ? String(query.categoryId) : undefined}
        onChange={(v) => onChange({ categoryId: v })}
        options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
      />
      {showAssignee && (
        <Combobox
          aria-label="Lọc theo người xử lý"
          className="w-full sm:w-44"
          placeholder={F.assignee}
          searchPlaceholder="Tìm người xử lý..."
          allowClear
          clearLabel="Tất cả người xử lý"
          loading={assignees.isLoading}
          value={query.assigneeId}
          onChange={(v) => onChange({ assigneeId: v })}
          options={assigneeOptions}
        />
      )}
      <FilterSelect
        label="Lọc theo SLA"
        placeholder={F.sla}
        className="w-full sm:w-44"
        value={query.slaState}
        onChange={(v) => onChange({ slaState: v })}
        options={SLA_STATES.map((s) => ({ value: s, label: SLA_META[s].label }))}
      />
      <form
        role="search"
        // takes the rest of the row (or a row of its own) so the search hint is readable
        className="relative col-span-2 w-full sm:min-w-72 sm:flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch.flush(searchText);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Tìm kiếm ticket"
          placeholder={SEARCH_PLACEHOLDER}
          title={SEARCH_PLACEHOLDER}
          className="pl-8"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            applySearch.run(e.target.value);
          }}
        />
      </form>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="col-span-2 justify-self-start"
          onClick={() => {
            applySearch.cancel();
            onClear();
          }}
        >
          <FilterX /> Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
