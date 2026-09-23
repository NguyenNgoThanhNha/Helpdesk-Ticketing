using FluentValidation;
using Helpdesk.Application.Common.Behaviors;
using Helpdesk.Application.Features.V1.Auth.Services;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Mapster;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
        });
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        TypeAdapterConfig.GlobalSettings.Scan(assembly);

        services.Configure<TicketingOptions>(configuration.GetSection(TicketingOptions.SectionName));

        services.AddScoped<IAuthTokenIssuer, AuthTokenIssuer>();
        services.AddScoped<ICurrentUserDtoFactory, CurrentUserDtoFactory>();
        services.AddScoped<ISlaCalculator, SlaCalculator>();
        services.AddScoped<ITicketNotifier, TicketNotifier>();
        services.AddScoped<IAutoAssigner, LeastLoadedAutoAssigner>();
        services.AddScoped<ITicketDetailReader, TicketDetailReader>();

        return services;
    }
}
