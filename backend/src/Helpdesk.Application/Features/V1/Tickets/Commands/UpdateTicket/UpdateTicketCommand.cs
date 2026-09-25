using Helpdesk.Application.Common.Realtime;
using System.Text.Json.Serialization;
using FluentValidation;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Commands.UpdateTicket;

/// <summary>PATCH ticket: đổi trạng thái / ưu tiên / người gán. Optimistic concurrency qua RowVersion.</summary>
public sealed record UpdateTicketCommand(
    string RowVersion,
    TicketStatus? Status,
    TicketPriority? Priority,
    Guid? AssigneeId,
    bool Unassign = false) : IRequest<TicketDetailDto>
{
    /// <summary>Lấy từ route.</summary>
    [JsonIgnore]
    public int Id { get; init; }
}

public sealed class UpdateTicketCommandValidator : AbstractValidator<UpdateTicketCommand>
{
    public UpdateTicketCommandValidator()
    {
        RuleFor(x => x.RowVersion).NotEmpty()
            .Must(v => Convert.TryFromBase64String(v, new byte[v.Length], out _))
            .WithMessage("rowVersion không hợp lệ.");
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x)
            .Must(x => x.Status.HasValue || x.Priority.HasValue || x.AssigneeId.HasValue || x.Unassign)
            .OverridePropertyName("request").WithMessage("Không có thay đổi nào.");
    }
}

public sealed class UpdateTicketCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ICurrentUser currentUser,
    IPermissionService permissionService,
    ISlaCalculator sla,
    ITicketNotifier notifier,
    ITicketDetailReader reader,
    IRealtimeOutbox realtime,
    TimeProvider clock) : IRequestHandler<UpdateTicketCommand, TicketDetailDto>
{
    public async Task<TicketDetailDto> Handle(UpdateTicketCommand request, CancellationToken ct)
    {
        var ticket = await unitOfWork.Repository<Ticket>()
                         .Include(t => t.Assignee)
                         .FirstOrDefaultAsync(t => t.Id == request.Id, ct)
                     ?? throw new NotFoundException("Ticket", request.Id);

        await TicketAccess.EnsureCanViewAsync(currentUser, ticket.CreatedById, ct);
        EnsureNotStale(ticket, request.RowVersion);

        var permissions = await currentUser.GetPermissionsAsync(ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var actorId = currentUser.UserId;
        var oldStatus = ticket.Status;
        var oldAssigneeId = ticket.AssigneeId;

        if (request.Priority is { } priority)
        {
            Require(permissions.Has(ConstActivity.Ticket, ActivityType.Update), "đổi mức ưu tiên");
            var window = await sla.GetWindowAsync(priority, ticket.CategoryId, ct);
            ticket.ChangePriority(priority, window, actorId, now);
        }

        if (request.Unassign || request.AssigneeId.HasValue)
        {
            Require(permissions.Has(ConstActivity.TicketAssign, ActivityType.Update), "gán người xử lý");
            ticket.Assign(request.Unassign ? null : await LoadAssigneeAsync(request.AssigneeId!.Value, ct), actorId, now);
        }

        if (request.Status is { } status && status != ticket.Status)
        {
            var isRequesterReopen = ticket.CreatedById == actorId
                                    && ticket.Status == TicketStatus.Resolved && status == TicketStatus.Open;
            if (!isRequesterReopen)
            {
                Require(permissions.Has(ConstActivity.Ticket, ActivityType.Update), "đổi trạng thái");
                if (status == TicketStatus.Closed)
                    Require(permissions.Has(ConstActivity.Ticket, ActivityType.Delete), "đóng ticket");
            }
            ticket.ChangeStatus(status, actorId, now);
        }

        if (ticket.AssigneeId != oldAssigneeId && ticket.AssigneeId is not null)
            notifier.Notify([ticket.AssigneeId], actorId, ticket, $"Bạn được gán ticket: {ticket.Title}");
        if (ticket.Status != oldStatus)
            notifier.Notify([ticket.CreatedById, ticket.AssigneeId], actorId, ticket, $"Trạng thái đổi {oldStatus} → {ticket.Status}");

        await unitOfWork.SaveChangesAsync(ct); // DbUpdateConcurrencyException → 409 ở GlobalExceptionHandler
        realtime.TicketChanged(ticket.Id, TicketChangeKind.Updated, actorId);

        return await reader.GetAsync(ticket.Id, ct);
    }

    private async Task<SysAccount> LoadAssigneeAsync(Guid assigneeId, CancellationToken ct)
    {
        var assignee = await unitOfWork.Repository<SysAccount>().FirstOrDefaultAsync(u => u.Id == assigneeId, ct)
                       ?? throw new ValidationException("assigneeId", "Người được gán không tồn tại.");

        var effective = await permissionService.GetEffectiveAsync(assigneeId, ct);
        if (!effective.Has(ConstActivity.TicketAssign, ActivityType.Read))
            throw new ValidationException("assigneeId", "Người này không có quyền nhận xử lý ticket (TICKET_ASSIGN:R).");

        return assignee;
    }

    private static void Require(bool allowed, string action)
    {
        if (!allowed) throw new ForbiddenException($"Bạn không có quyền {action}.");
    }

    private static void EnsureNotStale(Ticket ticket, string rowVersion)
    {
        if (ticket.RowVersion is not { Length: > 0 }) return; // provider không hỗ trợ rowversion (vd: InMemory)
        if (!ticket.RowVersion.AsSpan().SequenceEqual(Convert.FromBase64String(rowVersion)))
            throw new ConflictException(ConstMessage.ConcurrencyConflict);
    }
}
