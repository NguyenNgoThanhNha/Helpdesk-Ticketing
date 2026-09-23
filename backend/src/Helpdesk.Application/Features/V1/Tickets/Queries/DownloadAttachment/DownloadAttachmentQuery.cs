using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;

namespace Helpdesk.Application.Features.V1.Tickets.Queries.DownloadAttachment;

public sealed record DownloadAttachmentQuery(int TicketId, int AttachmentId) : IRequest<FileDownload>;

public sealed class DownloadAttachmentQueryHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork, ICurrentUser currentUser, IFileStorage storage)
    : IRequestHandler<DownloadAttachmentQuery, FileDownload>
{
    public async Task<FileDownload> Handle(DownloadAttachmentQuery request, CancellationToken ct)
    {
        var file = await unitOfWork.Repository<Attachment>().AsNoTracking()
                       .Where(a => a.Id == request.AttachmentId && a.TicketId == request.TicketId)
                       .Select(a => new { a.StoragePath, a.ContentType, a.FileName, a.Ticket.CreatedById })
                       .FirstOrDefaultAsync(ct)
                   ?? throw new NotFoundException("Attachment", request.AttachmentId);
        await TicketAccess.EnsureCanViewAsync(currentUser, file.CreatedById, ct);

        var stream = await storage.OpenReadAsync(file.StoragePath, ct);
        return new FileDownload(stream, file.ContentType, file.FileName);
    }
}
