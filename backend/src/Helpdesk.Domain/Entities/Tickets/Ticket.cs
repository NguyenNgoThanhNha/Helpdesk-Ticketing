using Helpdesk.Domain.Common;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Enums;
using Helpdesk.Domain.Exceptions;
using Helpdesk.Domain.Rules;

namespace Helpdesk.Domain.Entities.Tickets;

/// <summary>
/// Aggregate root. Mọi thay đổi trạng thái/ưu tiên/người gán đi qua method để ghi TicketHistory (audit nghiệp vụ).
/// Người tạo ticket (requester) = <see cref="BaseEntity.CreatedById"/>.
/// </summary>
public class Ticket : BaseEntity
{
    private readonly List<Comment> _comments = [];
    private readonly List<TicketHistory> _history = [];

    private Ticket() { }

    public int Id { get; private set; }
    public string Title { get; private set; } = null!;
    public string Description { get; private set; } = null!;
    public TicketStatus Status { get; private set; }
    public TicketPriority Priority { get; private set; }

    public int CategoryId { get; private set; }
    public Category Category { get; private set; } = null!;

    public SysAccount? CreatedBy { get; private set; }

    public Guid? AssigneeId { get; private set; }
    public SysAccount? Assignee { get; private set; }

    public DateTime? FirstRespondedAt { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    public DateTime? ResponseDueAt { get; private set; }
    public DateTime? ResolveDueAt { get; private set; }
    public bool IsSlaBreached { get; private set; }
    public DateTime? SlaWarningSentAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    /// <summary>Tiêu đề + mô tả đã chuẩn hóa (<see cref="SearchNormalizer"/>) — cột collation BIN2 phục vụ tìm kiếm.
    /// Null với dữ liệu cũ chưa backfill (SP có fallback).</summary>
    public string? SearchText { get; private set; }

    public IReadOnlyCollection<Comment> Comments => _comments;
    public IReadOnlyCollection<TicketHistory> History => _history;

    public static Ticket Create(
        string title, string description, int categoryId, TicketPriority priority,
        Guid requesterId, DateTime now, SlaWindow sla)
    {
        var ticket = new Ticket
        {
            Title = title.Trim(),
            Description = description.Trim(),
            CategoryId = categoryId,
            Priority = priority,
            Status = TicketStatus.New,
            CreatedById = requesterId,
            CreatedDate = now,
            ResponseDueAt = now + sla.Response,
            ResolveDueAt = now + sla.Resolve
        };
        ticket.SearchText = BuildSearchText(ticket.Title, ticket.Description);
        ticket.AddHistory(TicketHistory.Fields.Created, null, TicketStatus.New.ToString(), requesterId, now);
        return ticket;
    }

    public Guid RequesterId => CreatedById ?? Guid.Empty;

    public static string BuildSearchText(string title, string description) =>
        SearchNormalizer.Normalize($"{title} {description}");

    public bool IsActive => TicketStatusMachine.IsActive(Status);

    public SlaState GetSlaState(DateTime now) =>
        SlaRules.Evaluate(Status, ResolveDueAt, ResolvedAt, IsSlaBreached, now);

    public void ChangeStatus(TicketStatus newStatus, Guid changedById, DateTime now)
    {
        if (newStatus == Status) return;
        if (!TicketStatusMachine.CanTransition(Status, newStatus))
            throw new InvalidStatusTransitionException(Status, newStatus);

        var old = Status;
        Status = newStatus;

        switch (newStatus)
        {
            case TicketStatus.Resolved:
                ResolvedAt = now;
                break;
            case TicketStatus.Closed:
                ResolvedAt ??= now;
                ClosedAt = now;
                break;
            case TicketStatus.Open when old == TicketStatus.Resolved:
                ResolvedAt = null; // mở lại
                break;
        }

        AddHistory(TicketHistory.Fields.Status, old.ToString(), newStatus.ToString(), changedById, now);
    }

    public void ChangePriority(TicketPriority newPriority, SlaWindow sla, Guid changedById, DateTime now)
    {
        if (newPriority == Priority) return;
        EnsureNotClosed();

        var old = Priority;
        Priority = newPriority;
        ResponseDueAt = CreatedDate + sla.Response;
        ResolveDueAt = CreatedDate + sla.Resolve;
        SlaWarningSentAt = null;

        AddHistory(TicketHistory.Fields.Priority, old.ToString(), newPriority.ToString(), changedById, now);
    }

    /// <param name="assignee">null = bỏ gán. Cần load sẵn navigation <see cref="Assignee"/> để ghi tên cũ.
    /// Việc kiểm tra người được gán có quyền nhận ticket nằm ở tầng Application (phân quyền).</param>
    public void Assign(SysAccount? assignee, Guid? changedById, DateTime now)
    {
        if (assignee?.Id == AssigneeId) return;
        EnsureNotClosed();
        if (assignee is { IsActive: false })
            throw new DomainException("Không thể gán ticket cho tài khoản đã bị khóa.");

        var oldName = Assignee?.FullName;
        AssigneeId = assignee?.Id;
        Assignee = assignee;

        AddHistory(TicketHistory.Fields.Assignee, oldName, assignee?.FullName, changedById, now);
    }

    public Comment AddComment(SysAccount author, string body, DateTime now)
    {
        EnsureNotClosed();

        var comment = new Comment(this, author.Id, body, now);
        _comments.Add(comment);

        // Phản hồi đầu tiên từ phía hỗ trợ (không phải người tạo ticket) → ghi nhận SLA phản hồi.
        if (author.Id != CreatedById)
        {
            FirstRespondedAt ??= now;
            if (Status == TicketStatus.New) ChangeStatus(TicketStatus.Open, author.Id, now);
        }

        return comment;
    }

    public void MarkSlaBreached(DateTime now)
    {
        if (IsSlaBreached) return;
        IsSlaBreached = true;
        AddHistory(TicketHistory.Fields.Sla, null, "Breached", null, now);
    }

    public void MarkSlaWarningSent(DateTime now) => SlaWarningSentAt = now;

    private void EnsureNotClosed()
    {
        if (Status == TicketStatus.Closed)
            throw new DomainException("Ticket đã đóng, không thể thay đổi.");
    }

    private void AddHistory(string field, string? oldValue, string? newValue, Guid? changedById, DateTime now) =>
        _history.Add(new TicketHistory(this, field, oldValue, newValue, changedById, now));
}

/// <summary>Khoảng thời gian SLA phản hồi / giải quyết tính từ lúc tạo ticket.</summary>
public readonly record struct SlaWindow(TimeSpan Response, TimeSpan Resolve)
{
    public static SlaWindow FromHours(int responseHours, int resolveHours) =>
        new(TimeSpan.FromHours(responseHours), TimeSpan.FromHours(resolveHours));
}
