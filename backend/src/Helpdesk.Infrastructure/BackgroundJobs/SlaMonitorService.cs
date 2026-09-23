using Helpdesk.Application.Features.V1.Sla.Commands.ScanSla;
using Helpdesk.Application.Features.V1.Tickets.Services;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Helpdesk.Infrastructure.BackgroundJobs;

/// <summary>Định kỳ gửi ScanSlaCommand: đánh dấu ticket quá hạn, cảnh báo ticket sắp hết hạn.</summary>
public sealed class SlaMonitorService(
    IServiceScopeFactory scopeFactory,
    IOptions<TicketingOptions> options,
    ILogger<SlaMonitorService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(10, options.Value.SlaScanIntervalSeconds)));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ScanSlaCommand(), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "SLA scan failed");
            }
        }
    }
}
