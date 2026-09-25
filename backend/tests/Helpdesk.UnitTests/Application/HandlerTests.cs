using Helpdesk.Application.Common.Realtime;
using Helpdesk.Application.Common.Exceptions;
using Helpdesk.Application.Common.Interfaces;
using Helpdesk.Application.Common.Security;
using Helpdesk.Application.Features.V1.Sla.Commands.ScanSla;
using Helpdesk.Application.Features.V1.Tickets.Commands.CreateTicket;
using Helpdesk.Application.Features.V1.Tickets.Commands.UpdateTicket;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Constants;
using Helpdesk.Domain.Entities.Tickets;
using Helpdesk.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Helpdesk.UnitTests.Application;

public class HandlerTests
{
    private static RealtimeOutbox Outbox() => new(new NullRealtimePublisher(), NullLogger<RealtimeOutbox>.Instance);

    private static ICurrentUser UserWith(Guid id, params (string Code, PermissionFlags Flags)[] permissions)
    {
        var user = Substitute.For<ICurrentUser>();
        user.UserId.Returns(id);
        user.IsAuthenticated.Returns(true);
        var effective = new EffectivePermissions(id, true, false, [], permissions.ToDictionary(p => p.Code, p => p.Flags));
        user.GetPermissionsAsync(Arg.Any<CancellationToken>()).Returns(effective);
        user.HasPermissionAsync(Arg.Any<string>(), Arg.Any<ActivityType>(), Arg.Any<CancellationToken>())
            .Returns(ci => effective.Has(ci.ArgAt<string>(0), ci.ArgAt<ActivityType>(1)));
        return user;
    }

    private static Ticket SeedTicket(TestDb db, Guid requesterId, DateTime now, int resolveHours = 8)
    {
        var category = new Category("Auth", 24);
        db.Context.Categories.Add(category);
        db.Context.SaveChanges();
        var ticket = Ticket.Create("T", "D", category.Id, TicketPriority.High, requesterId, now, SlaWindow.FromHours(2, resolveHours));
        db.Context.Tickets.Add(ticket);
        db.Context.SaveChanges();
        return ticket;
    }

    [Fact]
    public async Task Customer_cannot_change_priority()
    {
        using var db = new TestDb();
        var requester = db.AddUser("c@x.vn");
        var ticket = SeedTicket(db, requester.Id, DateTime.UtcNow);
        var handler = new UpdateTicketCommandHandler(db.UnitOfWork, UserWith(requester.Id), Substitute.For<IPermissionService>(),
            new SlaCalculator(db.UnitOfWork), new TicketNotifier(db.UnitOfWork, Outbox()), Substitute.For<ITicketDetailReader>(), Outbox(), TimeProvider.System);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new UpdateTicketCommand("AA==", null, TicketPriority.Low, null) { Id = ticket.Id }, default));
    }

    [Fact]
    public async Task Closing_requires_TICKET_D_even_with_TICKET_U()
    {
        using var db = new TestDb();
        var agent = db.AddUser("a@x.vn");
        var ticket = SeedTicket(db, Guid.NewGuid(), DateTime.UtcNow);
        var user = UserWith(agent.Id, (ConstActivity.Ticket, new PermissionFlags(false, true, true, false)));
        var handler = new UpdateTicketCommandHandler(db.UnitOfWork, user, Substitute.For<IPermissionService>(),
            new SlaCalculator(db.UnitOfWork), new TicketNotifier(db.UnitOfWork, Outbox()), Substitute.For<ITicketDetailReader>(), Outbox(), TimeProvider.System);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            handler.Handle(new UpdateTicketCommand("AA==", TicketStatus.Closed, null, null) { Id = ticket.Id }, default));
        Assert.Contains("đóng ticket", ex.Message);
    }

    [Fact]
    public async Task Sla_scan_marks_overdue_ticket_and_notifies_assignee()
    {
        using var db = new TestDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero));
        var agent = db.AddUser("agent@x.vn");
        var ticket = SeedTicket(db, Guid.NewGuid(), clock.GetUtcNow().UtcDateTime, resolveHours: 1);
        ticket.Assign(agent, null, clock.GetUtcNow().UtcDateTime);
        db.Context.SaveChanges();
        clock.Advance(TimeSpan.FromHours(2));

        var result = await new ScanSlaCommandHandler(db.UnitOfWork, new TicketNotifier(db.UnitOfWork, Outbox()), Outbox(), clock,
            NullLogger<ScanSlaCommandHandler>.Instance).Handle(new ScanSlaCommand(), default);

        Assert.Equal(1, result.Breached);
        Assert.True(db.Context.Tickets.Single().IsSlaBreached);
        Assert.Contains(db.Context.SysNotifications, n => n.UserId == agent.Id && n.TicketId == ticket.Id);
    }

    [Fact]
    public async Task Create_ticket_validator_rejects_long_title_and_unknown_category()
    {
        using var db = new TestDb();
        var validator = new CreateTicketCommandValidator(db.UnitOfWork);

        var result = await validator.ValidateAsync(new CreateTicketCommand(new string('x', 201), "d", 999, TicketPriority.High));

        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateTicketCommand.Title));
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateTicketCommand.CategoryId));
    }

    [Fact]
    public async Task Soft_delete_sets_IsDeleted_and_hides_row()
    {
        using var db = new TestDb();
        db.Context.Categories.Add(new Category("Temp", 10));
        db.Context.SaveChanges();

        db.Context.Categories.Remove(db.Context.Categories.Single());
        await db.Context.SaveChangesAsync();

        Assert.Empty(db.Context.Categories);
        Assert.True(db.Context.Categories.IgnoreQueryFilters().Single().IsDeleted);
    }
}
