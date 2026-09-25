using System.Collections;
using Helpdesk.Application.Common.Data;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Rules;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.SearchTickets;

public sealed record SearchTicketsQuery : PagedQuery, IRequest<PagedResult<TicketListItemDto>>
{
    public TicketStatus? Status { get; init; }
    public TicketPriority? Priority { get; init; }
    public int? CategoryId { get; init; }

    /// <summary>Guid, "me" hoặc "unassigned".</summary>
    public string? AssigneeId { get; init; }

    /// <summary>"#123" → tìm đúng mã; "123" → mã hoặc tiêu đề; chữ → tiêu đề/mô tả.</summary>
    public string? Search { get; init; }

    public SlaState? SlaState { get; init; }
    public string? Sort { get; init; }
}

/// <summary>
/// Màn danh sách nhiều điều kiện lọc động + phân trang → dùng stored procedure [dbo].[usp_Ticket_Search]
/// (chuẩn BE §5 · RULES 3.7). SP tự lọc IsDeleted vì không có global query filter của EF.
/// </summary>
public sealed class SearchTicketsQueryHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser, TimeProvider clock)
    : IRequestHandler<SearchTicketsQuery, PagedResult<TicketListItemDto>>
{
    private static readonly HashSet<string> SortColumns =
        new(StringComparer.OrdinalIgnoreCase) { "createdAt", "priority", "status", "resolveDueAt", "title" };

    public async Task<PagedResult<TicketListItemDto>> Handle(SearchTicketsQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var canViewAll = await TicketAccess.CanViewAllAsync(currentUser, ct);
        var (searchText, searchId, idOrTitle) = ParseSearch(q.Search);
        var (assigneeId, unassigned) = ParseAssignee(q.AssigneeId);
        var (sortColumn, sortDesc) = ParseSort(q.Sort);

        var ds = unitOfWork.ExecuteStoreProcedureGetMultiTables("[dbo].[usp_Ticket_Search]", new Hashtable
        {
            ["@ViewerId"] = currentUser.UserId,
            ["@CanViewAll"] = canViewAll,
            ["@Status"] = q.Status is { } status ? (int)status : null,
            ["@Priority"] = q.Priority is { } priority ? (int)priority : null,
            ["@CategoryId"] = q.CategoryId,
            ["@AssigneeId"] = assigneeId,
            ["@Unassigned"] = unassigned,
            ["@SearchText"] = searchText,
            ["@SearchId"] = searchId,
            ["@SearchIdOrTitle"] = idOrTitle,
            ["@SlaState"] = q.SlaState is { } sla ? (int)sla : null,
            ["@Now"] = now,
            ["@AtRiskLimit"] = now + SlaRules.AtRiskWindow,
            ["@SortColumn"] = sortColumn,
            ["@SortDesc"] = sortDesc,
            ["@PageNumber"] = q.SafePage,
            ["@PageSize"] = q.SafePageSize
        }).ToDataSetSimpleRead();

        var totalCount = ds.TryRead<int>()?.FirstOrDefault() ?? 0;
        var rows = ds.TryRead<TicketRow>() ?? [];

        var items = rows.Select(r => new TicketListItemDto(
                r.Id, r.Title, r.Status, r.Priority, r.CategoryId, r.CategoryName,
                r.AssigneeId, r.AssigneeName, r.CreatedById, r.CreatedByName, r.CreatedAt, r.ResolveDueAt,
                SlaRules.Evaluate(r.Status, r.ResolveDueAt, r.ResolvedAt, r.IsSlaBreached, now),
                r.CommentCount))
            .ToList();

        return new PagedResult<TicketListItemDto>(items, totalCount, q.SafePage, q.SafePageSize);
    }

    /// <summary>"#123" → chỉ Id (seek khóa chính); "123" → Id hoặc tiêu đề; còn lại → LIKE tiêu đề/mô tả.</summary>
    public static (string? Text, int? Id, bool IdOrTitle) ParseSearch(string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return (null, null, false);
        var term = search.Trim();
        if (term.Length > 200) term = term[..200];

        if (term.StartsWith('#') && int.TryParse(term[1..], out var exactId)) return (null, exactId, false);
        if (int.TryParse(term, out var id)) return (term, id, true);
        return (term, null, false);
    }

    private (Guid? Id, bool Unassigned) ParseAssignee(string? assignee)
    {
        if (string.IsNullOrWhiteSpace(assignee)) return (null, false);
        if (assignee.Equals("unassigned", StringComparison.OrdinalIgnoreCase)) return (null, true);
        if (assignee.Equals("me", StringComparison.OrdinalIgnoreCase)) return (currentUser.UserId, false);
        return (Guid.TryParse(assignee, out var id) ? id : Guid.Empty, false); // id sai → không khớp dòng nào
    }

    public static (string Column, bool Desc) ParseSort(string? sort)
    {
        var parts = (sort ?? string.Empty).Split('_', 2);
        var column = SortColumns.FirstOrDefault(c => c.Equals(parts[0], StringComparison.OrdinalIgnoreCase));
        if (column is null) return ("createdAt", true);
        return (column, parts.Length < 2 || !parts[1].Equals("asc", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Map theo tên cột của bảng 2 trong usp_Ticket_Search.</summary>
    private sealed class TicketRow
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public TicketStatus Status { get; set; }
        public TicketPriority Priority { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public Guid? AssigneeId { get; set; }
        public string? AssigneeName { get; set; }
        public Guid? CreatedById { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ResolveDueAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public bool IsSlaBreached { get; set; }
        public int CommentCount { get; set; }
    }
}
