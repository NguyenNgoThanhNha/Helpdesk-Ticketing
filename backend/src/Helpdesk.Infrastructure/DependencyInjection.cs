using Helpdesk.Application.Common.Interfaces;
using Helpdesk.Infrastructure.BackgroundJobs;
using Helpdesk.Infrastructure.Commons;
using Helpdesk.Infrastructure.Logging;
using Helpdesk.Infrastructure.Security;
using Helpdesk.Infrastructure.Seed;
using Helpdesk.Infrastructure.Services;
using Helpdesk.Persistence;
using Helpdesk.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Helpdesk.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration,
        bool enableBackgroundJobs = true)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddMemoryCache();

        // --- Data: DbContext + audit interceptor + UnitOfWork (open generic, Scoped — chuẩn BE §5) ---
        services.AddScoped<AuditSaveChangesInterceptor>();
        services.AddDbContext<HelpdeskDbContext>((sp, options) =>
        {
            options.UseSqlServer(configuration.GetConnectionString("Default"),
                    sql => sql.MigrationsAssembly(typeof(HelpdeskDbContext).Assembly.FullName))
                .AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
        });
        services.AddScoped(typeof(IRepository<,>), typeof(Repository<,>));
        services.AddScoped(typeof(IUnitOfWork<>), typeof(UnitOfWork<>));

        // --- Security ---
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, PasswordHasherAdapter>();
        services.AddSingleton<PermissionCacheVersion>();
        services.AddScoped<IPermissionService, PermissionService>();

        // --- External services ---
        services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton<IEmailSender, LoggingEmailSender>();
        services.AddTransient<LoggingDelegatingHandler>();

        // --- API logging (chuẩn BE §9.2) ---
        services.Configure<ApiLoggingOptions>(configuration.GetSection(ApiLoggingOptions.SectionName));
        services.AddSingleton<ApiLogQueue>();

        services.AddScoped<DataSeeder>();

        if (enableBackgroundJobs)
        {
            services.AddHostedService<ApiLogWriterService>();
            services.AddHostedService<ApiLogCleanupService>();
            services.AddHostedService<SlaMonitorService>();
        }

        return services;
    }
}
