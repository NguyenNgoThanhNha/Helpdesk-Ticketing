namespace Helpdesk.Application.Features.V1.Tickets.DTOs;

public sealed record TicketListItemDto(
    int Id,
    string Title,
    TicketStatus Status,
    TicketPriority Priority,
    int CategoryId,
    string CategoryName,
    Guid? AssigneeId,
    string? AssigneeName,
    Guid? CreatedById,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime? ResolveDueAt,
    SlaState SlaState,
    int CommentCount);

public sealed record CategoryRefDto(int Id, string Name);

public sealed record AttachmentDto(int Id, string FileName, string ContentType, long Size, int? CommentId, DateTime UploadedAt);

public sealed record CommentDto(
    int Id, UserSummaryDto Author, bool IsFromRequester, string Body, DateTime CreatedAt, IReadOnlyList<AttachmentDto> Attachments);

public sealed record TicketDetailDto(
    int Id,
    string Title,
    string Description,
    TicketStatus Status,
    TicketPriority Priority,
    CategoryRefDto Category,
    UserSummaryDto CreatedBy,
    UserSummaryDto? Assignee,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? FirstRespondedAt,
    DateTime? ResolvedAt,
    DateTime? ClosedAt,
    DateTime? ResponseDueAt,
    DateTime? ResolveDueAt,
    SlaState SlaState,
    string RowVersion,
    IReadOnlyList<TicketStatus> AllowedTransitions,
    bool CanChangePriority,
    bool CanAssign,
    bool CanComment,
    IReadOnlyList<CommentDto> Comments,
    IReadOnlyList<AttachmentDto> Attachments);

public sealed record TicketHistoryDto(
    long Id, string Field, string? OldValue, string? NewValue, UserSummaryDto? ChangedBy, DateTime ChangedAt);

public sealed record FileDownload(Stream Content, string ContentType, string FileName);
