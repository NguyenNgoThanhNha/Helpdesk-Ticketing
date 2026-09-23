namespace Helpdesk.Application.Features.V1.Tickets.Services;

public sealed class TicketingOptions
{
    public const string SectionName = "Ticketing";

    /// <summary>Tự động gán ticket mới cho người có quyền TICKET_ASSIGN:R đang ít việc nhất.</summary>
    public bool AutoAssignEnabled { get; set; } = true;

    public long MaxAttachmentBytes { get; set; } = 10 * 1024 * 1024;

    public string[] AllowedAttachmentExtensions { get; set; } =
        [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt", ".log", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".zip"];

    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";

    public int SlaScanIntervalSeconds { get; set; } = 60;
}
