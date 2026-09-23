namespace Helpdesk.Application.Features.V1.SlaPolicies.DTOs
{
    public sealed record SlaPolicyDto(int Id, TicketPriority Priority, int ResponseHours, int ResolveHours);
}

namespace Helpdesk.Application.Features.V1.SlaPolicies.Queries.GetSlaPolicies
{
    using Helpdesk.Application.Features.V1.SlaPolicies.DTOs;
    using Helpdesk.Domain.Entities.Tickets;
    using Mapster;

    public sealed record GetSlaPoliciesQuery : IRequest<IReadOnlyList<SlaPolicyDto>>;

    public sealed class GetSlaPoliciesQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork)
        : IRequestHandler<GetSlaPoliciesQuery, IReadOnlyList<SlaPolicyDto>>
    {
        public async Task<IReadOnlyList<SlaPolicyDto>> Handle(GetSlaPoliciesQuery request, CancellationToken ct) =>
            await unitOfWork.Repository<SlaPolicy>().AsNoTracking().OrderBy(p => p.Priority).ProjectToType<SlaPolicyDto>().ToListAsync(ct);
    }
}

namespace Helpdesk.Application.Features.V1.SlaPolicies.Commands.UpsertSlaPolicy
{
    using System.Text.Json.Serialization;
    using FluentValidation;
    using Helpdesk.Application.Features.V1.SlaPolicies.DTOs;
    using Helpdesk.Domain.Entities.Tickets;
    using Mapster;

    /// <summary>Upsert SLA cho một mức ưu tiên. Áp dụng cho ticket tạo mới / đổi ưu tiên sau thời điểm này.</summary>
    public sealed record UpsertSlaPolicyCommand(int ResponseHours, int ResolveHours) : IRequest<SlaPolicyDto>
    {
        [JsonIgnore]
        public TicketPriority Priority { get; init; }
    }

    public sealed class UpsertSlaPolicyCommandValidator : AbstractValidator<UpsertSlaPolicyCommand>
    {
        public UpsertSlaPolicyCommandValidator()
        {
            RuleFor(x => x.Priority).IsInEnum();
            RuleFor(x => x.ResponseHours).InclusiveBetween(1, 24 * 30);
            RuleFor(x => x.ResolveHours).InclusiveBetween(1, 24 * 60)
                .GreaterThanOrEqualTo(x => x.ResponseHours).WithMessage("Thời gian giải quyết phải ≥ thời gian phản hồi.");
        }
    }

    public sealed class UpsertSlaPolicyCommandHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork)
        : IRequestHandler<UpsertSlaPolicyCommand, SlaPolicyDto>
    {
        public async Task<SlaPolicyDto> Handle(UpsertSlaPolicyCommand request, CancellationToken ct)
        {
            var policy = await unitOfWork.Repository<SlaPolicy>().FirstOrDefaultAsync(p => p.Priority == request.Priority, ct);
            if (policy is null)
            {
                policy = new SlaPolicy(request.Priority, request.ResponseHours, request.ResolveHours);
                unitOfWork.Repository<SlaPolicy>().Add(policy);
            }
            else
            {
                policy.Update(request.ResponseHours, request.ResolveHours);
            }

            await unitOfWork.SaveChangesAsync(ct);
            return policy.Adapt<SlaPolicyDto>();
        }
    }
}
