using FluentValidation;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;
using Microsoft.Extensions.Options;

namespace Helpdesk.Application.Features.V1.Tickets.Commands.CreateTicket;

public sealed record CreateTicketCommand(string Title, string Description, int CategoryId, TicketPriority Priority)
    : IRequest<TicketDetailDto>;

public sealed class CreateTicketCommandValidator : AbstractValidator<CreateTicketCommand>
{
    public CreateTicketCommandValidator(IUnitOfWork<HelpdeskDbContext> unitOfWork)
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Tiêu đề là bắt buộc.")
            .MaximumLength(200).WithMessage("Tiêu đề tối đa 200 ký tự.");
        RuleFor(x => x.Description).NotEmpty().WithMessage("Mô tả là bắt buộc.")
            .MaximumLength(4000).WithMessage("Mô tả tối đa 4000 ký tự.");
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.CategoryId)
            .MustAsync((id, ct) => unitOfWork.Repository<Category>().AnyAsync(c => c.Id == id, ct))
            .WithMessage("Danh mục không tồn tại.");
    }
}

public sealed class CreateTicketCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ICurrentUser currentUser,
    ISlaCalculator sla,
    IAutoAssigner autoAssigner,
    ITicketNotifier notifier,
    ITicketDetailReader reader,
    IOptions<TicketingOptions> options,
    TimeProvider clock) : IRequestHandler<CreateTicketCommand, TicketDetailDto>
{
    public async Task<TicketDetailDto> Handle(CreateTicketCommand request, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var userId = currentUser.UserId;
        var window = await sla.GetWindowAsync(request.Priority, request.CategoryId, ct);

        var ticket = Ticket.Create(request.Title, request.Description, request.CategoryId, request.Priority, userId, now, window);

        if (options.Value.AutoAssignEnabled && await autoAssigner.PickAsync(ct) is { } agent)
            ticket.Assign(agent, null, now);

        unitOfWork.Repository<Ticket>().Add(ticket);

        if (ticket.AssigneeId is not null)
            notifier.Notify([ticket.AssigneeId], userId, ticket, $"Bạn được gán ticket mới: {ticket.Title}");
        else
            await notifier.NotifyAdminsAsync(userId, ticket, $"Ticket mới chưa được gán: {ticket.Title}", ct);

        await unitOfWork.SaveChangesAsync(ct);

        return await reader.GetAsync(ticket.Id, ct);
    }
}
