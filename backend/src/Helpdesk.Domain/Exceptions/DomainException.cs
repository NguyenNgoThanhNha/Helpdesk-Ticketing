namespace Helpdesk.Domain.Exceptions;

/// <summary>Vi phạm quy tắc nghiệp vụ trong domain (map sang HTTP 409).</summary>
public class DomainException(string message) : Exception(message);

public sealed class InvalidStatusTransitionException(Enums.TicketStatus from, Enums.TicketStatus to)
    : DomainException($"Không thể chuyển trạng thái từ '{from}' sang '{to}'.")
{
    public Enums.TicketStatus From { get; } = from;
    public Enums.TicketStatus To { get; } = to;
}
