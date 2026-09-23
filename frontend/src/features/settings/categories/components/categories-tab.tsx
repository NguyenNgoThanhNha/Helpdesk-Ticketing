import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import { useCategories } from '@/features/tickets';
import { useCan } from '@/stores/auth-store';
import type { CategoryDto } from '@/types';
import { CategoryDialog } from './category-dialog';

export function CategoriesTab() {
  const { data, isLoading } = useCategories();
  const canCreate = useCan('CATEGORY', 'C');
  const canUpdate = useCan('CATEGORY', 'U');
  const [dialog, setDialog] = useState<{ open: boolean; category: CategoryDto | null }>({ open: false, category: null });

  const columns: ColumnDef<CategoryDto>[] = [
    { id: 'id', header: 'ID', cell: ({ row }) => row.original.id, meta: { headerClassName: 'w-20' } },
    { id: 'name', header: 'Tên', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: 'sla', header: 'SLA mặc định (giờ)', cell: ({ row }) => row.original.defaultSlaHours },
    {
      id: 'actions',
      header: '',
      meta: { cellClassName: 'text-right' },
      cell: ({ row }) =>
        canUpdate && (
          <Button variant="outline" size="sm" onClick={() => setDialog({ open: true, category: row.original })}>
            <Pencil /> Sửa
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true, category: null })}>
            <Plus /> Thêm danh mục
          </Button>
        </div>
      )}
      <DataTable
        aria-label="Danh mục"
        columns={columns}
        data={data ?? []}
        getRowId={(c) => String(c.id)}
        loading={isLoading}
      />
      <CategoryDialog
        category={dialog.category}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  );
}
