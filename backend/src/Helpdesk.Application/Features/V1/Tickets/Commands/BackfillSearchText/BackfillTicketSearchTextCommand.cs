using System.Text;
using Helpdesk.Domain.Entities.Tickets;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Application.Features.V1.Tickets.Commands.BackfillSearchText;

/// <summary>
/// Điền cột SearchText cho ticket cũ (tạo trước khi có cột). Chạy một lần lúc khởi động bởi SearchTextBackfillService;
/// idempotent (chỉ xử lý dòng SearchText IS NULL). Trong lúc chưa xong, usp_Ticket_Search có fallback cho dòng NULL.
/// Cập nhật bằng raw SQL theo lô: không đổi UpdatedDate/Updater vì đây không phải thay đổi nghiệp vụ.
/// </summary>
public sealed record BackfillTicketSearchTextCommand(int BatchSize = 1000) : IRequest<int>;

public sealed class BackfillTicketSearchTextCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ILogger<BackfillTicketSearchTextCommandHandler> logger) : IRequestHandler<BackfillTicketSearchTextCommand, int>
{
    public async Task<int> Handle(BackfillTicketSearchTextCommand request, CancellationToken ct)
    {
        var batch = Math.Clamp(request.BatchSize, 1, 1000); // 2 tham số/dòng, SQL Server tối đa 2100 tham số
        var total = 0;
        while (true)
        {
            var rows = await unitOfWork.Repository<Ticket>().IgnoreQueryFilters().AsNoTracking()
                .Where(t => t.SearchText == null)
                .OrderBy(t => t.Id)
                .Select(t => new { t.Id, t.Title, t.Description })
                .Take(batch)
                .ToListAsync(ct);
            if (rows.Count == 0) break;

            var sql = new StringBuilder("UPDATE t SET SearchText = v.SearchText FROM dbo.Tickets t JOIN (VALUES ");
            var parameters = new List<object>(rows.Count * 2);
            for (var i = 0; i < rows.Count; i++)
            {
                if (i > 0) sql.Append(',');
                sql.Append('(').Append('{').Append(parameters.Count).Append("},{").Append(parameters.Count + 1).Append("})");
                parameters.Add(rows[i].Id);
                parameters.Add(Ticket.BuildSearchText(rows[i].Title, rows[i].Description));
            }
            sql.Append(") v(Id, SearchText) ON t.Id = v.Id;");

            total += await unitOfWork.ExecuteSqlRawAsync(sql.ToString(), parameters, ct);
        }

        if (total > 0) logger.LogInformation("Backfilled SearchText for {Count} tickets", total);
        return total;
    }
}
