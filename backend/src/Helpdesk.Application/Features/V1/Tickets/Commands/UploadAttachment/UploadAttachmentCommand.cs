using FluentValidation;
using Helpdesk.Application.Features.V1.Tickets.DTOs;
using Helpdesk.Application.Features.V1.Tickets.Services;
using Helpdesk.Domain.Entities.Tickets;
using Microsoft.Extensions.Options;

namespace Helpdesk.Application.Features.V1.Tickets.Commands.UploadAttachment;

public sealed record UploadAttachmentCommand(
    int TicketId, int? CommentId, Stream Content, string FileName, string ContentType, long Size)
    : IRequest<AttachmentDto>;

public sealed class UploadAttachmentCommandValidator : AbstractValidator<UploadAttachmentCommand>
{
    public UploadAttachmentCommandValidator(IOptions<TicketingOptions> options)
    {
        var opts = options.Value;
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(255)
            .Must(name => opts.AllowedAttachmentExtensions.Contains(Path.GetExtension(name), StringComparer.OrdinalIgnoreCase))
            .WithMessage($"Định dạng file không được hỗ trợ. Cho phép: {string.Join(", ", opts.AllowedAttachmentExtensions)}")
            .OverridePropertyName("file");
        RuleFor(x => x.Size).GreaterThan(0).WithMessage("File rỗng.")
            .LessThanOrEqualTo(opts.MaxAttachmentBytes)
            .WithMessage($"File tối đa {opts.MaxAttachmentBytes / 1024 / 1024}MB.")
            .OverridePropertyName("file");
    }
}

public sealed class UploadAttachmentCommandHandler(
    IUnitOfWork<HelpdeskDbContext> unitOfWork,
    ICurrentUser currentUser,
    IFileStorage storage) : IRequestHandler<UploadAttachmentCommand, AttachmentDto>
{
    public async Task<AttachmentDto> Handle(UploadAttachmentCommand request, CancellationToken ct)
    {
        var owner = await unitOfWork.Repository<Ticket>().AsNoTracking()
                        .Where(t => t.Id == request.TicketId)
                        .Select(t => new { t.CreatedById, t.Status })
                        .FirstOrDefaultAsync(ct)
                    ?? throw new NotFoundException("Ticket", request.TicketId);
        await TicketAccess.EnsureCanViewAsync(currentUser, owner.CreatedById, ct);
        if (owner.Status == TicketStatus.Closed) throw new ConflictException("Ticket đã đóng, không thể đính kèm file.");

        if (request.CommentId is { } commentId &&
            !await unitOfWork.Repository<Comment>().AnyAsync(c => c.Id == commentId && c.TicketId == request.TicketId, ct))
            throw new ValidationException("commentId", "Comment không thuộc ticket này.");

        var fileName = Path.GetFileName(request.FileName);
        var path = await storage.SaveAsync(request.Content, fileName, $"tickets/{request.TicketId}", ct);

        var attachment = new Attachment(request.TicketId, request.CommentId, fileName,
            string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType,
            request.Size, path);
        unitOfWork.Repository<Attachment>().Add(attachment);
        await unitOfWork.SaveChangesAsync(ct);

        return new AttachmentDto(attachment.Id, attachment.FileName, attachment.ContentType, attachment.Size,
            attachment.CommentId, attachment.CreatedDate);
    }
}
