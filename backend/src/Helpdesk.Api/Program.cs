using System.Text;
using System.Text.Json.Serialization;
using System.IO.Compression;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Helpdesk.Api.Authorization;
using Helpdesk.Api.Controllers.V1;
using Helpdesk.Api.Infrastructure;
using Helpdesk.Api.Realtime;
using Helpdesk.Application.Common.Realtime;
using Microsoft.AspNetCore.SignalR;
using Helpdesk.Application;
using Helpdesk.Application.Common.Interfaces;
using Helpdesk.Infrastructure;
using Helpdesk.Infrastructure.Logging;
using Helpdesk.Infrastructure.Security;
using Helpdesk.Infrastructure.Seed;
using Helpdesk.Persistence;
using Helpdesk.Persistence.Interceptors;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog(Serilogger.Configure);

// ---------- Services ----------
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration,
    enableBackgroundJobs: builder.Configuration.GetValue("BackgroundJobs:Enabled", true));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IAuditUser, HttpAuditUser>();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
        o.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase; // key trong errors (kể cả lỗi binding tự động) luôn camelCase
    });
builder.Services.AddProblemDetails();

// Nén response JSON (Brotli ưu tiên, Gzip dự phòng). Fastest: nén ~80% JSON mà gần như không tốn CPU.
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.Providers.Add<GzipCompressionProvider>();
    o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/problem+json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Realtime (SignalR): thông báo + ticket thay đổi. Nhiều instance → .AddStackExchangeRedis(...) làm backplane.
builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new UtcDateTimeJsonConverter()));
builder.Services.AddSingleton<IUserIdProvider, SubClaimUserIdProvider>();
builder.Services.AddSingleton<IRealtimePublisher, SignalRRealtimePublisher>();
builder.Services.AddHealthChecks().AddDbContextCheck<HelpdeskDbContext>();

// Auth: JWT chỉ mang định danh; quyền kiểm tra qua [HasPermission] + IPermissionService.
var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32) throw new InvalidOperationException("Jwt:Key phải dài tối thiểu 32 ký tự (đặt qua user-secrets / biến môi trường).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // giữ nguyên "sub", "name", "email"
        // WebSocket không gửi được header Authorization → SignalR gửi token qua query ?access_token= (CHỈ chấp nhận cho /hubs).
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs")) ctx.Token = token;
                return Task.CompletedTask;
            }
        };
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "name"
        };
    });
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(RateLimitPolicies.Auth, context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Configuration.GetValue("RateLimiting:AuthPermitPerMinute", 20),
            Window = TimeSpan.FromMinutes(1)
        }));
});

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Helpdesk API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Dán access token (không cần chữ 'Bearer')"
    });
    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

var app = builder.Build();

// ---------- Pipeline ----------
// Nén đứng NGOÀI api logging (log ghi JSON gốc, không phải byte đã nén) và KHÔNG nén /auth/* —
// response có token + nén HTTPS = rủi ro BREACH (RULES 8.8).
app.UseWhen(ctx => !ctx.Request.Path.StartsWithSegments("/api/v1/auth"), branch => branch.UseResponseCompression());
app.UseApiLogging();            // ngay sau nén → ghi được cả response lỗi do exception handler sinh ra
app.UseExceptionHandler();
app.UseStatusCodePages();       // 401/403/404 rỗng → ProblemDetails
app.UseSerilogRequestLogging();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseUserLogContext();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>(ConstRealtime.HubPath);
app.MapHealthChecks("/health");

await InitializeDatabaseAsync(app);

app.Run();

static async Task InitializeDatabaseAsync(WebApplication app)
{
    var config = app.Configuration;
    if (!config.GetValue("Database:MigrateOnStartup", app.Environment.IsDevelopment())) return;

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<DataSeeder>()
        .SeedAsync(config.GetValue("Database:SeedDemoData", app.Environment.IsDevelopment()));
}

public partial class Program;
