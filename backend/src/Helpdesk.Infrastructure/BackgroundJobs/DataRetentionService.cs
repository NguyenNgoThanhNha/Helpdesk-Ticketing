using Helpdesk.Application.Features.V1.Maintenance.Commands.PurgeExpiredData;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Infrastructure.BackgroundJobs;

/// <summary>Mỗi ngày gửi PurgeExpiredDataCommand (dọn refresh token hết hạn, thông báo cũ).</summary>
public sealed class DataRetentionService(IServiceScopeFactory scopeFactory, ILogger<DataRetentionService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ISender>().Send(new PurgeExpiredDataCommand(), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Data retention job failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
