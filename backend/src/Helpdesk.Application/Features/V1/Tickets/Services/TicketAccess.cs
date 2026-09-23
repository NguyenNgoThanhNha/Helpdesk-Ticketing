using Helpdesk.Domain.Entities.Sys;

namespace Helpdesk.Application.Features.V1.Tickets.Services;

/// <summary>Phân quyền theo dữ liệu: chủ ticket hoặc người có TICKET:R mới được xem/tương tác.</summary>
public static class TicketAccess
{
    public static Task<bool> CanViewAllAsync(ICurrentUser user, CancellationToken ct) =>
        user.HasPermissionAsync(ConstActivity.Ticket, ActivityType.Read, ct);

    public static async Task EnsureCanViewAsync(ICurrentUser user, Guid? requesterId, CancellationToken ct)
    {
        if (requesterId == user.UserId) return;
        if (!await CanViewAllAsync(user, ct)) throw new ForbiddenException(ConstMessage.TicketNoAccess);
    }
}

/// <summary>User đủ điều kiện nhận gán ticket = có quyền hiệu lực TICKET_ASSIGN:R (tính trực tiếp trong SQL).</summary>
public static class AssignableUsers
{
    public static IQueryable<SysAccount> Query(IUnitOfWork<HelpdeskDbContext> unitOfWork, bool includeAdmins)
    {
        const string code = ConstActivity.TicketAssign;
        return unitOfWork.Repository<SysAccount>().Where(u => u.IsActive && (
            u.UserActivities.Any(ua => ua.R && ua.Activity.Code == code)
            || u.UserRoles.Any(ur => ur.Role.RoleActivities.Any(ra => ra.R && ra.Activity.Code == code))
            || (includeAdmins && u.UserRoles.Any(ur => ur.Role.RoleType == ConstRole.AdminRoleType))));
    }
}
