using System.Linq.Expressions;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Rules;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.SearchTickets;

public sealed record SearchTicketsQuery : PagedQuery, IRequest<PagedResult<TicketListItemDto>>
{
    public TicketStatus? Status { get; init; }
    public TicketPriority? Priority { get; init; }
    public int? CategoryId { get; init; }

    /// <summary>Guid, "me" hoặc "unassigned".</summary>
    public string? AssigneeId { get; init; }

    public string? Search { get; init; }
    public SlaState? SlaState { get; init; }
    public string? Sort { get; init; }
}

public sealed class SearchTicketsQueryHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser, TimeProvider clock)
    : IRequestHandler<SearchTicketsQuery, PagedResult<TicketListItemDto>>
{
    public async Task<PagedResult<TicketListItemDto>> Handle(SearchTicketsQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        IQueryable<Ticket> query = unitOfWork.Repository<Ticket>().AsNoTracking();

        // Không có TICKET:R → chỉ thấy ticket do mình tạo.
        if (!await TicketAccess.CanViewAllAsync(currentUser, ct))
        {
            var me = currentUser.UserId;
            query = query.Where(t => t.CreatedById == me);
        }

        if (q.Status is { } status) query = query.Where(t => t.Status == status);
        if (q.Priority is { } priority) query = query.Where(t => t.Priority == priority);
        if (q.CategoryId is { } categoryId) query = query.Where(t => t.CategoryId == categoryId);
        query = ApplyAssigneeFilter(query, q.AssigneeId);
        query = ApplySearch(query, q.Search);
        if (q.SlaState is { } sla) query = query.Where(SlaPredicate(sla, now));

        var projected = ApplySort(query, q.Sort).Select(t => new TicketRow
        {
            Id = t.Id,
            Title = t.Title,
            Status = t.Status,
            Priority = t.Priority,
            CategoryId = t.CategoryId,
            CategoryName = t.Category.Name,
            AssigneeId = t.AssigneeId,
            AssigneeName = t.Assignee != null ? t.Assignee.FullName : null,
            CreatedById = t.CreatedById,
            CreatedByName = t.CreatedBy != null ? t.CreatedBy.FullName : "",
            CreatedAt = t.CreatedDate,
            ResolveDueAt = t.ResolveDueAt,
            ResolvedAt = t.ResolvedAt,
            IsSlaBreached = t.IsSlaBreached,
            CommentCount = t.Comments.Count
        });

        // Một câu SQL cho trang dữ liệu (JOIN Category/Account + subquery đếm comment) → không N+1.
        var page = await PagedResult<TicketRow>.CreateAsync(projected, q.SafePage, q.SafePageSize, ct);

        var items = page.Items.Select(r => new TicketListItemDto(
                r.Id, r.Title, r.Status, r.Priority, r.CategoryId, r.CategoryName,
                r.AssigneeId, r.AssigneeName, r.CreatedById, r.CreatedByName, r.CreatedAt, r.ResolveDueAt,
                SlaRules.Evaluate(r.Status, r.ResolveDueAt, r.ResolvedAt, r.IsSlaBreached, now),
                r.CommentCount))
            .ToList();

        return new PagedResult<TicketListItemDto>(items, page.TotalCount, page.Page, page.PageSize);
    }

    private IQueryable<Ticket> ApplyAssigneeFilter(IQueryable<Ticket> query, string? assignee)
    {
        if (string.IsNullOrWhiteSpace(assignee)) return query;
        if (assignee.Equals("unassigned", StringComparison.OrdinalIgnoreCase))
            return query.Where(t => t.AssigneeId == null);

        var id = assignee.Equals("me", StringComparison.OrdinalIgnoreCase)
            ? currentUser.UserId
            : Guid.TryParse(assignee, out var parsed) ? parsed : Guid.Empty;
        return query.Where(t => t.AssigneeId == id);
    }

    private static IQueryable<Ticket> ApplySearch(IQueryable<Ticket> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return query;
        var term = search.Trim();

        if (int.TryParse(term.TrimStart('#'), out var id))
            return query.Where(t => t.Id == id || t.Title.Contains(term));

        return query.Where(t => t.Title.Contains(term) || t.Description.Contains(term));
    }

    public static Expression<Func<Ticket, bool>> SlaPredicate(SlaState state, DateTime now)
    {
        var atRiskLimit = now + SlaRules.AtRiskWindow;
        return state switch
        {
            SlaState.Breached => t => t.IsSlaBreached
                                      || (t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed && t.ResolveDueAt < now)
                                      || (t.ResolvedAt != null && t.ResolvedAt > t.ResolveDueAt),
            SlaState.AtRisk => t => !t.IsSlaBreached
                                    && t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed
                                    && t.ResolveDueAt >= now && t.ResolveDueAt <= atRiskLimit,
            SlaState.OnTrack => t => !t.IsSlaBreached
                                     && t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed
                                     && (t.ResolveDueAt == null || t.ResolveDueAt > atRiskLimit),
            SlaState.Met => t => !t.IsSlaBreached
                                 && (t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed)
                                 && (t.ResolveDueAt == null || t.ResolvedAt <= t.ResolveDueAt),
            _ => _ => true
        };
    }

    private static IQueryable<Ticket> ApplySort(IQueryable<Ticket> query, string? sort) =>
        (sort ?? "createdAt_desc").ToLowerInvariant() switch
        {
            "createdat_asc" => query.OrderBy(t => t.CreatedDate).ThenBy(t => t.Id),
            "priority_asc" => query.OrderBy(t => t.Priority).ThenByDescending(t => t.CreatedDate),
            "priority_desc" => query.OrderByDescending(t => t.Priority).ThenByDescending(t => t.CreatedDate),
            "status_asc" => query.OrderBy(t => t.Status).ThenByDescending(t => t.CreatedDate),
            "status_desc" => query.OrderByDescending(t => t.Status).ThenByDescending(t => t.CreatedDate),
            "resolvedueat_asc" => query.OrderBy(t => t.ResolveDueAt).ThenBy(t => t.Id),
            "resolvedueat_desc" => query.OrderByDescending(t => t.ResolveDueAt).ThenBy(t => t.Id),
            "title_asc" => query.OrderBy(t => t.Title).ThenBy(t => t.Id),
            "title_desc" => query.OrderByDescending(t => t.Title).ThenBy(t => t.Id),
            _ => query.OrderByDescending(t => t.CreatedDate).ThenByDescending(t => t.Id)
        };

    private sealed class TicketRow
    {
        public int Id { get; init; }
        public string Title { get; init; } = null!;
        public TicketStatus Status { get; init; }
        public TicketPriority Priority { get; init; }
        public int CategoryId { get; init; }
        public string CategoryName { get; init; } = null!;
        public Guid? AssigneeId { get; init; }
        public string? AssigneeName { get; init; }
        public Guid? CreatedById { get; init; }
        public string CreatedByName { get; init; } = null!;
        public DateTime CreatedAt { get; init; }
        public DateTime? ResolveDueAt { get; init; }
        public DateTime? ResolvedAt { get; init; }
        public bool IsSlaBreached { get; init; }
        public int CommentCount { get; init; }
    }
}
