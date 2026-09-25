using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.CheckTicketAccess;

/// <summary>
/// User có được xem ticket không (chủ ticket hoặc TICKET:R). Dùng cho SignalR hub (JoinTicket) — nơi không có
/// ICurrentUser theo HTTP request nên truyền UserId tường minh.
/// </summary>
public sealed record CheckTicketAccessQuery(int TicketId, Guid UserId) : IRequest<bool>;

public sealed class CheckTicketAccessQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, IPermissionService permissions)
    : IRequestHandler<CheckTicketAccessQuery, bool>
{
    public async Task<bool> Handle(CheckTicketAccessQuery request, CancellationToken ct)
    {
        var owner = await unitOfWork.Repository<Ticket>().AsNoTracking()
            .Where(t => t.Id == request.TicketId)
            .Select(t => new { t.CreatedById })
            .FirstOrDefaultAsync(ct);
        if (owner is null) return false;
        if (owner.CreatedById == request.UserId) return true;
        return (await permissions.GetEffectiveAsync(request.UserId, ct)).Has(ConstActivity.Ticket, ActivityType.Read);
    }
}
