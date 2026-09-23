using Helpdesk.Api.Authorization;
using Helpdesk.Application.Common.Models;
using Helpdesk.Application.Features.V1.Tickets.Commands.AddComment;
using Helpdesk.Application.Features.V1.Tickets.Commands.CreateTicket;
using Helpdesk.Application.Features.V1.Tickets.Commands.UpdateTicket;
using Helpdesk.Application.Features.V1.Tickets.Commands.UploadAttachment;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Queries.DownloadAttachment;
using Helpdesk.Application.Features.V1.Tickets.Queries.GetTicketDetail;
using Helpdesk.Application.Features.V1.Tickets.Queries.GetTicketHistory;
using Helpdesk.Application.Features.V1.Tickets.Queries.SearchTickets;
using Helpdesk.Domain.Constants;
using Helpdesk.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Helpdesk.Api.Controllers.V1;

/// <summary>Xem danh sách/chi tiết: chủ ticket hoặc TICKET:R (kiểm tra theo dữ liệu trong handler).</summary>
[Route("api/v1/tickets")]
public sealed class TicketsController(ISender mediator) : ApiControllerBase(mediator)
{
    private const long MaxUploadBytes = 11 * 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<PagedResult<TicketListItemDto>>> Search([FromQuery] SearchTicketsQuery query, CancellationToken ct) =>
        Ok(await Mediator.Send(query, ct));

    [HttpPost]
    [HasPermission(ConstActivity.Ticket, ActivityType.Create)]
    public async Task<ActionResult<TicketDetailDto>> Create(CreateTicketCommand command, CancellationToken ct)
    {
        var ticket = await Mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = ticket.Id }, ticket);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TicketDetailDto>> GetById(int id, CancellationToken ct) =>
        Ok(await Mediator.Send(new GetTicketDetailQuery(id), ct));

    /// <summary>Quyền theo từng trường (TICKET:U/D, TICKET_ASSIGN:U) được kiểm tra trong handler.</summary>
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<TicketDetailDto>> Update(int id, UpdateTicketCommand command, CancellationToken ct) =>
        Ok(await Mediator.Send(command with { Id = id }, ct));

    [HttpPost("{id:int}/comments")]
    [HasPermission(ConstActivity.Comment, ActivityType.Create)]
    public async Task<ActionResult<CommentDto>> AddComment(int id, AddCommentCommand command, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await Mediator.Send(command with { TicketId = id }, ct));

    [HttpPost("{id:int}/attachments")]
    [RequestSizeLimit(MaxUploadBytes)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AttachmentDto>> Upload(int id, IFormFile file, [FromForm] int? commentId, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var result = await Mediator.Send(
            new UploadAttachmentCommand(id, commentId, stream, file.FileName, file.ContentType, file.Length), ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("{id:int}/attachments/{attachmentId:int}")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Download(int id, int attachmentId, CancellationToken ct)
    {
        var file = await Mediator.Send(new DownloadAttachmentQuery(id, attachmentId), ct);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet("{id:int}/history")]
    public async Task<ActionResult<IReadOnlyList<TicketHistoryDto>>> History(int id, CancellationToken ct) =>
        Ok(await Mediator.Send(new GetTicketHistoryQuery(id), ct));
}
