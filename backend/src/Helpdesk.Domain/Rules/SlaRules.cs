using Helpdesk.Domain.Enums;

namespace Helpdesk.Domain.Rules;

public static class SlaRules
{
    /// <summary>Còn ít hơn khoảng này tới hạn giải quyết thì coi là "sắp quá hạn".</summary>
    public static readonly TimeSpan AtRiskWindow = TimeSpan.FromHours(2);

    public static SlaState Evaluate(
        TicketStatus status, DateTime? resolveDueAt, DateTime? resolvedAt, bool isBreached, DateTime now)
    {
        if (resolveDueAt is null) return SlaState.OnTrack;

        if (!TicketStatusMachine.IsActive(status))
        {
            var doneAt = resolvedAt ?? now;
            return isBreached || doneAt > resolveDueAt ? SlaState.Breached : SlaState.Met;
        }

        if (isBreached || now > resolveDueAt) return SlaState.Breached;
        return resolveDueAt - now <= AtRiskWindow ? SlaState.AtRisk : SlaState.OnTrack;
    }
}
