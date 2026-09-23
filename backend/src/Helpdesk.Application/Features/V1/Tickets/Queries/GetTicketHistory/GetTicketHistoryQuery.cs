using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.GetTicketHistory;

public sealed record GetTicketHistoryQuery(int TicketId) : IRequest<IReadOnlyList<TicketHistoryDto>>;

public sealed class GetTicketHistoryQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser)
    : IRequestHandler<GetTicketHistoryQuery, IReadOnlyList<TicketHistoryDto>>
{
    public async Task<IReadOnlyList<TicketHistoryDto>> Handle(GetTicketHistoryQuery request, CancellationToken ct)
    {
        var owner = await unitOfWork.Repository<Ticket>().AsNoTracking()
                        .Where(t => t.Id == request.TicketId)
                        .Select(t => new { t.CreatedById })
                        .FirstOrDefaultAsync(ct)
                    ?? throw new NotFoundException("Ticket", request.TicketId);
        await TicketAccess.EnsureCanViewAsync(currentUser, owner.CreatedById, ct);

        return await unitOfWork.Repository<TicketHistory>().AsNoTracking()
            .Where(h => h.TicketId == request.TicketId)
            .OrderByDescending(h => h.CreatedDate).ThenByDescending(h => h.Id)
            .Select(h => new TicketHistoryDto(
                h.Id, h.Field, h.OldValue, h.NewValue,
                h.ChangedBy == null ? null : new UserSummaryDto(h.ChangedBy.Id, h.ChangedBy.FullName),
                h.CreatedDate))
            .ToListAsync(ct);
    }
}
