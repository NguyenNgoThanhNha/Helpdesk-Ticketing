using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Rules;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Application.Features.V1.Sla.Commands.ScanSla;

public sealed record ScanSlaResult(int Warned, int Breached);

/// <summary>Background job gọi định kỳ: cảnh báo ticket sắp hết hạn SLA, đánh dấu ticket quá hạn.</summary>
public sealed record ScanSlaCommand(int BatchSize = 200) : IRequest<ScanSlaResult>;

public sealed class ScanSlaCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ITicketNotifier notifier,
    TimeProvider clock,
    ILogger<ScanSlaCommandHandler> logger) : IRequestHandler<ScanSlaCommand, ScanSlaResult>
{
    public async Task<ScanSlaResult> Handle(ScanSlaCommand request, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var atRiskLimit = now + SlaRules.AtRiskWindow;

        var active = unitOfWork.Repository<Ticket>()
            .Where(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed
                        && !t.IsSlaBreached && t.ResolveDueAt != null);

        var breached = await active.Where(t => t.ResolveDueAt < now)
            .OrderBy(t => t.ResolveDueAt).Take(request.BatchSize).ToListAsync(ct);

        foreach (var ticket in breached)
        {
            ticket.MarkSlaBreached(now);
            notifier.Notify([ticket.AssigneeId], null, ticket, $"#{ticket.Id} đã QUÁ HẠN SLA: {ticket.Title}");
            await notifier.NotifyAdminsAsync(null, ticket, $"#{ticket.Id} đã QUÁ HẠN SLA: {ticket.Title}", ct);
        }

        var atRisk = await active
            .Where(t => t.ResolveDueAt >= now && t.ResolveDueAt <= atRiskLimit && t.SlaWarningSentAt == null)
            .OrderBy(t => t.ResolveDueAt).Take(request.BatchSize).ToListAsync(ct);

        foreach (var ticket in atRisk)
        {
            ticket.MarkSlaWarningSent(now);
            if (ticket.AssigneeId is not null)
                notifier.Notify([ticket.AssigneeId], null, ticket, $"#{ticket.Id} sắp hết hạn SLA ({ticket.ResolveDueAt:HH:mm dd/MM} UTC)");
            else
                await notifier.NotifyAdminsAsync(null, ticket, $"#{ticket.Id} sắp hết hạn SLA và chưa được gán", ct);
        }

        if (breached.Count + atRisk.Count > 0)
        {
            await unitOfWork.SaveChangesAsync(ct);
            logger.LogInformation("SLA scan: {Breached} breached, {Warned} at-risk warnings", breached.Count, atRisk.Count);
        }

        return new ScanSlaResult(atRisk.Count, breached.Count);
    }
}
