namespace Helpdesk.Domain.Constants;

/// <summary>
/// Mã Activity (chức năng) cho phân quyền 6 bảng. Seeder đồng bộ danh sách <see cref="All"/> vào Sys_Activity.
/// Thêm chức năng mới = thêm hằng số + một dòng trong <see cref="All"/>.
/// </summary>
public static class ConstActivity
{
    public const string ApplicationName = "Helpdesk";

    public const string Ticket = "TICKET";
    public const string TicketAssign = "TICKET_ASSIGN";
    public const string Comment = "COMMENT";
    public const string Report = "REPORT";
    public const string Category = "CATEGORY";
    public const string SlaPolicy = "SLA_POLICY";
    public const string User = "USER";
    public const string Role = "ROLE";
    public const string ApiLog = "API_LOG";

    public sealed record Definition(string Code, string Name, string Description);

    public static readonly IReadOnlyList<Definition> All =
    [
        new(Ticket, "Ticket", "C: tạo ticket · R: xem tất cả ticket · U: đổi trạng thái/ưu tiên · D: đóng ticket"),
        new(TicketAssign, "Gán ticket", "R: được nhận gán xử lý · U: gán/bỏ gán người xử lý"),
        new(Comment, "Bình luận", "C: trả lời/bình luận trên ticket"),
        new(Report, "Báo cáo", "R: xem dashboard, báo cáo"),
        new(Category, "Danh mục", "C: thêm · U: sửa danh mục"),
        new(SlaPolicy, "SLA", "U: cấu hình SLA theo mức ưu tiên"),
        new(User, "Người dùng", "R: xem user · U: khóa/mở, gán role, cấp quyền riêng"),
        new(Role, "Vai trò", "C: tạo · R: xem · U: sửa quyền role · D: xóa role"),
        new(ApiLog, "Log API", "R: xem log request/response API để debug")
    ];
}
