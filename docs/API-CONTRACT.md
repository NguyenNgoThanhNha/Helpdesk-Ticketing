# API Contract — Helpdesk Ticketing (v1)

Base URL: `/api/v1`. JSON dùng **camelCase**, enum trả về **dạng string**. Ngày giờ ISO-8601 UTC.
Id của user / role / activity là **Guid (string)**; id của ticket, category, comment, attachment, notification là **number**.
Mọi endpoint (trừ `auth/*` không cần login) yêu cầu header `Authorization: Bearer <accessToken>`.
Lỗi trả về `application/problem+json` (ProblemDetails):

```json
{ "type": "...", "title": "Validation failed", "status": 400, "detail": "...",
  "errors": { "title": ["Title is required"] }, "traceId": "...", "instance": "/api/v1/tickets" }
```
Key trong `errors` **luôn camelCase**, kể cả lỗi binding tự động của ASP.NET (vd `statusCode=abc`). `instance` là path của request (có thể không có).

| Status | Khi nào |
|---|---|
| 400 | Validation (có `errors` theo field, key camelCase) |
| 401 | Chưa đăng nhập / token hết hạn → FE gọi `/auth/refresh` rồi retry |
| 403 | Không đủ quyền |
| 404 | Không tìm thấy |
| 409 | Xung đột (concurrency `rowVersion`, email đã tồn tại, chuyển trạng thái không hợp lệ) |

## Enums

- `TicketStatus`: `New` | `Open` | `InProgress` | `Pending` | `Resolved` | `Closed`
- `TicketPriority`: `Low` | `Medium` | `High` | `Urgent`
- `SlaState`: `OnTrack` | `AtRisk` | `Breached` | `Met` (Met = đã resolve/đóng đúng hạn)
- `ActivityAction`: `C` (Create) | `R` (Read) | `U` (Update) | `D` (Delete)

## Phân quyền (6 bảng: Account, Role, Activity, UserRole, RoleActivity, UserActivity)

- Mỗi **Activity** là một chức năng (mã `code`), mỗi quyền là cặp **(activity, C/R/U/D)**.
- User có thể có nhiều **Role**. Role gán quyền qua RoleActivity; user còn có thể được cấp **quyền riêng** qua UserActivity.
- **Quyền hiệu lực** = role Admin (`isAdmin`) → toàn quyền; ngược lại = OR( quyền của các role , quyền riêng của user ).
- FE ẩn/hiện menu, nút theo `permissions` của user hiện tại; BE luôn kiểm tra lại (403).

Mã activity (hằng số dùng chung FE/BE):

| Code | C | R | U | D |
|---|---|---|---|---|
| `TICKET` | Tạo ticket | Xem **tất cả** ticket (không có R vẫn xem được ticket của chính mình) | Đổi trạng thái / ưu tiên | Đóng ticket (→ `Closed`) |
| `TICKET_ASSIGN` | — | Được nhận gán ticket (nằm trong nhóm xử lý) | Gán / bỏ gán người xử lý | — |
| `COMMENT` | Bình luận / trả lời | — | — | — |
| `REPORT` | — | Xem dashboard / báo cáo | — | — |
| `CATEGORY` | Thêm | — (ai đăng nhập cũng đọc được) | Sửa | — |
| `SLA_POLICY` | — | — (ai đăng nhập cũng đọc được) | Sửa SLA | — |
| `USER` | — | Xem danh sách user | Khóa/mở, gán role, cấp quyền riêng | — |
| `ROLE` | Tạo role | Xem role + danh sách activity | Sửa role & quyền của role | Xóa role |
| `API_LOG` | — | Xem log request/response API (debug) | — | — |

Role seed mặc định: **Admin** (toàn quyền), **Agent** (TICKET CRUD, TICKET_ASSIGN RU, COMMENT C, REPORT R), **Customer** (TICKET C, COMMENT C). Đăng ký mới → role Customer.

```ts
PermissionDto = { code: string; c: boolean; r: boolean; u: boolean; d: boolean }
CurrentUserDto = { id: string; email: string; fullName: string; isAdmin: boolean;
                   roles: string[];              // tên role
                   permissions: PermissionDto[] } // quyền hiệu lực, chỉ gồm activity có ít nhất 1 cờ true
// Helper gợi ý phía FE: can(user, 'TICKET', 'R') => user.isAdmin || user.permissions.some(p => p.code === 'TICKET' && p.r)
```

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, fullName }` | `AuthResponse` |
| POST | `/auth/login` | `{ email, password }` | `AuthResponse` |
| POST | `/auth/refresh` | `{ refreshToken }` | `AuthResponse` (rotation: refresh token cũ bị revoke) |
| POST | `/auth/logout` | `{ refreshToken }` | 204 |
| POST | `/auth/forgot-password` | `{ email }` | 204 (luôn 204; dev: link reset in ra log) |
| POST | `/auth/reset-password` | `{ email, token, newPassword }` | 204 |
| GET | `/auth/me` | — | `CurrentUserDto` (gọi lại sau khi admin đổi quyền để refresh UI) |

```ts
AuthResponse = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string; user: CurrentUserDto }
UserSummaryDto = { id: string; fullName: string }
```

Mật khẩu: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số.

## Tickets

Quyền: xem danh sách/chi tiết — chủ ticket hoặc `TICKET:R`; tạo — `TICKET:C`.

### `GET /tickets`
Query: `status, priority, categoryId, assigneeId, search, slaState, page (1), pageSize (20, max 100), sort`
`sort` ∈ `createdAt_desc` (mặc định) | `createdAt_asc` | `priority_desc` | `priority_asc` | `status_asc` | `status_desc` | `resolveDueAt_asc` | `resolveDueAt_desc` | `title_asc` | `title_desc`
`assigneeId=me` → ticket gán cho user hiện tại (My Queue). `assigneeId=unassigned` → chưa gán.
User không có `TICKET:R` chỉ thấy ticket do mình tạo.

```ts
PagedResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number }
TicketListItemDto = {
  id: number; title: string; status: TicketStatus; priority: TicketPriority;
  categoryId: number; categoryName: string;
  assigneeId: string | null; assigneeName: string | null;
  createdById: string; createdByName: string;
  createdAt: string; resolveDueAt: string | null; slaState: SlaState; commentCount: number
}
```

### `POST /tickets` → 201 `TicketDetailDto`
Body `{ title (≤200), description (≤4000), categoryId, priority }`. File đính kèm upload sau qua `/tickets/{id}/attachments`.

### `GET /tickets/{id}` → `TicketDetailDto`
```ts
TicketDetailDto = {
  id: number; title: string; description: string; status: TicketStatus; priority: TicketPriority;
  category: { id: number; name: string };
  createdBy: UserSummaryDto; assignee: UserSummaryDto | null;
  createdAt: string; updatedAt: string | null; firstRespondedAt: string | null;
  resolvedAt: string | null; closedAt: string | null;
  responseDueAt: string | null; resolveDueAt: string | null; slaState: SlaState;
  rowVersion: string;                 // base64, gửi lại khi PATCH
  allowedTransitions: TicketStatus[]; // trạng thái user hiện tại được phép chuyển sang (đã tính quyền)
  canChangePriority: boolean;         // TICKET:U
  canAssign: boolean;                 // TICKET_ASSIGN:U
  canComment: boolean;                // COMMENT:C và ticket chưa Closed
  comments: CommentDto[];
  attachments: AttachmentDto[];       // tất cả file của ticket (kể cả file gắn comment)
}
CommentDto = { id: number; author: UserSummaryDto; isFromRequester: boolean; // true = người tạo ticket viết
               body: string; createdAt: string; attachments: AttachmentDto[] }
AttachmentDto = { id: number; fileName: string; contentType: string; size: number; commentId: number | null; uploadedAt: string }
```

### `PATCH /tickets/{id}` → `TicketDetailDto`
Body `{ rowVersion: string; status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null; unassign?: boolean }`
- `status` cần `TICKET:U` (sang `Closed` cần thêm `TICKET:D`). Riêng chủ ticket luôn được mở lại ticket của mình (`Resolved → Open`).
- `priority` cần `TICKET:U`; `assigneeId`/`unassign` cần `TICKET_ASSIGN:U`. Người được gán phải có `TICKET_ASSIGN:R`.
- 409 nếu `rowVersion` cũ.

Máy trạng thái:
```
New        → Open, InProgress, Closed
Open       → InProgress, Pending, Resolved, Closed
InProgress → Open, Pending, Resolved
Pending    → InProgress, Resolved
Resolved   → Open (reopen), Closed
Closed     → (kết thúc)
```

### Comment / Attachment / History (cần quyền xem ticket)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/tickets/{id}/comments` | `{ body }` (cần `COMMENT:C`) | 201 `CommentDto` |
| POST | `/tickets/{id}/attachments` | `multipart/form-data`: `file`, `commentId?` (≤10MB) | 201 `AttachmentDto` |
| GET | `/tickets/{id}/attachments/{attachmentId}` | — | file (download) |
| GET | `/tickets/{id}/history` | — | `TicketHistoryDto[]` (mới nhất trước) |

```ts
TicketHistoryDto = { id: number; field: string; oldValue: string | null; newValue: string | null; changedBy: UserSummaryDto | null; changedAt: string }
```
`field` ∈ `Created` | `Status` | `Priority` | `Assignee` | `Sla`. `changedBy = null` → hệ thống (job SLA).

## Categories
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| GET | `/categories` | đăng nhập | `CategoryDto[]` |
| POST | `/categories` | `CATEGORY:C` | `{ name, defaultSlaHours }` → 201 `CategoryDto` |
| PUT | `/categories/{id}` | `CATEGORY:U` | `{ name, defaultSlaHours }` → `CategoryDto` |

`CategoryDto = { id: number; name: string; defaultSlaHours: number }`

## SLA policies
| Method | Path | Quyền | Response |
|---|---|---|---|
| GET | `/sla-policies` | đăng nhập | `SlaPolicyDto[]` |
| PUT | `/sla-policies/{priority}` | `SLA_POLICY:U` | `{ responseHours, resolveHours }` → `SlaPolicyDto` |

`SlaPolicyDto = { id: number; priority: TicketPriority; responseHours: number; resolveHours: number }`

## Users & phân quyền theo tài khoản
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| GET | `/users/assignees` | `TICKET_ASSIGN:U` hoặc `TICKET:R` | `UserSummaryDto[]` (user active có `TICKET_ASSIGN:R` — dropdown Assign / filter Assignee) |
| GET | `/users?search=&roleId=&page=&pageSize=` | `USER:R` | `PagedResult<UserListItemDto>` |
| PATCH | `/users/{id}` | `USER:U` | `{ isActive }` → `UserListItemDto` |
| PUT | `/users/{id}/roles` | `USER:U` | `{ roleIds: string[] }` → `UserListItemDto` |
| GET | `/users/{id}/permissions` | `USER:R` | `UserPermissionDetailDto` |
| PUT | `/users/{id}/permissions` | `USER:U` | `{ activities: ActivityPermissionInput[] }` → `UserPermissionDetailDto` (thay toàn bộ quyền riêng; dòng có cả 4 cờ false bị bỏ) |

```ts
RoleRefDto = { id: string; name: string }
UserListItemDto = { id: string; email: string; fullName: string; isActive: boolean; roles: RoleRefDto[]; createdDate: string }
ActivityPermissionInput = { activityId: string; c: boolean; r: boolean; u: boolean; d: boolean }
ActivityPermissionDto = { activityId: string; code: string; name: string; c: boolean; r: boolean; u: boolean; d: boolean }
UserPermissionDetailDto = {
  userId: string; isAdmin: boolean; roles: RoleRefDto[];
  userActivities: ActivityPermissionDto[];   // quyền cấp riêng cho tài khoản (bảng UserActivity)
  effective: ActivityPermissionDto[]         // quyền hiệu lực sau khi gộp role + riêng
}
```
Không thể tự khóa tài khoản hoặc tự gỡ role Admin của chính mình (409).

## Roles & Activities
| Method | Path | Quyền | Body / Response |
|---|---|---|---|
| GET | `/activities` | `ROLE:R` hoặc `USER:R` | `ActivityDto[]` |
| GET | `/roles` | `ROLE:R` hoặc `USER:R` | `RoleDto[]` |
| GET | `/roles/{id}` | `ROLE:R` | `RoleDetailDto` |
| POST | `/roles` | `ROLE:C` | `{ name, description?, activities: ActivityPermissionInput[] }` → 201 `RoleDetailDto` |
| PUT | `/roles/{id}` | `ROLE:U` | `{ name, description?, activities: ActivityPermissionInput[] }` → `RoleDetailDto` |
| DELETE | `/roles/{id}` | `ROLE:D` | 204 (xóa mềm; 409 với role Admin) |

```ts
ActivityDto = { id: string; code: string; name: string; description: string | null }
RoleDto = { id: string; name: string; description: string | null; isAdmin: boolean; userCount: number }
RoleDetailDto = RoleDto & { activities: ActivityPermissionDto[] }   // role Admin: activities rỗng (ngầm định toàn quyền), không sửa được quyền
```

## Notifications (in-app, đăng nhập)
| Method | Path | Response |
|---|---|---|
| GET | `/notifications?unreadOnly=&take=` | `NotificationDto[]` (mới nhất trước, take mặc định 20) |
| GET | `/notifications/unread-count` | `{ count: number }` |
| POST | `/notifications/{id}/read` | 204 |
| POST | `/notifications/read-all` | 204 |

`NotificationDto = { id: number; message: string; ticketId: number | null; isRead: boolean; createdAt: string }`

## Reports (`REPORT:R`)
`GET /reports/summary?from=&to=` (mặc định 30 ngày gần nhất)
```ts
ReportSummaryDto = {
  totalTickets: number; openTickets: number; breachedTickets: number;
  avgResolutionHours: number | null; slaComplianceRate: number | null; // 0..100
  byStatus: { key: string; count: number }[];
  byCategory: { key: string; count: number }[];
  byDay: { date: string; count: number }[];  // yyyy-MM-dd, đủ các ngày trong khoảng
  agentPerformance: { agentId: string; agentName: string; assigned: number; resolved: number;
                      avgResolutionHours: number | null; slaComplianceRate: number | null }[]
}
```

## API logs — debug (`API_LOG:R`)
Mọi request POST/PUT/PATCH/DELETE (và GET lỗi ≥ 400) được ghi vào `Sys_LogApi`; `traceId` trùng với `traceId` trong ProblemDetails.
`from` / `to` là **date-time ISO-8601 UTC** (vd `2026-09-23T00:00:00Z`), so sánh `CreatedDate >= from` và `<= to`. Muốn lấy trọn một ngày theo giờ local thì FE gửi đầu ngày và cuối ngày đã đổi sang UTC.

| Method | Path | Response |
|---|---|---|
| GET | `/api-logs?traceId=&userId=&url=&method=&statusCode=&from=&to=&page=&pageSize=` | `PagedResult<ApiLogListItemDto>` |
| GET | `/api-logs/{id}` | `ApiLogDetailDto` |

```ts
ApiLogListItemDto = { id: number; module: string; traceId: string; ip: string | null; userId: string | null; userName: string | null;
                      method: string; url: string; statusCode: number; durationMs: number; createdDate: string }
ApiLogDetailDto = ApiLogListItemDto & { request: string | null; response: string | null; userAgent: string | null }
```

## Tài khoản seed (Development)
| Email | Mật khẩu | Role |
|---|---|---|
| admin@helpdesk.local | Admin@123 | Admin |
| an.agent@helpdesk.local | Agent@123 | Agent |
| binh.agent@helpdesk.local | Agent@123 | Agent |
| customer@helpdesk.local | Customer@123 | Customer |
