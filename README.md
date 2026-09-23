# Helpdesk / Ticketing System

Dự án #1 trong roadmap ([spec](../../Roadmap/projects/01-Ticketing-Helpdesk.md)). Backend được dựng đúng theo [Chuẩn Backend .NET](../../Roadmap/projects/00-Chuan-Backend-DotNet.md): Clean Architecture + CQRS, `IUnitOfWork<TContext>`, phân quyền 6 bảng, log API.

| Phần | Công nghệ |
|---|---|
| Backend | .NET 10 · ASP.NET Core · MediatR 12 · FluentValidation · Mapster · EF Core + SQL Server · JWT + refresh rotation · Serilog |
| Frontend | React 18 + TS strict · Vite · Ant Design 5 · TanStack Query · Zustand · React Hook Form + Zod · Recharts |
| Test | xUnit + NSubstitute + EF InMemory (39 unit) · WebApplicationFactory + SQL Server thật (5 integration) · Vitest + RTL + MSW (36) |

## Chạy local (không cần Docker)

Cần: .NET SDK 10, Node 24, SQL Server (mặc định `.\MSSQLSERVER01`, Windows auth — sửa trong `backend/src/Helpdesk.Api/appsettings.Development.json`).

```bash
cd backend && dotnet run --project src/Helpdesk.Api --urls http://localhost:5080
```

```bash
cd frontend && npm install && npm run dev
```

- FE: http://localhost:5173 (Vite proxy `/api` → `:5080`)
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

Luồng một request: `Controller [HasPermission] → Mediator → LoggingBehavior → ValidationBehavior → Handler → IUnitOfWork → SaveChangesAsync (1 lần)`.

### Phân quyền 6 bảng

`Sys_Account`, `Sys_Role`, `Sys_Activity`, `Sys_UserRole`, `Sys_RoleActivity (C,R,U,D)`, `Sys_UserActivity (C,R,U,D)`.

Quyền hiệu lực: role Admin → toàn quyền; còn lại lấy OR(quyền các role, quyền riêng của tài khoản). Kết quả được cache và bị vô hiệu ngay khi đổi quyền. Màn **Settings → Users / Roles** dùng để quản trị.

### Debug bằng log API

Mọi request ghi (và mọi GET lỗi) được lưu vào `Sys_LogApi`. Body được che mật khẩu/token và cắt bớt nếu quá dài.

Khi FE báo lỗi, lấy `traceId` trong ProblemDetails rồi gọi `GET /api/v1/api-logs?traceId=...` (cần quyền `API_LOG:R`) để xem request/response. Dùng tiếp `traceId` đó tìm trong `backend/src/Helpdesk.Api/logs/*.log` để thấy stack trace.

## Tài liệu

- API contract: [docs/API-CONTRACT.md](docs/API-CONTRACT.md)
- Chuẩn BE: [Roadmap/projects/00-Chuan-Backend-DotNet.md](../../Roadmap/projects/00-Chuan-Backend-DotNet.md)
