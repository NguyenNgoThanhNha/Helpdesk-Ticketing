using Helpdesk.Application.Common.Security;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Constants;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Enums;
using Helpdesk.Infrastructure.Security;
using Microsoft.Extensions.Caching.Memory;

namespace Helpdesk.UnitTests.Security;

/// <summary>Logic gộp quyền 6 bảng: Admin toàn quyền; OR(quyền role, quyền riêng); tài khoản khóa không có quyền.</summary>
public class PermissionTests
{
    private static PermissionService CreateService(TestDb db, PermissionCacheVersion? version = null) =>
        new(db.UnitOfWork, new MemoryCache(new MemoryCacheOptions()), version ?? new PermissionCacheVersion());

    [Fact]
    public async Task Role_and_user_permissions_are_merged_with_OR()
    {
        using var db = new TestDb();
        var act = db.SeedActivities();
        var agent = db.AddRole("Agent", null, (act[ConstActivity.Ticket], "CR"));
        var user = db.AddUser("u@x.vn", true, agent);
        var own = new SysUserActivity { UserId = user.Id, ActivityId = act[ConstActivity.Ticket].Id };
        own.SetFlags(false, false, true, false);
        db.Context.SysUserActivities.Add(own);
        db.Context.SaveChanges();

        var effective = await CreateService(db).GetEffectiveAsync(user.Id);

        Assert.True(effective.Has(ConstActivity.Ticket, ActivityType.Create));
        Assert.True(effective.Has(ConstActivity.Ticket, ActivityType.Update)); // từ quyền riêng
        Assert.False(effective.Has(ConstActivity.Ticket, ActivityType.Delete));
        Assert.False(effective.Has(ConstActivity.Report, ActivityType.Read));
    }

    [Fact]
    public async Task Admin_role_has_every_permission()
    {
        using var db = new TestDb();
        db.SeedActivities();
        var admin = db.AddRole(ConstRole.Admin, ConstRole.AdminRoleType);
        var user = db.AddUser("admin@x.vn", true, admin);

        var effective = await CreateService(db).GetEffectiveAsync(user.Id);

        Assert.True(effective.IsAdmin);
        Assert.All(ConstActivity.All, a => Assert.True(effective.Has(a.Code, ActivityType.Delete)));
    }

    [Fact]
    public async Task Locked_account_has_no_permission()
    {
        using var db = new TestDb();
        db.SeedActivities();
        var admin = db.AddRole(ConstRole.Admin, ConstRole.AdminRoleType);
        var user = db.AddUser("locked@x.vn", false, admin);

        var effective = await CreateService(db).GetEffectiveAsync(user.Id);

        Assert.False(effective.Has(ConstActivity.Ticket, ActivityType.Read));
    }

    [Fact]
    public async Task Soft_deleted_role_link_is_ignored()
    {
        using var db = new TestDb();
        var act = db.SeedActivities();
        var qa = db.AddRole("QA", null, (act[ConstActivity.Report], "R"));
        var user = db.AddUser("qa@x.vn", true, qa);
        db.Context.SysUserRoles.Remove(db.Context.SysUserRoles.Single(ur => ur.UserId == user.Id)); // → xóa mềm
        db.Context.SaveChanges();

        var effective = await CreateService(db).GetEffectiveAsync(user.Id);

        Assert.False(effective.Has(ConstActivity.Report, ActivityType.Read));
    }

    [Fact]
    public async Task Invalidate_all_forces_recompute_after_role_change()
    {
        using var db = new TestDb();
        var act = db.SeedActivities();
        var role = db.AddRole("Viewer", null, (act[ConstActivity.Report], "R"));
        var user = db.AddUser("v@x.vn", true, role);
        var service = CreateService(db);
        Assert.True((await service.GetEffectiveAsync(user.Id)).Has(ConstActivity.Report, ActivityType.Read));

        db.Context.SysRoleActivities.Single().SetFlags(false, false, false, false);
        db.Context.SaveChanges();
        Assert.True((await service.GetEffectiveAsync(user.Id)).Has(ConstActivity.Report, ActivityType.Read)); // còn cache

        service.InvalidateAll();
        Assert.False((await service.GetEffectiveAsync(user.Id)).Has(ConstActivity.Report, ActivityType.Read));
    }

    [Theory]
    [InlineData("TICKET:C", "TICKET", ActivityType.Create)]
    [InlineData("user:r", "USER", ActivityType.Read)]
    public void PermissionKey_parses(string key, string code, ActivityType type)
    {
        Assert.True(PermissionKey.TryParse(key, out var parsedCode, out var parsedType));
        Assert.Equal(code, parsedCode);
        Assert.Equal(type, parsedType);
    }

    [Theory]
    [InlineData("TICKET")]
    [InlineData("TICKET:X")]
    [InlineData(":C")]
    public void PermissionKey_rejects_invalid(string key) => Assert.False(PermissionKey.TryParse(key, out _, out _));

    [Fact]
    public void Allowed_transitions_depend_on_permissions()
    {
        var agentNoClose = Permissions((ConstActivity.Ticket, new PermissionFlags(false, true, true, false)));
        var customer = Permissions();

        Assert.DoesNotContain(TicketStatus.Closed, TicketDetailReader.AllowedTransitions(TicketStatus.Open, false, agentNoClose));
        Assert.Contains(TicketStatus.Resolved, TicketDetailReader.AllowedTransitions(TicketStatus.Open, false, agentNoClose));
        Assert.Equal([TicketStatus.Open], TicketDetailReader.AllowedTransitions(TicketStatus.Resolved, true, customer));
        Assert.Empty(TicketDetailReader.AllowedTransitions(TicketStatus.Resolved, false, customer));
    }

    private static EffectivePermissions Permissions(params (string Code, PermissionFlags Flags)[] items) =>
        new(Guid.NewGuid(), true, false, [], items.ToDictionary(i => i.Code, i => i.Flags));
}
