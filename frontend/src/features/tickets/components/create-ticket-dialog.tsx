import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePicker } from '@/components/common/file-picker';
import { REQUIRED_LABEL_CLASS, TextareaFormField, TextFormField } from '@/components/common/form-fields';
import { applyFieldErrors, showError } from '@/lib/api-errors';
import { TICKET_PRIORITIES, type TicketDetailDto } from '@/types';
import { useCategories } from '../hooks/use-lookups';
import { useCreateTicket } from '../hooks/use-tickets';
import { CREATE_TICKET_FIELDS, createTicketSchema, type CreateTicketForm } from '../schemas';
import { PRIORITY_META } from './ticket-meta';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticket: TicketDetailDto) => void;
}

const DEFAULTS = { title: '', description: '', categoryId: undefined, priority: 'Medium' } as const;

export function CreateTicketDialog({ open, onOpenChange, onCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const categories = useCategories();
  const create = useCreateTicket();

  const form = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: DEFAULTS as unknown as CreateTicketForm,
  });
  const submitting = form.formState.isSubmitting || create.isPending;

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      form.reset(DEFAULTS as unknown as CreateTicketForm);
      setFiles([]);
    }
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { ticket, failed } = await create.mutateAsync({ body: values, files });
      toast.success(`Đã tạo ticket #${ticket.id}`);
      if (failed.length) toast.warning(`Không tải lên được: ${failed.join(', ')}`);
      form.reset(DEFAULTS as unknown as CreateTicketForm);
      setFiles([]);
      onCreated?.(ticket);
      onOpenChange(false);
    } catch (err) {
      if (!applyFieldErrors(err, CREATE_TICKET_FIELDS, form.setError)) showError(err);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => submitting && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
          <DialogDescription>Mô tả vấn đề bạn gặp phải, bộ phận hỗ trợ sẽ phản hồi sớm.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="create-ticket-form" onSubmit={onSubmit} noValidate className="space-y-4">
            <TextFormField control={form.control} name="title" label="Tiêu đề" required placeholder="Tóm tắt vấn đề" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={REQUIRED_LABEL_CLASS}>Danh mục</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={categories.isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" onBlur={field.onBlur}>
                          <SelectValue placeholder="Chọn danh mục" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(categories.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={REQUIRED_LABEL_CLASS}>Ưu tiên</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full" onBlur={field.onBlur}>
                          <SelectValue placeholder="Chọn mức ưu tiên" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRIORITY_META[p].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <TextareaFormField
              control={form.control}
              name="description"
              label="Mô tả"
              required
              rows={6}
              maxLength={4000}
              className="max-h-72"
            />
            <div className="space-y-2">
              <Label>Đính kèm</Label>
              <FilePicker files={files} onChange={setFiles} disabled={submitting} />
              <p className="text-xs text-muted-foreground">Tối đa 10MB mỗi file</p>
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" form="create-ticket-form" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
