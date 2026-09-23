using Helpdesk.Application.Common.Interfaces;
using Helpdesk.Domain.Constants;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Enums;
using Helpdesk.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Infrastructure.Seed;

/// <summary>
/// Seed dữ liệu hệ thống (chạy mỗi lần khởi động, idempotent):
/// - Đồng bộ ConstActivity.All → Sys_Activity (thêm mã mới, cập nhật tên; không xóa mã cũ).
/// - Role hệ thống Admin / Agent / Customer + quyền mặc định (chỉ khi role mới được tạo).
/// - Danh mục, SLA mặc định; tài khoản demo khi <paramref name="includeDemoUsers"/>.
/// </summary>
public sealed class DataSeeder(IUnitOfWork<HelpdeskDbContext> unitOfWork, IPasswordHasher hasher, ILogger<DataSeeder> logger)
{
    public async Task SeedAsync(bool includeDemoUsers, CancellationToken ct = default)
    {
        var activities = await SyncActivitiesAsync(ct);
        var roles = await EnsureRolesAsync(activities, ct);
        await EnsureReferenceDataAsync(ct);
        if (includeDemoUsers) await EnsureDemoUsersAsync(roles, ct);

        await unitOfWork.SaveChangesAsync(ct);
        logger.LogInformation("Data seeding completed");
    }

    private async Task<Dictionary<string, SysActivity>> SyncActivitiesAsync(CancellationToken ct)
    {
        var set = unitOfWork.Repository<SysActivity>();
        var existing = await set.ToDictionaryAsync(a => a.Code, StringComparer.OrdinalIgnoreCase, ct);

        foreach (var def in ConstActivity.All)
        {
            if (existing.TryGetValue(def.Code, out var activity))
            {
                activity.Name = def.Name;
                activity.Description = def.Description;
            }
            else
            {
                activity = new SysActivity
                {
                    Code = def.Code, Name = def.Name, Description = def.Description, ApplicationName = ConstActivity.ApplicationName
                };
                set.Add(activity);
                existing[def.Code] = activity;
            }
        }
        return existing;
    }

    private async Task<Dictionary<string, SysRole>> EnsureRolesAsync(Dictionary<string, SysActivity> activities, CancellationToken ct)
    {
        var set = unitOfWork.Repository<SysRole>();
        var roles = await set.ToDictionaryAsync(r => r.Name, StringComparer.OrdinalIgnoreCase, ct);

        if (!roles.ContainsKey(ConstRole.Admin))
        {
            var admin = new SysRole { Name = ConstRole.Admin, Description = "Quản trị hệ thống — toàn quyền", RoleType = ConstRole.AdminRoleType };
            set.Add(admin);
            roles[admin.Name] = admin;
        }

        foreach (var (roleName, permissions) in ConstRole.DefaultPermissions)
        {
            if (roles.ContainsKey(roleName)) continue; // role đã có → không ghi đè cấu hình admin đã chỉnh

            var role = new SysRole { Name = roleName, Description = $"Role mặc định: {roleName}" };
            set.Add(role);
            roles[roleName] = role;

            foreach (var (code, flags) in permissions)
            {
                var ra = new SysRoleActivity { RoleId = role.Id, ActivityId = activities[code].Id };
                ra.SetFlags(flags.Contains('C'), flags.Contains('R'), flags.Contains('U'), flags.Contains('D'));
                unitOfWork.Repository<SysRoleActivity>().Add(ra);
            }
        }
        return roles;
    }

    private async Task EnsureReferenceDataAsync(CancellationToken ct)
    {
        if (!await unitOfWork.Repository<Category>().AnyAsync(ct))
        {
            unitOfWork.Repository<Category>().AddRange(
                new Category("Tài khoản & đăng nhập", 24),
                new Category("Hóa đơn & thanh toán", 48),
                new Category("Lỗi phần mềm", 72),
                new Category("Yêu cầu tính năng", 168));
        }

        if (!await unitOfWork.Repository<SlaPolicy>().AnyAsync(ct))
        {
            unitOfWork.Repository<SlaPolicy>().AddRange(
                new SlaPolicy(TicketPriority.Urgent, 1, 4),
                new SlaPolicy(TicketPriority.High, 2, 8),
                new SlaPolicy(TicketPriority.Medium, 4, 24),
                new SlaPolicy(TicketPriority.Low, 8, 72));
        }
    }

    private async Task EnsureDemoUsersAsync(Dictionary<string, SysRole> roles, CancellationToken ct)
    {
        (string Email, string Name, string Password, string Role)[] demo =
        [
            ("admin@helpdesk.local", "Quản trị viên", "Admin@123", ConstRole.Admin),
            ("an.agent@helpdesk.local", "Nguyễn Văn An", "Agent@123", ConstRole.Agent),
            ("binh.agent@helpdesk.local", "Trần Thị Bình", "Agent@123", ConstRole.Agent),
            ("customer@helpdesk.local", "Khách hàng Demo", "Customer@123", ConstRole.Customer)
        ];

        var existing = await unitOfWork.Repository<SysAccount>().Select(u => u.Email).ToListAsync(ct);
        foreach (var (email, name, password, roleName) in demo.Where(d => !existing.Contains(d.Email)))
        {
            var user = new SysAccount { Email = email, FullName = name };
            user.SetPasswordHash(hasher.Hash(user, password));
            unitOfWork.Repository<SysAccount>().Add(user);
            unitOfWork.Repository<SysUserRole>().Add(new SysUserRole { UserId = user.Id, RoleId = roles[roleName].Id });
        }
    }
}
