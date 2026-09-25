using Helpdesk.Domain.Entities.Sys;
using Microsoft.Extensions.Logging;

namespace Helpdesk.Application.Common.Realtime;

/// <summary>Tên hub/event/group dùng chung giữa Application và Api (khớp docs/API-CONTRACT.md → Realtime).</summary>
public static class ConstRealtime
{
    public const string HubPath = "/hubs/notifications";
    public const string NotificationEvent = "notification";
    public const string TicketChangedEvent = "ticketChanged";

    public static string TicketGroup(int ticketId) => $"ticket:{ticketId}";
}

public static class TicketChangeKind
{
    public const string Updated = "updated";
    public const string Commented = "commented";
    public const string Attachment = "attachment";
    public const string Sla = "sla";
}

public sealed record RealtimeNotification(Guid UserId, long Id, string Message, int? TicketId, bool IsRead, DateTime CreatedAt);

public sealed record TicketChangedMessage(int TicketId, string Change, Guid? ActorId);

/// <summary>Đẩy message ra client (Api cài bằng SignalR).</summary>
public interface IRealtimePublisher
{
    Task PublishAsync(IReadOnlyList<RealtimeNotification> notifications, IReadOnlyList<TicketChangedMessage> ticketChanges,
        CancellationToken ct);
}

/// <summary>Không có kênh realtime (unit test, worker không host SignalR).</summary>
public sealed class NullRealtimePublisher : IRealtimePublisher
{
    public Task PublishAsync(IReadOnlyList<RealtimeNotification> notifications, IReadOnlyList<TicketChangedMessage> ticketChanges,
        CancellationToken ct) => Task.CompletedTask;
}

public interface IRealtimeOutbox
{
    /// <summary>Xếp hàng notification vừa Add vào UnitOfWork — gửi đi SAU khi SaveChanges thành công (Id đã có).</summary>
    void Enqueue(SysNotification notification);

    void TicketChanged(int ticketId, string change, Guid? actorId);

    Task FlushAsync(CancellationToken ct);
}

/// <summary>
/// Outbox trong phạm vi request: handler chỉ xếp hàng, RealtimeDispatchBehavior gửi khi handler chạy xong không lỗi.
/// → client không bao giờ nhận sự kiện của dữ liệu chưa lưu / bị rollback. Lỗi gửi realtime chỉ log, không làm hỏng request.
/// </summary>
public sealed class RealtimeOutbox(IRealtimePublisher publisher, ILogger<RealtimeOutbox> logger) : IRealtimeOutbox
{
    private readonly List<SysNotification> _notifications = [];
    private readonly List<TicketChangedMessage> _ticketChanges = [];

    public void Enqueue(SysNotification notification) => _notifications.Add(notification);

    public void TicketChanged(int ticketId, string change, Guid? actorId)
    {
        if (!_ticketChanges.Any(c => c.TicketId == ticketId && c.Change == change))
            _ticketChanges.Add(new TicketChangedMessage(ticketId, change, actorId));
    }

    public async Task FlushAsync(CancellationToken ct)
    {
        var notifications = _notifications
            .Where(n => n.Id > 0) // chỉ bản ghi đã lưu
            .Select(n => new RealtimeNotification(n.UserId, n.Id, n.Message, n.TicketId ?? n.Ticket?.Id, n.IsRead, n.CreatedDate))
            .ToList();
        var changes = _ticketChanges.ToList();
        _notifications.Clear();
        _ticketChanges.Clear();
        if (notifications.Count == 0 && changes.Count == 0) return;

        try
        {
            await publisher.PublishAsync(notifications, changes, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Realtime publish failed ({Notifications} notifications, {Changes} ticket changes)",
                notifications.Count, changes.Count);
        }
    }
}
