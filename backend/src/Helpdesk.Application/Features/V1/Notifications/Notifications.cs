namespace Helpdesk.Application.Features.V1.Notifications.DTOs
{
    public sealed record NotificationDto(long Id, string Message, int? TicketId, bool IsRead, DateTime CreatedAt);

    public sealed record UnreadCountDto(int Count);
}

namespace Helpdesk.Application.Features.V1.Notifications.Queries
{
    using Helpdesk.Application.Features.V1.Notifications.DTOs;
    using Helpdesk.Domain.Entities.Sys;

    public sealed record GetNotificationsQuery(bool UnreadOnly = false, int Take = 20) : IRequest<IReadOnlyList<NotificationDto>>;

    public sealed class GetNotificationsQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser)
        : IRequestHandler<GetNotificationsQuery, IReadOnlyList<NotificationDto>>
    {
        public async Task<IReadOnlyList<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken ct)
        {
            var userId = currentUser.UserId;
            var query = unitOfWork.Repository<SysNotification>().AsNoTracking().Where(n => n.UserId == userId);
            if (request.UnreadOnly) query = query.Where(n => !n.IsRead);

            return await query.OrderByDescending(n => n.CreatedDate).ThenByDescending(n => n.Id)
                .Take(Math.Clamp(request.Take, 1, 100))
                .Select(n => new NotificationDto(n.Id, n.Message, n.TicketId, n.IsRead, n.CreatedDate))
                .ToListAsync(ct);
        }
    }

    public sealed record GetUnreadCountQuery : IRequest<UnreadCountDto>;

    public sealed class GetUnreadCountQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser)
        : IRequestHandler<GetUnreadCountQuery, UnreadCountDto>
    {
        public async Task<UnreadCountDto> Handle(GetUnreadCountQuery request, CancellationToken ct)
        {
            var userId = currentUser.UserId;
            return new UnreadCountDto(await unitOfWork.Repository<SysNotification>()
                .CountAsync(n => n.UserId == userId && !n.IsRead, ct));
        }
    }
}

namespace Helpdesk.Application.Features.V1.Notifications.Commands
{
    using Helpdesk.Domain.Entities.Sys;

    /// <summary>Id = null → đánh dấu đã đọc tất cả.</summary>
    public sealed record MarkNotificationsReadCommand(long? Id) : IRequest;

    public sealed class MarkNotificationsReadCommandHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser)
        : IRequestHandler<MarkNotificationsReadCommand>
    {
        public async Task Handle(MarkNotificationsReadCommand request, CancellationToken ct)
        {
            var userId = currentUser.UserId;
            var set = unitOfWork.Repository<SysNotification>();
            var query = set.Where(n => n.UserId == userId && !n.IsRead);

            if (request.Id is { } id)
            {
                if (!await set.AnyAsync(n => n.Id == id && n.UserId == userId, ct)) throw new NotFoundException("Notification", id);
                query = query.Where(n => n.Id == id);
            }

            var items = await query.ToListAsync(ct);
            items.ForEach(n => n.IsRead = true);
            await unitOfWork.SaveChangesAsync(ct);
        }
    }
}
