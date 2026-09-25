namespace Helpdesk.Application.Features.V1.Reports.DTOs
{
    public sealed record KeyCountDto(string Key, int Count);

    public sealed record DayCountDto(string Date, int Count);

    public sealed record AgentPerformanceDto(
        Guid AgentId, string AgentName, int Assigned, int Resolved, double? AvgResolutionHours, double? SlaComplianceRate);

    /// <summary>Bất biến → HybridCache giữ nguyên instance ở L1, không phải serialize lại mỗi lần đọc.</summary>
    [System.ComponentModel.ImmutableObject(true)]
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
    using System.Collections;
    using Helpdesk.Application.Common.Data;
    using Helpdesk.Application.Features.V1.Reports.DTOs;
    using Microsoft.Extensions.Caching.Hybrid;
    using Microsoft.Extensions.Options;

    /// <summary>Báo cáo tổng hợp theo ngày tạo ticket. from/to dạng yyyy-MM-dd, to tính cả ngày (mặc định 30 ngày gần nhất).</summary>
    public sealed record GetReportSummaryQuery(DateOnly? From, DateOnly? To) : IRequest<ReportSummaryDto>;

    /// <summary>Cấu hình appsettings "Reports".</summary>
    public sealed class ReportOptions
    {
        public const string SectionName = "Reports";

        /// <summary>Thời gian cache kết quả báo cáo (giây). 0 = không cache.</summary>
        public int CacheSeconds { get; set; } = 60;
    }

    /// <summary>
    /// Tổng hợp số liệu nhiều bảng → stored procedure [dbo].[usp_Report_Summary] trả 5 bảng trong 1 round-trip
    /// (chuẩn BE §5 · RULES 3.7) thay vì 7 query + tính trong RAM.
    /// Kết quả cache theo khoảng ngày bằng HybridCache (RULES 3.12): báo cáo là số liệu chung (không lọc theo user),
    /// trễ tối đa <see cref="ReportOptions.CacheSeconds"/> giây là chấp nhận được cho dashboard;
    /// HybridCache chống stampede — nhiều người mở dashboard cùng lúc chỉ chạy SP một lần.
    /// </summary>
    public sealed class GetReportSummaryQueryHandler(
        IUnitOfWork<HelpdeskDbContext> unitOfWork,
        HybridCache cache,
        IOptions<ReportOptions> options,
        TimeProvider clock) : IRequestHandler<GetReportSummaryQuery, ReportSummaryDto>
    {
        private const int MaxRangeDays = 366;

        public async Task<ReportSummaryDto> Handle(GetReportSummaryQuery request, CancellationToken ct)
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var to = request.To ?? DateOnly.FromDateTime(now);
            var from = request.From ?? to.AddDays(-29);
            if (from > to) throw new ValidationException("from", "Ngày bắt đầu phải trước ngày kết thúc.");
            if (to.DayNumber - from.DayNumber >= MaxRangeDays)
                throw new ValidationException("from", $"Khoảng thời gian tối đa {MaxRangeDays} ngày.");

            var seconds = options.Value.CacheSeconds;
            if (seconds <= 0) return await ComputeAsync(from, to, now, ct);

            var lifetime = TimeSpan.FromSeconds(seconds);
            return await cache.GetOrCreateAsync(
                $"{ConstCacheKey.ReportSummaryPrefix}{from:yyyyMMdd}-{to:yyyyMMdd}",
                (from, to, now),
                (state, token) => new ValueTask<ReportSummaryDto>(ComputeAsync(state.from, state.to, state.now, token)),
                new HybridCacheEntryOptions { Expiration = lifetime, LocalCacheExpiration = lifetime },
                cancellationToken: ct);
        }

        private async Task<ReportSummaryDto> ComputeAsync(DateOnly from, DateOnly to, DateTime now, CancellationToken ct)
        {
            var ds = (await unitOfWork.ExecuteStoreProcedureGetMultiTablesAsync("[dbo].[usp_Report_Summary]", new Hashtable
            {
                ["@From"] = from.ToDateTime(TimeOnly.MinValue),
                ["@To"] = to.AddDays(1).ToDateTime(TimeOnly.MinValue),
                ["@Now"] = now
            }, ct)).ToDataSetSimpleRead();

            // Đọc đúng thứ tự bảng SP trả về.
            var kpi = ds.TryRead<KpiRow>()?.FirstOrDefault() ?? new KpiRow();
            var byStatus = (ds.TryRead<StatusRow>() ?? [])
                .Select(r => new KeyCountDto(((TicketStatus)r.Status).ToString(), r.Count)).ToList();
            var byCategory = (ds.TryRead<KeyCountRow>() ?? []).Select(r => new KeyCountDto(r.Key, r.Count)).ToList();
            var perDay = (ds.TryRead<DayRow>() ?? []).ToDictionary(r => DateOnly.FromDateTime(r.Day), r => r.Count);
            var agents = (ds.TryRead<AgentRow>() ?? [])
                .Select(r => new AgentPerformanceDto(r.AgentId, r.AgentName, r.Assigned, r.Resolved,
                    Round(r.AvgResolutionHours), Round(r.SlaComplianceRate)))
                .ToList();

            var byDay = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1)
                .Select(i => from.AddDays(i))
                .Select(d => new DayCountDto(d.ToString("yyyy-MM-dd"), perDay.GetValueOrDefault(d)))
                .ToList();

            return new ReportSummaryDto(kpi.TotalTickets, kpi.OpenTickets, kpi.BreachedTickets,
                Round(kpi.AvgResolutionHours), Round(kpi.SlaComplianceRate), byStatus, byCategory, byDay, agents);
        }

        private static double? Round(double? value) => value is { } v ? Math.Round(v, 1) : null;

        private sealed class KpiRow
        {
            public int TotalTickets { get; set; }
            public int OpenTickets { get; set; }
            public int BreachedTickets { get; set; }
            public double? AvgResolutionHours { get; set; }
            public double? SlaComplianceRate { get; set; }
        }

        private sealed class StatusRow
        {
            public int Status { get; set; }
            public int Count { get; set; }
        }

        private sealed class KeyCountRow
        {
            public string Key { get; set; } = string.Empty;
            public int Count { get; set; }
        }

        private sealed class DayRow
        {
            public DateTime Day { get; set; }
            public int Count { get; set; }
        }

        private sealed class AgentRow
        {
            public Guid AgentId { get; set; }
            public string AgentName { get; set; } = string.Empty;
            public int Assigned { get; set; }
            public int Resolved { get; set; }
            public double? AvgResolutionHours { get; set; }
            public double? SlaComplianceRate { get; set; }
        }
    }
}
