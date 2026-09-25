using Helpdesk.Domain.Entities.Sys;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Helpdesk.Application.Features.V1.Maintenance.Commands.PurgeExpiredData;

/// <summary>Cấu hình appsettings "DataRetention" — thời hạn giữ dữ liệu kỹ thuật (RULES 4.11).</summary>
public sealed class DataRetentionOptions
{
    public const string SectionName = "DataRetention";

    /// <summary>Xóa refresh token đã hết hạn quá N ngày (token revoke vẫn giữ tới khi hết hạn để phát hiện reuse).</summary>
    public int RefreshTokenGraceDays { get; set; } = 1;

    /// <summary>Xóa thông báo ĐÃ ĐỌC cũ hơn N ngày.</summary>
    public int ReadNotificationDays { get; set; } = 90;

    /// <summary>Xóa MỌI thông báo cũ hơn N ngày.</summary>
    public int NotificationDays { get; set; } = 180;

    /// <summary>Số dòng mỗi lần DELETE — nhỏ hơn ngưỡng lock escalation (~5000) để không khóa cả bảng.</summary>
    public int BatchSize { get; set; } = 4000;
}

public sealed record PurgeExpiredDataResult(int RefreshTokens, int Notifications);

/// <summary>
/// Dọn dữ liệu kỹ thuật tăng mãi (refresh token, thông báo). Job nền gọi mỗi ngày.
/// Đây là ngoại lệ có chủ đích của quy tắc xóa mềm: dữ liệu kỹ thuật hết hạn được XÓA CỨNG bằng ExecuteDeleteAsync
/// (+ IgnoreQueryFilters để dọn cả dòng đã xóa mềm) — không đi qua SaveChanges/interceptor.
/// </summary>
public sealed record PurgeExpiredDataCommand : IRequest<PurgeExpiredDataResult>;

public sealed class PurgeExpiredDataCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    IOptions<DataRetentionOptions> options,
    TimeProvider clock,
    ILogger<PurgeExpiredDataCommandHandler> logger) : IRequestHandler<PurgeExpiredDataCommand, PurgeExpiredDataResult>
{
    public async Task<PurgeExpiredDataResult> Handle(PurgeExpiredDataCommand request, CancellationToken ct)
    {
        var o = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var batch = Math.Max(100, o.BatchSize);

        var tokenCutoff = now.AddDays(-Math.Max(0, o.RefreshTokenGraceDays));
        var tokens = await DeleteInBatchesAsync(
            unitOfWork.Repository<SysRefreshToken>().IgnoreQueryFilters().Where(t => t.ExpiresAt < tokenCutoff), batch, ct);

        var readCutoff = now.AddDays(-Math.Max(1, o.ReadNotificationDays));
        var allCutoff = now.AddDays(-Math.Max(1, o.NotificationDays));
        var notifications = await DeleteInBatchesAsync(
            unitOfWork.Repository<SysNotification>().IgnoreQueryFilters().Where(n => n.IsRead && n.CreatedDate < readCutoff), batch, ct);
        notifications += await DeleteInBatchesAsync(
            unitOfWork.Repository<SysNotification>().IgnoreQueryFilters().Where(n => n.CreatedDate < allCutoff), batch, ct);

        if (tokens + notifications > 0)
            logger.LogInformation("Data retention: deleted {Tokens} refresh tokens, {Notifications} notifications", tokens, notifications);
        return new PurgeExpiredDataResult(tokens, notifications);
    }

    private static async Task<int> DeleteInBatchesAsync<T>(IQueryable<T> query, int batch, CancellationToken ct) where T : class
    {
        var total = 0;
        int deleted;
        do
        {
            deleted = await query.Take(batch).ExecuteDeleteAsync(ct);
            total += deleted;
        } while (deleted == batch);
        return total;
    }
}
