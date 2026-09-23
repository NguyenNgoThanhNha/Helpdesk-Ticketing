namespace Helpdesk.Domain.Enums;

/// <summary>Thứ tự giá trị phản ánh vòng đời ticket (dùng khi sort).</summary>
public enum TicketStatus
{
    New = 0,
    Open = 1,
    InProgress = 2,
    Pending = 3,
    Resolved = 4,
    Closed = 5
}
