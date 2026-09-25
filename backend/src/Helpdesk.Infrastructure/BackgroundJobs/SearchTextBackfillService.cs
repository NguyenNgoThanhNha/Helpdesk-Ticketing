using Helpdesk.Application.Features.V1.Tickets.Commands.BackfillSearchText;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Infrastructure.BackgroundJobs;

/// <summary>Chạy một lần sau khi khởi động: điền SearchText cho ticket cũ (không chặn app khởi động).</summary>
public sealed class SearchTextBackfillService(IServiceScopeFactory scopeFactory, ILogger<SearchTextBackfillService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); // để migration/seed xong trước
            using var scope = scopeFactory.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(new BackfillTicketSearchTextCommand(), stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "SearchText backfill failed — search vẫn đúng nhờ fallback trong usp_Ticket_Search");
        }
    }
}
