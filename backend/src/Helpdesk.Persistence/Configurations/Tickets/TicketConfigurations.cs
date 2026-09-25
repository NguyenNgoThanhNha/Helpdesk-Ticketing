using Helpdesk.Domain.Entities.Tickets;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Helpdesk.Persistence.Configurations.Tickets;

public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("Tickets");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(4000).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
        // So khớp nhị phân trên chuỗi đã chuẩn hóa (không dấu, chữ thường) → LIKE nhanh ~4x, tìm không cần gõ dấu.
        builder.Property(x => x.SearchText).UseCollation("Latin1_General_100_BIN2");

        builder.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.Assignee).WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Comments).WithOne(c => c.Ticket).HasForeignKey(c => c.TicketId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.History).WithOne(h => h.Ticket).HasForeignKey(h => h.TicketId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(x => x.Comments).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(x => x.History).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Ignore(x => x.RequesterId);
        builder.Ignore(x => x.IsActive);

        // Mọi index phục vụ query EF/SP đều INCLUDE IsDeleted (RULES 4.10): query luôn có "IsDeleted = 0",
        // thiếu cột này SQL phải key lookup từng dòng hoặc bỏ index để quét cả bảng.

        // Lọc theo trạng thái + sort mặc định theo ngày tạo.
        builder.HasIndex(x => new { x.Status, x.CreatedDate }).IncludeProperties(x => x.IsDeleted);
        // Auto-assign (đếm ticket đang mở theo agent) và My Queue (lọc AssigneeId, sort CreatedDate).
        builder.HasIndex(x => new { x.AssigneeId, x.Status }).IncludeProperties(x => new { x.CreatedDate, x.IsDeleted });
        // Khách hàng xem ticket của mình, sort theo ngày tạo.
        builder.HasIndex(x => new { x.CreatedById, x.CreatedDate }).IncludeProperties(x => x.IsDeleted);
        // Job SLA (IsSlaBreached = 0 AND ResolveDueAt < now ORDER BY ResolveDueAt) và bộ lọc SLA sắp hết hạn.
        builder.HasIndex(x => new { x.IsSlaBreached, x.ResolveDueAt })
            .IncludeProperties(x => new { x.Status, x.IsDeleted, x.SlaWarningSentAt });
    }
}

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("Comments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Body).HasMaxLength(4000).IsRequired();
        builder.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.TicketId, x.CreatedDate }).IncludeProperties(x => x.IsDeleted); // đếm/đọc comment theo ticket
    }
}

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable("Attachments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        builder.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.StoragePath).HasMaxLength(500).IsRequired();
        builder.HasOne(x => x.Ticket).WithMany().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Comment).WithMany(c => c.Attachments).HasForeignKey(x => x.CommentId).OnDelete(DeleteBehavior.NoAction);
    }
}

public class TicketHistoryConfiguration : IEntityTypeConfiguration<TicketHistory>
{
    public void Configure(EntityTypeBuilder<TicketHistory> builder)
    {
        builder.ToTable("TicketHistories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Field).HasColumnType("varchar(30)").IsRequired();
        builder.Property(x => x.OldValue).HasMaxLength(200);
        builder.Property(x => x.NewValue).HasMaxLength(200);
        builder.HasOne(x => x.ChangedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.TicketId, x.CreatedDate }).IncludeProperties(x => x.IsDeleted);
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.HasIndex(x => x.Name).IsUnique().HasFilter("[IsDeleted] = 0");
    }
}

public class SlaPolicyConfiguration : IEntityTypeConfiguration<SlaPolicy>
{
    public void Configure(EntityTypeBuilder<SlaPolicy> builder)
    {
        builder.ToTable("SlaPolicies");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.Priority).IsUnique().HasFilter("[IsDeleted] = 0");
    }
}
