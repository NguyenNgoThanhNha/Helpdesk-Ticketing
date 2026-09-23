using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Enums;
using Helpdesk.Domain.Exceptions;
using Helpdesk.Domain.Rules;

namespace Helpdesk.UnitTests.Domain;

public class TicketDomainTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Requester = Guid.NewGuid();

    private static Ticket NewTicket() =>
        Ticket.Create("Lỗi đăng nhập", "Mô tả", 1, TicketPriority.High, Requester, Now, SlaWindow.FromHours(2, 8));

    [Theory]
    [InlineData(TicketStatus.New, TicketStatus.Open, true)]
    [InlineData(TicketStatus.Open, TicketStatus.Resolved, true)]
    [InlineData(TicketStatus.Resolved, TicketStatus.Open, true)]
    [InlineData(TicketStatus.Resolved, TicketStatus.Pending, false)]
    [InlineData(TicketStatus.Closed, TicketStatus.Open, false)]
    [InlineData(TicketStatus.New, TicketStatus.Resolved, false)]
    public void StatusMachine_validates_transitions(TicketStatus from, TicketStatus to, bool expected) =>
        Assert.Equal(expected, TicketStatusMachine.CanTransition(from, to));

    [Fact]
    public void Create_sets_sla_deadlines_and_history()
    {
        var ticket = NewTicket();

        Assert.Equal(TicketStatus.New, ticket.Status);
        Assert.Equal(Now.AddHours(2), ticket.ResponseDueAt);
        Assert.Equal(Now.AddHours(8), ticket.ResolveDueAt);
        Assert.Single(ticket.History, h => h.Field == TicketHistory.Fields.Created);
    }

    [Fact]
    public void Invalid_transition_throws_domain_exception()
    {
        var ticket = NewTicket();
        Assert.Throws<InvalidStatusTransitionException>(() => ticket.ChangeStatus(TicketStatus.Resolved, Guid.NewGuid(), Now));
    }

    [Fact]
    public void Resolve_then_reopen_clears_resolved_at_and_records_history()
    {
        var ticket = NewTicket();
        var agent = Guid.NewGuid();
        ticket.ChangeStatus(TicketStatus.Open, agent, Now);
        ticket.ChangeStatus(TicketStatus.Resolved, agent, Now.AddHours(1));
        Assert.Equal(Now.AddHours(1), ticket.ResolvedAt);

        ticket.ChangeStatus(TicketStatus.Open, Requester, Now.AddHours(2));

        Assert.Null(ticket.ResolvedAt);
        Assert.Equal(3, ticket.History.Count(h => h.Field == TicketHistory.Fields.Status));
    }

    [Fact]
    public void First_reply_from_support_sets_first_response_and_opens_ticket()
    {
        var ticket = NewTicket();
        var agent = new SysAccount { Email = "a@x.vn", FullName = "Agent" };

        ticket.AddComment(agent, "Đã nhận", Now.AddMinutes(30));

        Assert.Equal(Now.AddMinutes(30), ticket.FirstRespondedAt);
        Assert.Equal(TicketStatus.Open, ticket.Status);
    }

    [Fact]
    public void Reply_from_requester_does_not_count_as_first_response()
    {
        var ticket = NewTicket();
        var requester = new SysAccount { Id = Requester, Email = "c@x.vn", FullName = "Customer" };

        ticket.AddComment(requester, "Bổ sung thông tin", Now);

        Assert.Null(ticket.FirstRespondedAt);
        Assert.Equal(TicketStatus.New, ticket.Status);
    }

    [Fact]
    public void Cannot_change_closed_ticket()
    {
        var ticket = NewTicket();
        ticket.ChangeStatus(TicketStatus.Closed, Guid.NewGuid(), Now);

        Assert.Throws<DomainException>(() =>
            ticket.ChangePriority(TicketPriority.Low, SlaWindow.FromHours(8, 72), Guid.NewGuid(), Now));
        Assert.Throws<DomainException>(() =>
            ticket.AddComment(new SysAccount { Email = "a@x.vn", FullName = "A" }, "hi", Now));
    }

    [Fact]
    public void Change_priority_recomputes_deadline_from_creation_time()
    {
        var ticket = NewTicket();
        ticket.ChangePriority(TicketPriority.Low, SlaWindow.FromHours(8, 72), Guid.NewGuid(), Now.AddHours(5));

        Assert.Equal(Now.AddHours(72), ticket.ResolveDueAt);
    }

    [Fact]
    public void Cannot_assign_to_locked_account()
    {
        var ticket = NewTicket();
        Assert.Throws<DomainException>(() =>
            ticket.Assign(new SysAccount { Email = "x@x.vn", FullName = "X", IsActive = false }, null, Now));
    }

    [Theory]
    [InlineData(TicketStatus.Open, 5, null, false, SlaState.OnTrack)]
    [InlineData(TicketStatus.Open, 1, null, false, SlaState.AtRisk)]
    [InlineData(TicketStatus.Open, -1, null, false, SlaState.Breached)]
    [InlineData(TicketStatus.Resolved, 5, 1, false, SlaState.Met)]
    [InlineData(TicketStatus.Resolved, 5, 6, false, SlaState.Breached)]
    [InlineData(TicketStatus.Open, 5, null, true, SlaState.Breached)]
    public void SlaRules_evaluate(TicketStatus status, int dueInHours, int? resolvedAfterHours, bool breached, SlaState expected)
    {
        var resolvedAt = resolvedAfterHours is { } h ? Now.AddHours(h) : (DateTime?)null;
        Assert.Equal(expected, SlaRules.Evaluate(status, Now.AddHours(dueInHours), resolvedAt, breached, Now));
    }
}
