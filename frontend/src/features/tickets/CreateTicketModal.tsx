import { useState } from 'react';
import { App, Button, Col, Form, Input, Modal, Row, Select, Upload, type UploadFile } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { applyFieldErrors, showError } from '@/api/errors';
import { FormField } from '@/components/FormField';
import { TICKET_PRIORITIES, type TicketDetailDto } from '@/types';
import { MAX_FILE_SIZE } from '@/utils/format';
import { useCategories, useCreateTicket } from './hooks';

export const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200, 'Tiêu đề tối đa 200 ký tự'),
  description: z.string().trim().min(1, 'Vui lòng nhập mô tả').max(4000, 'Mô tả tối đa 4000 ký tự'),
  categoryId: z
    .number({ required_error: 'Vui lòng chọn danh mục', invalid_type_error: 'Vui lòng chọn danh mục' })
    .int()
    .positive('Vui lòng chọn danh mục'),
  priority: z.enum(TICKET_PRIORITIES, { required_error: 'Vui lòng chọn mức ưu tiên' }),
});
export type CreateTicketForm = z.infer<typeof createTicketSchema>;

const FIELDS = ['title', 'description', 'categoryId', 'priority'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (ticket: TicketDetailDto) => void;
}

export function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const { message } = App.useApp();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const categories = useCategories();
  const create = useCreateTicket();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: '', description: '', categoryId: undefined, priority: 'Medium' },
  });

  const submitting = isSubmitting || create.isPending;

  const close = () => {
    if (submitting) return;
    reset();
    setFiles([]);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { ticket, failed } = await create.mutateAsync({
        body: values,
        files: files.map((f) => f.originFileObj).filter((f): f is NonNullable<typeof f> => !!f),
      });
      void message.success(`Đã tạo ticket #${ticket.id}`);
      if (failed.length) void message.warning(`Không tải lên được: ${failed.join(', ')}`);
      reset();
      setFiles([]);
      onCreated?.(ticket);
      onClose();
    } catch (err) {
      if (!applyFieldErrors(err, FIELDS, setError)) showError(err);
    }
  });

  return (
    <Modal
      title="New Ticket"
      open={open}
      onCancel={close}
      width={640}
      destroyOnHidden
      maskClosable={!submitting}
      footer={[
        <Button key="cancel" onClick={close} disabled={submitting}>
          Hủy
        </Button>,
        <Button key="submit" type="primary" loading={submitting} disabled={submitting} onClick={() => void onSubmit()}>
          Tạo
        </Button>,
      ]}
    >
      <Form layout="vertical" component="div">
        <FormField label="Tiêu đề" required error={errors.title} htmlFor="ticket-title">
          <Controller
            name="title"
            control={control}
            render={({ field }) => <Input {...field} id="ticket-title" placeholder="Tóm tắt vấn đề" />}
          />
        </FormField>
        <Row gutter={16}>
          <Col span={12}>
            <FormField label="Danh mục" required error={errors.categoryId} htmlFor="ticket-category">
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    id="ticket-category"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Chọn danh mục"
                    loading={categories.isLoading}
                    options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              />
            </FormField>
          </Col>
          <Col span={12}>
            <FormField label="Ưu tiên" required error={errors.priority} htmlFor="ticket-priority">
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    id="ticket-priority"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
                  />
                )}
              />
            </FormField>
          </Col>
        </Row>
        <FormField label="Mô tả" required error={errors.description} htmlFor="ticket-description">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input.TextArea {...field} id="ticket-description" rows={6} showCount maxLength={4000} />
            )}
          />
        </FormField>
        <Form.Item label="Đính kèm" extra="Tối đa 10MB mỗi file">
          <Upload
            multiple
            fileList={files}
            beforeUpload={(file) => {
              if (file.size > MAX_FILE_SIZE) {
                void message.error(`${file.name} vượt quá 10MB`);
                return Upload.LIST_IGNORE;
              }
              return false;
            }}
            onChange={({ fileList }) => setFiles(fileList)}
          >
            <Button icon={<PaperClipOutlined />}>Chọn file...</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
}
