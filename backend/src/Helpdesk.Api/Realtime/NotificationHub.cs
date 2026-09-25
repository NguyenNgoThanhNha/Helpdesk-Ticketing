using System.IdentityModel.Tokens.Jwt;
using Helpdesk.Application.Common.Realtime;
using Helpdesk.Application.Features.V1.Tickets.Queries.CheckTicketAccess;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Helpdesk.Api.Realtime;

/// <summary>
/// Hub realtime (docs/API-CONTRACT.md → Realtime). Mỏng như controller: kiểm quyền qua Mediator.
/// Server → client: "notification" (theo user), "ticketChanged" (theo group ticket:{id}).
/// Chạy nhiều instance → thêm AddStackExchangeRedis (backplane) để Clients.User/Group thấy nhau.
/// </summary>
[Authorize]
public sealed class NotificationHub(ISender mediator) : Hub
{
    public async Task JoinTicket(int ticketId)
    {
        var userId = Guid.Parse(Context.User!.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        if (!await mediator.Send(new CheckTicketAccessQuery(ticketId, userId), Context.ConnectionAborted))
            throw new HubException("forbidden");
        await Groups.AddToGroupAsync(Context.ConnectionId, ConstRealtime.TicketGroup(ticketId), Context.ConnectionAborted);
    }

    public Task LeaveTicket(int ticketId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ConstRealtime.TicketGroup(ticketId), Context.ConnectionAborted);
}

/// <summary>Clients.User(id) dùng claim "sub" (JWT không map sang NameIdentifier vì MapInboundClaims = false).</summary>
public sealed class SubClaimUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) =>
        connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}

public sealed class SignalRRealtimePublisher(IHubContext<NotificationHub> hub) : IRealtimePublisher
{
    public async Task PublishAsync(IReadOnlyList<RealtimeNotification> notifications, IReadOnlyList<TicketChangedMessage> ticketChanges,
        CancellationToken ct)
    {
        foreach (var n in notifications)
            await hub.Clients.User(n.UserId.ToString()).SendAsync(ConstRealtime.NotificationEvent,
                new { id = n.Id, message = n.Message, ticketId = n.TicketId, isRead = n.IsRead, createdAt = n.CreatedAt }, ct);

        foreach (var c in ticketChanges)
            await hub.Clients.Group(ConstRealtime.TicketGroup(c.TicketId)).SendAsync(ConstRealtime.TicketChangedEvent,
                new { ticketId = c.TicketId, change = c.Change, actorId = c.ActorId }, ct);
    }
}
