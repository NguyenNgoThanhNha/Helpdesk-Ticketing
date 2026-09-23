import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
  Upload,
  type UploadFile,
} from 'antd';
import { ArrowLeftOutlined, PaperClipOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getStatus, showError } from '@/api/errors';
import {
  TICKET_PRIORITIES,
  type TicketDetailDto,
  type TicketHistoryDto,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketRequest,
} from '@/types';
import { formatDateTime, MAX_FILE_SIZE, slaCountdown } from '@/utils/format';
import { AttachmentLink } from './AttachmentLink';
import { PriorityTag, SlaBadge, StatusTag, STATUS_META } from './components';
import { useAddComment, useAssignees, useTicket, useTicketHistory, useUpdateTicket } from './hooks';

export const CONFLICT_MESSAGE = 'Ticket đã được người khác cập nhật, đang tải lại';

/** Badge telling whether a message comes from the ticket requester or from support staff. */
function AuthorBadge({ isRequester }: { isRequester: boolean }) {
  return isRequester ? <Tag>Khách hàng</Tag> : <Tag color="blue">Nhân viên hỗ trợ</Tag>;
}

/** Re-renders every minute so SLA countdown text stays fresh. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function historyText(h: TicketHistoryDto): React.ReactNode {
  const arrow = (
    <>
      {h.oldValue ?? '—'} → <b>{h.newValue ?? '—'}</b>
    </>
  );
  switch (h.field) {
    case 'Created':
      return 'Tạo ticket';
    case 'Status':
      return <>Đổi trạng thái: {arrow}</>;
    case 'Priority':
      return <>Đổi ưu tiên: {arrow}</>;
    case 'Assignee':
      return h.newValue ? (
        <>
          Gán cho <b>{h.newValue}</b>
          {h.oldValue ? ` (trước: ${h.oldValue})` : ''}
        </>
      ) : (
        <>Bỏ gán {h.oldValue ?? ''}</>
      );
    case 'Sla':
      return <>SLA: {arrow}</>;
    default:
      return (
        <>
          {h.field}: {arrow}
        </>
      );
  }
}

function SlaDue({ ticket }: { ticket: TicketDetailDto }) {
  const now = useNow();
  if (!ticket.resolveDueAt) return <Typography.Text type="secondary">—</Typography.Text>;
  const finished = ticket.status === 'Resolved' || ticket.status === 'Closed';
  const text = finished ? null : slaCountdown(ticket.resolveDueAt, now);
  return (
    <Space direction="vertical" size={0}>
      <SlaBadge state={ticket.slaState} text={text} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Hạn: {formatDateTime(ticket.resolveDueAt)}
      </Typography.Text>
    </Space>
  );
}

function ReplyBox({ ticketId }: { ticketId: number }) {
  const { message } = App.useApp();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const addComment = useAddComment(ticketId);

  const send = () => {
    const text = body.trim();
    if (!text) {
      void message.warning('Vui lòng nhập nội dung trả lời');
      return;
    }
    addComment.mutate(
      {
        body: text,
        files: files.map((f) => f.originFileObj).filter((f): f is NonNullable<typeof f> => !!f),
      },
      {
        onSuccess: () => {
          setBody('');
          setFiles([]);
          void message.success('Đã gửi trả lời');
        },
      },
    );
  };

  return (
    <div>
      <Input.TextArea
        aria-label="Nội dung trả lời"
        placeholder="Nhập trả lời..."
        rows={4}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        disabled={addComment.isPending}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
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
          <Button icon={<PaperClipOutlined />} disabled={addComment.isPending}>
            Đính kèm
          </Button>
        </Upload>
        <Button type="primary" icon={<SendOutlined />} loading={addComment.isPending} onClick={send}>
          Gửi
        </Button>
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { message } = App.useApp();

  const ticketQuery = useTicket(id);
  const historyQuery = useTicketHistory(id);
  const assignees = useAssignees();
  const update = useUpdateTicket(id);

  const ticket = ticketQuery.data;

  const patch = (changes: Omit<UpdateTicketRequest, 'rowVersion'>) => {
    if (!ticket) return;
    update.mutate(
      { rowVersion: ticket.rowVersion, ...changes },
      {
        onSuccess: () => void message.success('Đã cập nhật ticket'),
        onError: (err) => {
          if (getStatus(err) === 409) {
            void message.warning(CONFLICT_MESSAGE);
            void ticketQuery.refetch();
            void historyQuery.refetch();
          } else {
            showError(err);
          }
        },
      },
    );
  };

  if (!Number.isFinite(id) || id <= 0) {
    return <Result status="404" title="Ticket không hợp lệ" />;
  }
  if (ticketQuery.isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }
  if (ticketQuery.isError || !ticket) {
    const status = getStatus(ticketQuery.error);
    return (
      <Result
        status={status === 403 ? '403' : status === 404 ? '404' : 'error'}
        title={status === 404 ? 'Không tìm thấy ticket' : status === 403 ? 'Không có quyền xem ticket' : 'Lỗi tải ticket'}
        extra={
          <Link to="/tickets">
            <Button>Về danh sách</Button>
          </Link>
        }
      />
    );
  }

  const ticketAttachments = ticket.attachments.filter((a) => a.commentId === null);
  const statusOptions = [ticket.status, ...ticket.allowedTransitions.filter((s) => s !== ticket.status)].map(
    (s: TicketStatus) => ({ value: s, label: STATUS_META[s]?.label ?? s }),
  );

  const agentOptions = (assignees.data ?? []).map((a) => ({ value: a.id, label: a.fullName }));
  if (ticket.assignee && !agentOptions.some((o) => o.value === ticket.assignee?.id)) {
    agentOptions.unshift({ value: ticket.assignee.id, label: ticket.assignee.fullName });
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="center" wrap>
        <Link to="/tickets">
          <Button icon={<ArrowLeftOutlined />} aria-label="Quay lại" />
        </Link>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Ticket #{ticket.id} — {ticket.title}
        </Typography.Title>
        <StatusTag status={ticket.status} />
        <PriorityTag priority={ticket.priority} />
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="Mô tả">
              <Space style={{ marginBottom: 8 }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Typography.Text strong>{ticket.createdBy.fullName}</Typography.Text>
                <AuthorBadge isRequester />
                <Typography.Text type="secondary">{formatDateTime(ticket.createdAt)}</Typography.Text>
              </Space>
              <Typography.Paragraph className="comment-body">{ticket.description}</Typography.Paragraph>
              {ticketAttachments.length > 0 && (
                <Space direction="vertical" size={0}>
                  {ticketAttachments.map((a) => (
                    <AttachmentLink key={a.id} ticketId={ticket.id} attachment={a} />
                  ))}
                </Space>
              )}
            </Card>

            <Card title={`Conversation (${ticket.comments.length})`}>
              {ticket.comments.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có trao đổi" />
              ) : (
                <Timeline
                  items={ticket.comments.map((c) => ({
                    key: c.id,
                    color: c.isFromRequester ? 'gray' : 'blue',
                    children: (
                      <div data-testid="comment">
                        <Space size={4} wrap>
                          <Typography.Text strong>{c.author.fullName}</Typography.Text>
                          <AuthorBadge isRequester={c.isFromRequester} />
                          <Typography.Text type="secondary" title={formatDateTime(c.createdAt)}>
                            · {dayjs(c.createdAt).fromNow()}
                          </Typography.Text>
                        </Space>
                        <div className="comment-body" style={{ marginTop: 4 }}>
                          {c.body}
                        </div>
                        {c.attachments.length > 0 && (
                          <Space direction="vertical" size={0}>
                            {c.attachments.map((a) => (
                              <AttachmentLink key={a.id} ticketId={ticket.id} attachment={a} />
                            ))}
                          </Space>
                        )}
                      </div>
                    ),
                  }))}
                />
              )}
              {ticket.canComment ? (
                <ReplyBox ticketId={ticket.id} />
              ) : (
                <Typography.Text type="secondary">
                  {ticket.status === 'Closed' ? 'Ticket đã đóng, không thể trả lời.' : 'Bạn không có quyền trả lời ticket này.'}
                </Typography.Text>
              )}
            </Card>
          </Space>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="Thông tin">
              <Descriptions column={1} size="small" styles={{ label: { width: 110 } }}>
                <Descriptions.Item label="Status">
                  <Select
                    aria-label="Đổi trạng thái"
                    style={{ width: '100%' }}
                    value={ticket.status}
                    options={statusOptions}
                    disabled={ticket.allowedTransitions.length === 0 || update.isPending}
                    onChange={(s: TicketStatus) => s !== ticket.status && patch({ status: s })}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  {ticket.canChangePriority ? (
                    <Select
                      aria-label="Đổi ưu tiên"
                      style={{ width: '100%' }}
                      value={ticket.priority}
                      disabled={update.isPending}
                      options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p }))}
                      onChange={(p: TicketPriority) => p !== ticket.priority && patch({ priority: p })}
                    />
                  ) : (
                    <PriorityTag priority={ticket.priority} />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Category">{ticket.category.name}</Descriptions.Item>
                <Descriptions.Item label="Assignee">
                  {ticket.canAssign ? (
                    <Select
                      aria-label="Gán người xử lý"
                      style={{ width: '100%' }}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Chưa gán"
                      value={ticket.assignee?.id}
                      loading={assignees.isLoading}
                      disabled={update.isPending}
                      options={agentOptions}
                      onChange={(v?: string) => {
                        if (!v) {
                          if (ticket.assignee) patch({ unassign: true });
                        } else if (v !== ticket.assignee?.id) {
                          patch({ assigneeId: v });
                        }
                      }}
                    />
                  ) : (
                    (ticket.assignee?.fullName ?? <Typography.Text type="secondary">Chưa gán</Typography.Text>)
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created by">{ticket.createdBy.fullName}</Descriptions.Item>
                <Descriptions.Item label="Created">{formatDateTime(ticket.createdAt)}</Descriptions.Item>
                {ticket.responseDueAt && !ticket.firstRespondedAt && (
                  <Descriptions.Item label="Phản hồi trước">{formatDateTime(ticket.responseDueAt)}</Descriptions.Item>
                )}
                <Descriptions.Item label="SLA">
                  <SlaDue ticket={ticket} />
                </Descriptions.Item>
                {ticket.resolvedAt && (
                  <Descriptions.Item label="Resolved">{formatDateTime(ticket.resolvedAt)}</Descriptions.Item>
                )}
                {ticket.closedAt && <Descriptions.Item label="Closed">{formatDateTime(ticket.closedAt)}</Descriptions.Item>}
              </Descriptions>
            </Card>

            <Card title="History (audit)" loading={historyQuery.isLoading}>
              {historyQuery.data?.length ? (
                <Timeline
                  items={historyQuery.data.map((h) => ({
                    key: h.id,
                    children: (
                      <div>
                        <div>{historyText(h)}</div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {h.changedBy?.fullName ?? 'Hệ thống'} · {formatDateTime(h.changedAt)}
                        </Typography.Text>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
