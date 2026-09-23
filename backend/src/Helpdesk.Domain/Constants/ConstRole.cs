namespace Helpdesk.Domain.Constants;

public static class ConstRole
{
    /// <summary>Giá trị Sys_Role.RoleType của role Admin (toàn quyền, không sửa được quyền).</summary>
    public const int AdminRoleType = 1;

    public const string Admin = "Admin";
    public const string Agent = "Agent";
    public const string Customer = "Customer";

    /// <summary>Role mặc định cho tài khoản tự đăng ký.</summary>
    public const string DefaultForRegistration = Customer;

    /// <summary>Quyền seed mặc định cho role hệ thống (Admin không cần — ngầm định toàn quyền).</summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<(string Code, string Flags)>> DefaultPermissions =
        new Dictionary<string, IReadOnlyList<(string, string)>>
        {
            [Agent] =
            [
                (ConstActivity.Ticket, "CRUD"),
                (ConstActivity.TicketAssign, "RU"),
                (ConstActivity.Comment, "C"),
                (ConstActivity.Report, "R")
            ],
            [Customer] =
            [
                (ConstActivity.Ticket, "C"),
                (ConstActivity.Comment, "C")
            ]
        };
}
