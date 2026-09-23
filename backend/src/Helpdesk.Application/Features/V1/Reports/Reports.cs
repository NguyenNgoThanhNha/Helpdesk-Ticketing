namespace Helpdesk.Application.Features.V1.Reports.DTOs
{
    public sealed record KeyCountDto(string Key, int Count);

    public sealed record DayCountDto(string Date, int Count);

    public sealed record AgentPerformanceDto(
        Guid AgentId, string AgentName, int Assigned, int Resolved, double? AvgResolutionHours, double? SlaComplianceRate);

    public sealed record ReportSummaryDto(
        int TotalTickets,
        int OpenTickets,
        int BreachedTickets,
        double? AvgResolutionHours,
        double? SlaComplianceRate,
        IReadOnlyList<KeyCountDto> ByStatus,
        IReadOnlyList<KeyCountDto> ByCategory,
        IReadOnlyList<DayCountDto> ByDay,
        IReadOnlyList<AgentPerformanceDto> AgentPerformance);
}

namespace Helpdesk.Application.Features.V1.Reports.Queries.GetReportSummary
{
    using Helpdesk.Application.Features.V1.Reports.DTOs;
    using Helpdesk.Application.Features.V1.Tickets.Queries.SearchTickets;
    using Helpdesk.Domain.Entities.Sys;
    using Helpdesk.Domain.Entities.Tickets;

    /// <summary>Báo cáo tổng hợp theo ngày tạo ticket. from/to dạng yyyy-MM-dd, to tính cả ngày (mặc định 30 ngày gần nhất).</summary>
    public sealed record GetReportSummaryQuery(DateOnly? From, DateOnly? To) : IRequest<ReportSummaryDto>;

    public sealed class GetReportSummaryQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork, TimeProvider clock)
        : IRequestHandler<GetReportSummaryQuery, ReportSummaryDto>
    {
        public async Task<ReportSummaryDto> Handle(GetReportSummaryQuery request, CancellationToken ct)
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var to = request.To ?? DateOnly.FromDateTime(now);
            var from = request.From ?? to.AddDays(-29);
            if (from > to) throw new ValidationException("from", "Ngày bắt đầu phải trước ngày kết thúc.");

            var start = from.ToDateTime(TimeOnly.MinValue);
            var end = to.AddDays(1).ToDateTime(TimeOnly.MinValue);
            var tickets = unitOfWork.Repository<Ticket>().AsNoTracking().Where(t => t.CreatedDate >= start && t.CreatedDate < end);

            var total = await tickets.CountAsync(ct);
            var open = await tickets.CountAsync(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed, ct);
            var breached = await tickets.CountAsync(SearchTicketsQueryHandler.SlaPredicate(SlaState.Breached, now), ct);

            var byStatus = (await tickets.GroupBy(t => t.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct))
                .OrderBy(x => x.Key).Select(x => new KeyCountDto(x.Key.ToString(), x.Count)).ToList();

            var byCategory = (await tickets.GroupBy(t => t.Category.Name)
                    .Select(g => new { g.Key, Count = g.Count() }).OrderByDescending(x => x.Count).ToListAsync(ct))
                .Select(x => new KeyCountDto(x.Key, x.Count)).ToList();

            var perDay = await tickets.GroupBy(t => t.CreatedDate.Date).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
            var perDayMap = perDay.ToDictionary(x => DateOnly.FromDateTime(x.Key), x => x.Count);
            var byDay = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1)
                .Select(i => from.AddDays(i))
                .Select(d => new DayCountDto(d.ToString("yyyy-MM-dd"), perDayMap.GetValueOrDefault(d)))
                .ToList();

            // Số liệu thời gian giải quyết tính trong bộ nhớ trên tập ticket đã resolve (đủ nhỏ theo khoảng ngày).
            var resolved = await tickets.Where(t => t.ResolvedAt != null)
                .Select(t => new { t.AssigneeId, t.CreatedDate, ResolvedAt = t.ResolvedAt!.Value, t.ResolveDueAt, t.IsSlaBreached })
                .ToListAsync(ct);

            static double Hours(DateTime a, DateTime b) => (b - a).TotalHours;
            double? Avg<T>(IReadOnlyCollection<T> items, Func<T, double> selector) =>
                items.Count == 0 ? null : Math.Round(items.Average(selector), 1);
            double? Compliance<T>(IReadOnlyCollection<T> items, Func<T, bool> met) =>
                items.Count == 0 ? null : Math.Round(100.0 * items.Count(met) / items.Count, 1);

            var assigned = await tickets.Where(t => t.AssigneeId != null)
                .GroupBy(t => t.AssigneeId!.Value).Select(g => new { AgentId = g.Key, Count = g.Count() }).ToListAsync(ct);
            var agentIds = assigned.Select(a => a.AgentId).ToList();
            var names = await unitOfWork.Repository<SysAccount>().AsNoTracking().IgnoreQueryFilters()
                .Where(u => agentIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

            var agentPerformance = assigned
                .Select(a =>
                {
                    var mine = resolved.Where(r => r.AssigneeId == a.AgentId).ToList();
                    return new AgentPerformanceDto(a.AgentId, names.GetValueOrDefault(a.AgentId, "?"), a.Count, mine.Count,
                        Avg(mine, r => Hours(r.CreatedDate, r.ResolvedAt)),
                        Compliance(mine, r => !r.IsSlaBreached && (r.ResolveDueAt == null || r.ResolvedAt <= r.ResolveDueAt)));
                })
                .OrderByDescending(a => a.Resolved).ThenBy(a => a.AgentName)
                .ToList();

            return new ReportSummaryDto(total, open, breached,
                Avg(resolved, r => Hours(r.CreatedDate, r.ResolvedAt)),
                Compliance(resolved, r => !r.IsSlaBreached && (r.ResolveDueAt == null || r.ResolvedAt <= r.ResolveDueAt)),
                byStatus, byCategory, byDay, agentPerformance);
        }
    }
}
