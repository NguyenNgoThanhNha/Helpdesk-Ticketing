using Helpdesk.Application.Common.Realtime;
using System.Text.Json.Serialization;
using FluentValidation;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Commands.AddComment;

public sealed record AddCommentCommand(string Body) : IRequest<CommentDto>
{
    [JsonIgnore]
    public int TicketId { get; init; }
}

public sealed class AddCommentCommandValidator : AbstractValidator<AddCommentCommand>
{
    public AddCommentCommandValidator()
    {
        RuleFor(x => x.Body).NotEmpty().WithMessage("Nội dung trả lời là bắt buộc.").MaximumLength(4000);
    }
}

public sealed class AddCommentCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ICurrentUser currentUser,
    ITicketNotifier notifier,
    IRealtimeOutbox realtime,
    TimeProvider clock) : IRequestHandler<AddCommentCommand, CommentDto>
{
    public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken ct)
    {
        var ticket = await unitOfWork.Repository<Ticket>().FirstOrDefaultAsync(t => t.Id == request.TicketId, ct)
                     ?? throw new NotFoundException("Ticket", request.TicketId);
        await TicketAccess.EnsureCanViewAsync(currentUser, ticket.CreatedById, ct);

        var author = await unitOfWork.Repository<SysAccount>().FirstAsync(u => u.Id == currentUser.UserId, ct);
        var comment = ticket.AddComment(author, request.Body, clock.GetUtcNow().UtcDateTime);

        var fromRequester = author.Id == ticket.CreatedById;
        if (!fromRequester)
            notifier.Notify([ticket.CreatedById], author.Id, ticket, $"{author.FullName} đã trả lời ticket của bạn");
        else if (ticket.AssigneeId is not null)
            notifier.Notify([ticket.AssigneeId], author.Id, ticket, $"Khách hàng đã phản hồi: {ticket.Title}");
        else
            await notifier.NotifyAdminsAsync(author.Id, ticket, $"Khách hàng đã phản hồi (chưa gán): {ticket.Title}", ct);

        await unitOfWork.SaveChangesAsync(ct);
        realtime.TicketChanged(ticket.Id, TicketChangeKind.Commented, author.Id);

        return new CommentDto(comment.Id, new UserSummaryDto(author.Id, author.FullName), fromRequester,
            comment.Body, comment.CreatedDate, []);
    }
}
