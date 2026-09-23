using Helpdesk.Domain.Common;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Enums;

namespace Helpdesk.Domain.Entities.Tickets;

public class Comment : BaseEntity
{
    private Comment() { }

    internal Comment(Ticket ticket, Guid authorId, string body, DateTime createdAt)
    {
        Ticket = ticket;
        AuthorId = authorId;
        Body = body.Trim();
        CreatedById = authorId;
        CreatedDate = createdAt;
    }

    public int Id { get; private set; }
    public int TicketId { get; private set; }
    public Ticket Ticket { get; private set; } = null!;
    public Guid AuthorId { get; private set; }
    public SysAccount Author { get; private set; } = null!;
    public string Body { get; private set; } = null!;
    public ICollection<Attachment> Attachments { get; private set; } = new List<Attachment>();
}

public class Attachment : BaseEntity
{
    private Attachment() { }

    public Attachment(int ticketId, int? commentId, string fileName, string contentType, long size, string storagePath)
    {
        TicketId = ticketId;
        CommentId = commentId;
        FileName = fileName;
        ContentType = contentType;
        Size = size;
        StoragePath = storagePath;
    }

    public int Id { get; private set; }
    public int TicketId { get; private set; }
    public Ticket Ticket { get; private set; } = null!;
    public int? CommentId { get; private set; }
    public Comment? Comment { get; private set; }
    public string FileName { get; private set; } = null!;
    public string ContentType { get; private set; } = null!;
    public long Size { get; private set; }
    public string StoragePath { get; private set; } = null!;
}

/// <summary>Audit log nghiệp vụ: ai đổi gì, khi nào. ChangedBy = CreatedById (null = hệ thống).</summary>
public class TicketHistory : BaseEntity, IExplicitCreator
{
    public static class Fields
    {
        public const string Created = "Created";
        public const string Status = "Status";
        public const string Priority = "Priority";
        public const string Assignee = "Assignee";
        public const string Sla = "Sla";
    }

    private TicketHistory() { }

    internal TicketHistory(Ticket ticket, string field, string? oldValue, string? newValue, Guid? changedById, DateTime changedAt)
    {
        Ticket = ticket;
        Field = field;
        OldValue = oldValue;
        NewValue = newValue;
        CreatedById = changedById;
        CreatedDate = changedAt;
    }

    public long Id { get; private set; }
    public int TicketId { get; private set; }
    public Ticket Ticket { get; private set; } = null!;
    public string Field { get; private set; } = null!;
    public string? OldValue { get; private set; }
    public string? NewValue { get; private set; }
    public SysAccount? ChangedBy { get; private set; }
}

public class Category : BaseEntity
{
    private Category() { }

    public Category(string name, int defaultSlaHours) => Update(name, defaultSlaHours);

    public int Id { get; private set; }
    public string Name { get; private set; } = null!;

    /// <summary>SLA giải quyết mặc định (giờ) — dùng khi chưa cấu hình SlaPolicy cho mức ưu tiên.</summary>
    public int DefaultSlaHours { get; private set; }

    public void Update(string name, int defaultSlaHours)
    {
        Name = name.Trim();
        DefaultSlaHours = defaultSlaHours;
    }
}

public class SlaPolicy : BaseEntity
{
    private SlaPolicy() { }

    public SlaPolicy(TicketPriority priority, int responseHours, int resolveHours)
    {
        Priority = priority;
        Update(responseHours, resolveHours);
    }

    public int Id { get; private set; }
    public TicketPriority Priority { get; private set; }
    public int ResponseHours { get; private set; }
    public int ResolveHours { get; private set; }

    public void Update(int responseHours, int resolveHours)
    {
        ResponseHours = responseHours;
        ResolveHours = resolveHours;
    }
}
