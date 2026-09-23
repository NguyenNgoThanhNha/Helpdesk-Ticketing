using Helpdesk.Api.Authorization;
using Helpdesk.Application.Common.Models;
using Helpdesk.Application.Features.V1.ApiLogs.DTOs;
using Helpdesk.Application.Features.V1.ApiLogs.Queries;
using Helpdesk.Application.Features.V1.Categories.Commands.SaveCategory;
using Helpdesk.Application.Features.V1.Categories.DTOs;
using Helpdesk.Application.Features.V1.Categories.Queries.GetCategories;
using Helpdesk.Application.Features.V1.Notifications.Commands;
using Helpdesk.Application.Features.V1.Notifications.DTOs;
using Helpdesk.Application.Features.V1.Notifications.Queries;
using Helpdesk.Application.Features.V1.Reports.DTOs;
using Helpdesk.Application.Features.V1.Reports.Queries.GetReportSummary;
using Helpdesk.Application.Features.V1.SlaPolicies.Commands.UpsertSlaPolicy;
using Helpdesk.Application.Features.V1.SlaPolicies.DTOs;
using Helpdesk.Application.Features.V1.SlaPolicies.Queries.GetSlaPolicies;
using Helpdesk.Domain.Constants;
using Helpdesk.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Helpdesk.Api.Controllers.V1;

[Route("api/v1/categories")]
public sealed class CategoriesController(ISender mediator) : ApiControllerBase(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken ct) =>
        Ok(await Mediator.Send(new GetCategoriesQuery(), ct));

    [HttpPost]
    [HasPermission(ConstActivity.Category, ActivityType.Create)]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryCommand command, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await Mediator.Send(command with { Id = null }, ct));

    [HttpPut("{id:int}")]
    [HasPermission(ConstActivity.Category, ActivityType.Update)]
    public async Task<ActionResult<CategoryDto>> Update(int id, SaveCategoryCommand command, CancellationToken ct) =>
        Ok(await Mediator.Send(command with { Id = id }, ct));
}

[Route("api/v1/sla-policies")]
public sealed class SlaPoliciesController(ISender mediator) : ApiControllerBase(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SlaPolicyDto>>> GetAll(CancellationToken ct) =>
        Ok(await Mediator.Send(new GetSlaPoliciesQuery(), ct));

    [HttpPut("{priority}")]
    [HasPermission(ConstActivity.SlaPolicy, ActivityType.Update)]
    public async Task<ActionResult<SlaPolicyDto>> Upsert(TicketPriority priority, UpsertSlaPolicyCommand command, CancellationToken ct) =>
        Ok(await Mediator.Send(command with { Priority = priority }, ct));
}

[Route("api/v1/notifications")]
public sealed class NotificationsController(ISender mediator) : ApiControllerBase(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> Get([FromQuery] bool unreadOnly = false, [FromQuery] int take = 20,
        CancellationToken ct = default) =>
        Ok(await Mediator.Send(new GetNotificationsQuery(unreadOnly, take), ct));

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountDto>> UnreadCount(CancellationToken ct) =>
        Ok(await Mediator.Send(new GetUnreadCountQuery(), ct));

    [HttpPost("{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id, CancellationToken ct)
    {
        await Mediator.Send(new MarkNotificationsReadCommand(id), ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await Mediator.Send(new MarkNotificationsReadCommand(null), ct);
        return NoContent();
    }
}

[Route("api/v1/reports")]
public sealed class ReportsController(ISender mediator) : ApiControllerBase(mediator)
{
    [HttpGet("summary")]
    [HasPermission(ConstActivity.Report, ActivityType.Read)]
    public async Task<ActionResult<ReportSummaryDto>> Summary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        Ok(await Mediator.Send(new GetReportSummaryQuery(from, to), ct));
}

/// <summary>Tra cứu log request/response API để debug (chuẩn BE §9.2).</summary>
[Route("api/v1/api-logs")]
[HasPermission(ConstActivity.ApiLog, ActivityType.Read)]
public sealed class ApiLogsController(ISender mediator) : ApiControllerBase(mediator)
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ApiLogListItemDto>>> Search([FromQuery] SearchApiLogsQuery query, CancellationToken ct) =>
        Ok(await Mediator.Send(query, ct));

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiLogDetailDto>> Get(long id, CancellationToken ct) =>
        Ok(await Mediator.Send(new GetApiLogDetailQuery(id), ct));
}
