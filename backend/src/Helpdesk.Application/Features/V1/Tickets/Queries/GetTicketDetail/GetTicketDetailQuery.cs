using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.GetTicketDetail;

public sealed record GetTicketDetailQuery(int Id) : IRequest<TicketDetailDto>;

public sealed class GetTicketDetailQueryHandler(ITicketDetailReader reader) : IRequestHandler<GetTicketDetailQuery, TicketDetailDto>
{
    public Task<TicketDetailDto> Handle(GetTicketDetailQuery request, CancellationToken ct) => reader.GetAsync(request.Id, ct);
}
