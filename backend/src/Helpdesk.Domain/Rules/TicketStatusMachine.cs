using Helpdesk.Domain.Enums;

namespace Helpdesk.Domain.Rules;

/// <summary>Máy trạng thái hợp lệ của ticket.</summary>
public static class TicketStatusMachine
{
    private static readonly Dictionary<TicketStatus, TicketStatus[]> Transitions = new()
    {
        [TicketStatus.New] = [TicketStatus.Open, TicketStatus.InProgress, TicketStatus.Closed],
        [TicketStatus.Open] = [TicketStatus.InProgress, TicketStatus.Pending, TicketStatus.Resolved, TicketStatus.Closed],
        [TicketStatus.InProgress] = [TicketStatus.Open, TicketStatus.Pending, TicketStatus.Resolved],
        [TicketStatus.Pending] = [TicketStatus.InProgress, TicketStatus.Resolved],
        [TicketStatus.Resolved] = [TicketStatus.Open, TicketStatus.Closed],
        [TicketStatus.Closed] = []
    };

    public static IReadOnlyList<TicketStatus> NextStatuses(TicketStatus from) => Transitions[from];

    public static bool CanTransition(TicketStatus from, TicketStatus to) => Transitions[from].Contains(to);

    public static bool IsActive(TicketStatus status) =>
        status is not (TicketStatus.Resolved or TicketStatus.Closed);
}
