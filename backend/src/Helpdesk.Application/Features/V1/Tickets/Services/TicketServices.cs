using Helpdesk.Application.Common.Realtime;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Services;

public interface ISlaCalculator
{
    Task<SlaWindow> GetWindowAsync(TicketPriority priority, int categoryId, CancellationToken ct);
}

/// <summary>
/// SLA lấy từ SlaPolicy theo mức ưu tiên; chưa cấu hình thì dùng DefaultSlaHours của danh mục
/// (thời gian phản hồi = 1/4 thời gian giải quyết, tối thiểu 1h).
/// </summary>
public sealed class SlaCalculator(IUnitOfWork<HelpdeskDbContext> unitOfWork) : ISlaCalculator
{
    private const int FallbackResolveHours = 48;

    public async Task<SlaWindow> GetWindowAsync(TicketPriority priority, int categoryId, CancellationToken ct)
    {
        var policy = await unitOfWork.Repository<SlaPolicy>().AsNoTracking()
            .FirstOrDefaultAsync(p => p.Priority == priority, ct);
        if (policy is not null) return SlaWindow.FromHours(policy.ResponseHours, policy.ResolveHours);

        var categoryHours = await unitOfWork.Repository<Category>().AsNoTracking()
            .Where(c => c.Id == categoryId)
            .Select(c => (int?)c.DefaultSlaHours)
            .FirstOrDefaultAsync(ct) ?? FallbackResolveHours;

        return SlaWindow.FromHours(Math.Max(1, categoryHours / 4), categoryHours);
    }
}

public interface ITicketNotifier
{
    /// <summary>Thêm notification vào UnitOfWork (lưu cùng lần SaveChanges với thay đổi của ticket).</summary>
    void Notify(IEnumerable<Guid?> recipients, Guid? actorId, Ticket ticket, string message);

    Task NotifyAdminsAsync(Guid? actorId, Ticket ticket, string message, CancellationToken ct);
}

public sealed class TicketNotifier(IUnitOfWork<HelpdeskDbContext> unitOfWork, IRealtimeOutbox realtime) : ITicketNotifier
{
    public void Notify(IEnumerable<Guid?> recipients, Guid? actorId, Ticket ticket, string message)
    {
        var targets = recipients
            .Where(id => id.HasValue && id != actorId)
            .Select(id => id!.Value)
            .Distinct();

        foreach (var userId in targets)
        {
            var notification = new SysNotification
            {
                UserId = userId,
                Message = message,
                Ticket = ticket // navigation → EF tự điền TicketId kể cả khi ticket mới tạo
            };
            unitOfWork.Repository<SysNotification>().Add(notification);
            realtime.Enqueue(notification); // đẩy qua SignalR sau khi SaveChanges thành công
        }
    }

    public async Task NotifyAdminsAsync(Guid? actorId, Ticket ticket, string message, CancellationToken ct)
    {
        var adminIds = await unitOfWork.Repository<SysAccount>().AsNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(ur => ur.Role.RoleType == ConstRole.AdminRoleType))
            .Select(u => (Guid?)u.Id)
            .ToListAsync(ct);
        Notify(adminIds, actorId, ticket, message);
    }
}

public interface IAutoAssigner
{
    Task<SysAccount?> PickAsync(CancellationToken ct);
}

/// <summary>Cân bằng tải: chọn người có TICKET_ASSIGN:R (không tính Admin ngầm định) đang ít ticket active nhất.</summary>
public sealed class LeastLoadedAutoAssigner(IUnitOfWork<HelpdeskDbContext> unitOfWork) : IAutoAssigner
{
    public async Task<SysAccount?> PickAsync(CancellationToken ct)
    {
        var tickets = unitOfWork.Repository<Ticket>();
        return await AssignableUsers.Query(unitOfWork, includeAdmins: false)
            .OrderBy(u => tickets.Count(t => t.AssigneeId == u.Id
                                             && t.Status != TicketStatus.Resolved
                                             && t.Status != TicketStatus.Closed))
            .ThenBy(u => tickets.Where(t => t.AssigneeId == u.Id).Max(t => (DateTime?)t.CreatedDate))
            .FirstOrDefaultAsync(ct);
    }
}
