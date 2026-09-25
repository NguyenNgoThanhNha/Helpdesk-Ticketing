using FluentValidation;
using Helpdesk.Application.Common.Behaviors;
using Helpdesk.Application.Common.Realtime;
using Helpdesk.Application.Features.V1.Auth.Services;
using Helpdesk.Application.Features.V1.Maintenance.Commands.PurgeExpiredData;
using Helpdesk.Application.Features.V1.Reports.Queries.GetReportSummary;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Mapster;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Helpdesk.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
            cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
            cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
            cfg.AddOpenBehavior(typeof(RealtimeDispatchBehavior<,>)); // gửi realtime sau khi handler thành công
        });
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        TypeAdapterConfig.GlobalSettings.Scan(assembly);

        services.Configure<TicketingOptions>(configuration.GetSection(TicketingOptions.SectionName));
        services.Configure<ReportOptions>(configuration.GetSection(ReportOptions.SectionName));
        services.Configure<DataRetentionOptions>(configuration.GetSection(DataRetentionOptions.SectionName));

        // Realtime: outbox theo request; publisher mặc định no-op — Api thay bằng SignalR.
        services.AddScoped<IRealtimeOutbox, RealtimeOutbox>();
        services.TryAddSingleton<IRealtimePublisher, NullRealtimePublisher>();

        services.AddScoped<IAuthTokenIssuer, AuthTokenIssuer>();
        services.AddScoped<ICurrentUserDtoFactory, CurrentUserDtoFactory>();
        services.AddScoped<ISlaCalculator, SlaCalculator>();
        services.AddScoped<ITicketNotifier, TicketNotifier>();
        services.AddScoped<IAutoAssigner, LeastLoadedAutoAssigner>();
        services.AddScoped<ITicketDetailReader, TicketDetailReader>();

        return services;
    }
}
