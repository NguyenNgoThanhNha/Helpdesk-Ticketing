// Feature nhỏ: gom DTO + Commands + Queries vào các namespace chuẩn trong một file cho gọn.
namespace Helpdesk.Application.Features.V1.Categories.DTOs
{
    public sealed record CategoryDto(int Id, string Name, int DefaultSlaHours);
}

namespace Helpdesk.Application.Features.V1.Categories.Queries.GetCategories
{
    using Helpdesk.Application.Features.V1.Categories.DTOs;
    using Helpdesk.Domain.Entities.Tickets;
    using Mapster;

    public sealed record GetCategoriesQuery : IRequest<IReadOnlyList<CategoryDto>>;

    public sealed class GetCategoriesQueryHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork)
        : IRequestHandler<GetCategoriesQuery, IReadOnlyList<CategoryDto>>
    {
        public async Task<IReadOnlyList<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken ct) =>
            await unitOfWork.Repository<Category>().AsNoTracking().OrderBy(c => c.Name).ProjectToType<CategoryDto>().ToListAsync(ct);
    }
}

namespace Helpdesk.Application.Features.V1.Categories.Commands.SaveCategory
{
    using System.Text.Json.Serialization;
    using FluentValidation;
    using Helpdesk.Application.Features.V1.Categories.DTOs;
    using Helpdesk.Domain.Entities.Tickets;
    using Mapster;

    /// <summary>Tạo mới (Id = null) hoặc cập nhật danh mục.</summary>
    public sealed record SaveCategoryCommand(string Name, int DefaultSlaHours) : IRequest<CategoryDto>
    {
        [JsonIgnore]
        public int? Id { get; init; }
    }

    public sealed class SaveCategoryCommandValidator : AbstractValidator<SaveCategoryCommand>
    {
        public SaveCategoryCommandValidator(IUnitOfWork<HelpdeskDbContext> unitOfWork)
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(100)
                .MustAsync(async (cmd, name, ct) => !await unitOfWork.Repository<Category>()
                    .AnyAsync(c => c.Name == name.Trim() && c.Id != (cmd.Id ?? 0), ct))
                .WithMessage("Tên danh mục đã tồn tại.");
            RuleFor(x => x.DefaultSlaHours).InclusiveBetween(1, 24 * 30);
        }
    }

    public sealed class SaveCategoryCommandHandler(IUnitOfWork<HelpdeskDbContext> unitOfWork)
        : IRequestHandler<SaveCategoryCommand, CategoryDto>
    {
        public async Task<CategoryDto> Handle(SaveCategoryCommand request, CancellationToken ct)
        {
            Category category;
            if (request.Id is { } id)
            {
                category = await unitOfWork.Repository<Category>().FirstOrDefaultAsync(c => c.Id == id, ct)
                           ?? throw new NotFoundException("Category", id);
                category.Update(request.Name, request.DefaultSlaHours);
            }
            else
            {
                category = new Category(request.Name, request.DefaultSlaHours);
                unitOfWork.Repository<Category>().Add(category);
            }

            await unitOfWork.SaveChangesAsync(ct);
            return category.Adapt<CategoryDto>();
        }
    }
}
