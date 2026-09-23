using Helpdesk.Application.Common.Security;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Rules;

namespace Helpdesk.Application.Features.V1.Tickets.Services;

public interface ITicketDetailReader
{
    Task<TicketDetailDto> GetAsync(int ticketId, CancellationToken ct);
}

/// <summary>
/// Đọc chi tiết ticket bằng 3 query projection (header / comments / attachments) thay vì Include nhiều collection
/// → tránh cartesian explosion và N+1. Tính luôn các hành động user hiện tại được phép làm.
/// </summary>
public sealed class TicketDetailReader(IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser, TimeProvider clock)
    : ITicketDetailReader
{
    public async Task<TicketDetailDto> GetAsync(int ticketId, CancellationToken ct)
    {
        var header = await unitOfWork.Repository<Ticket>().AsNoTracking()
            .Where(t => t.Id == ticketId)
            .Select(t => new
            {
                t.Id, t.Title, t.Description, t.Status, t.Priority,
                Category = new CategoryRefDto(t.CategoryId, t.Category.Name),
                t.CreatedById,
                CreatedByName = t.CreatedBy != null ? t.CreatedBy.FullName : "",
                Assignee = t.AssigneeId == null ? null : new UserSummaryDto(t.Assignee!.Id, t.Assignee.FullName),
                t.CreatedDate, t.UpdatedDate, t.FirstRespondedAt, t.ResolvedAt, t.ClosedAt,
                t.ResponseDueAt, t.ResolveDueAt, t.IsSlaBreached, t.RowVersion
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Ticket", ticketId);

        await TicketAccess.EnsureCanViewAsync(currentUser, header.CreatedById, ct);

        var attachments = await unitOfWork.Repository<Attachment>().AsNoTracking()
            .Where(a => a.TicketId == ticketId)
            .OrderBy(a => a.CreatedDate)
            .Select(a => new AttachmentDto(a.Id, a.FileName, a.ContentType, a.Size, a.CommentId, a.CreatedDate))
            .ToListAsync(ct);

        var commentRows = await unitOfWork.Repository<Comment>().AsNoTracking()
            .Where(c => c.TicketId == ticketId)
            .OrderBy(c => c.CreatedDate).ThenBy(c => c.Id)
            .Select(c => new { c.Id, c.AuthorId, AuthorName = c.Author.FullName, c.Body, c.CreatedDate })
            .ToListAsync(ct);

        var byComment = attachments.Where(a => a.CommentId != null).ToLookup(a => a.CommentId!.Value);
        var comments = commentRows
            .Select(c => new CommentDto(c.Id, new UserSummaryDto(c.AuthorId, c.AuthorName),
                c.AuthorId == header.CreatedById, c.Body, c.CreatedDate, byComment[c.Id].ToList()))
            .ToList();

        var permissions = await currentUser.GetPermissionsAsync(ct);
        var isOpen = header.Status != TicketStatus.Closed;
        var now = clock.GetUtcNow().UtcDateTime;

        return new TicketDetailDto(
            header.Id, header.Title, header.Description, header.Status, header.Priority,
            header.Category, new UserSummaryDto(header.CreatedById ?? Guid.Empty, header.CreatedByName), header.Assignee,
            header.CreatedDate, header.UpdatedDate, header.FirstRespondedAt, header.ResolvedAt, header.ClosedAt,
            header.ResponseDueAt, header.ResolveDueAt,
            SlaRules.Evaluate(header.Status, header.ResolveDueAt, header.ResolvedAt, header.IsSlaBreached, now),
            Convert.ToBase64String(header.RowVersion ?? []),
            AllowedTransitions(header.Status, header.CreatedById == currentUser.UserId, permissions),
            isOpen && permissions.Has(ConstActivity.Ticket, ActivityType.Update),
            isOpen && permissions.Has(ConstActivity.TicketAssign, ActivityType.Update),
            isOpen && permissions.Has(ConstActivity.Comment, ActivityType.Create),
            comments,
            attachments);
    }

    /// <summary>TICKET:U → theo máy trạng thái (sang Closed cần thêm TICKET:D); chủ ticket luôn được mở lại ticket đã Resolved.</summary>
    public static IReadOnlyList<TicketStatus> AllowedTransitions(TicketStatus status, bool isRequester, EffectivePermissions permissions)
    {
        var result = new List<TicketStatus>();
        if (permissions.Has(ConstActivity.Ticket, ActivityType.Update))
        {
            result.AddRange(TicketStatusMachine.NextStatuses(status)
                .Where(s => s != TicketStatus.Closed || permissions.Has(ConstActivity.Ticket, ActivityType.Delete)));
        }

        if (isRequester && status == TicketStatus.Resolved && !result.Contains(TicketStatus.Open))
            result.Add(TicketStatus.Open);

        return result;
    }
}
