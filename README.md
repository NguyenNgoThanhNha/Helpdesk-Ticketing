# Helpdesk / Ticketing System

Dự án #1 trong roadmap ([spec](../../Roadmap/projects/01-Ticketing-Helpdesk.md)). Backend được dựng đúng theo [Chuẩn Backend .NET](../../Roadmap/projects/00-Chuan-Backend-DotNet.md): Clean Architecture + CQRS, `IUnitOfWork<TContext>`, phân quyền 6 bảng, log API.

| Phần | Công nghệ |
|---|---|
| Backend | .NET 10 · ASP.NET Core · MediatR 12 · FluentValidation · Mapster · EF Core + SQL Server (SP dynamic SQL cho danh sách/báo cáo) · JWT + refresh rotation · SignalR · HybridCache · Serilog |
| Frontend | React 19 + TS strict · Vite · **shadcn/ui** (Radix + Tailwind v4) · TanStack Query + TanStack Table · Zustand · React Hook Form + Zod · Recharts (shadcn chart) · cấu trúc feature-based |
| Test | xUnit + NSubstitute + EF InMemory (60 unit) · WebApplicationFactory + SQL Server thật (15 integration, gồm SignalR) · Vitest + RTL + MSW (50) |

## Chạy local (không cần Docker)

Cần: .NET SDK 10, Node 24, SQL Server (mặc định `.\MSSQLSERVER01`, Windows auth — sửa trong `backend/src/Helpdesk.Api/appsettings.Development.json`).

```bash
cd backend && dotnet run --project src/Helpdesk.Api --urls http://localhost:5080
```

```bash
cd frontend && npm install && npm run dev
```

- FE: http://localhost:5173 (Vite proxy `/api` và `/hubs` (WebSocket) → `:5080`)
- Swagger: http://localhost:5080/swagger
- Môi trường Development tự **migrate + seed** (activity, role Admin/Agent/Customer, danh mục, SLA, tài khoản demo).

| Email | Mật khẩu | Role |
|---|---|---|
| admin@helpdesk.local | Admin@123 | Admin (toàn quyền) |
| an.agent@helpdesk.local / binh.agent@helpdesk.local | Agent@123 | Agent |
| customer@helpdesk.local | Customer@123 | Customer |

## Chạy bằng Docker

```bash
docker compose up --build
```

FE http://localhost:8081 · API http://localhost:8080/swagger · SQL Server `localhost,14330` (sa / `Helpdesk@12345`).

## Test

```bash
cd backend && dotnet test tests/Helpdesk.UnitTests
```

Integration test: có Docker thì tự dùng Testcontainers. Không có Docker thì trỏ vào SQL Server local (mỗi lần chạy tạo một DB tạm rồi xóa):

```bash
cd backend && TEST_SQL_CONNECTION="Server=.\MSSQLSERVER01;Trusted_Connection=True;TrustServerCertificate=True" dotnet test tests/Helpdesk.IntegrationTests
```

```bash
cd frontend && npm test -- --run
```

## Kiến trúc

```text
Api  ──►  Infrastructure  ──►  Application  ──►  Persistence  ──►  Domain
(controller mỏng,     (UnitOfWork, JWT,      (Features/V1/<Feature>/     (DbContext,        (entity, Const*,
 HasPermission,        PermissionService,      Commands|Queries|DTOs,      config, audit      máy trạng thái,
 ApiLoggingMiddleware) log writer, seeder)     behaviors)                   interceptor)       SLA rules)
```

Luồng một request: `Controller [HasPermission] → Mediator → LoggingBehavior → ValidationBehavior → RealtimeDispatchBehavior → Handler → IUnitOfWork → SaveChangesAsync (1 lần)`. Sau khi handler xong, sự kiện realtime đã xếp hàng mới được gửi đi.

### Phân quyền 6 bảng

`Sys_Account`, `Sys_Role`, `Sys_Activity`, `Sys_UserRole`, `Sys_RoleActivity (C,R,U,D)`, `Sys_UserActivity (C,R,U,D)`.

Quyền hiệu lực: role Admin → toàn quyền; còn lại lấy OR(quyền các role, quyền riêng của tài khoản). Kết quả được cache và bị vô hiệu ngay khi đổi quyền. Màn **Settings → Users / Roles** dùng để quản trị.

### Realtime (SignalR)

Hub `/hubs/notifications` (cần JWT). Server đẩy `notification` tới đúng người nhận, và `ticketChanged` tới những ai đang mở ticket đó (`JoinTicket` có kiểm quyền xem). FE tự nối lại khi mất kết nối và giữ polling dự phòng: 5 phút khi đang kết nối, 30 giây khi mất kết nối. Chi tiết trong [API-CONTRACT → Realtime](docs/API-CONTRACT.md).

### Danh sách & tìm kiếm

Màn danh sách ticket và báo cáo dùng stored procedure dynamic SQL (`usp_Ticket_Search`, `usp_Report_Summary`). Tìm kiếm không phân biệt hoa/thường và **không phân biệt dấu**: gõ "hoa don" vẫn ra "Hóa đơn". `#123` là tìm đúng mã. Số đo trên 50.000 ticket: danh sách ~12 ms, tìm chữ 43–77 ms, tìm mã ~4 ms, báo cáo (có cache) ~3 ms. Chi tiết trong [Chuẩn BE → mục 5](../../Roadmap/projects/00-Chuan-Backend-DotNet.md).

### Debug bằng log API

Mọi request ghi (và mọi GET lỗi) được lưu vào `Sys_LogApi`. Body được che mật khẩu/token và cắt bớt nếu quá dài.

Khi FE báo lỗi, lấy `traceId` trong ProblemDetails rồi gọi `GET /api/v1/api-logs?traceId=...` (cần quyền `API_LOG:R`) để xem request/response. Dùng tiếp `traceId` đó tìm trong `backend/src/Helpdesk.Api/logs/*.log` để thấy stack trace.

## Tài liệu

- API contract: [docs/API-CONTRACT.md](docs/API-CONTRACT.md)
- Chuẩn BE: [Roadmap/projects/00-Chuan-Backend-DotNet.md](../../Roadmap/projects/00-Chuan-Backend-DotNet.md)
