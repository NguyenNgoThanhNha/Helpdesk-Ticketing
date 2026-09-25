using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Helpdesk.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CoveringIndexesWithIsDeleted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tickets_CreatedById",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_CreatedDate",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_Status",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_Status_ResolveDueAt",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_TicketHistories_CreatedDate",
                table: "TicketHistories");

            migrationBuilder.DropIndex(
                name: "IX_TicketHistories_TicketId_CreatedDate",
                table: "TicketHistories");

            migrationBuilder.DropIndex(
                name: "IX_Sys_UserRole_CreatedDate",
                table: "Sys_UserRole");

            migrationBuilder.DropIndex(
                name: "IX_Sys_UserActivity_CreatedDate",
                table: "Sys_UserActivity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_RoleActivity_CreatedDate",
                table: "Sys_RoleActivity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Role_CreatedDate",
                table: "Sys_Role");

            migrationBuilder.DropIndex(
                name: "IX_Sys_RefreshToken_CreatedDate",
                table: "Sys_RefreshToken");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Notification_CreatedDate",
                table: "Sys_Notification");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Notification_UserId_IsRead",
                table: "Sys_Notification");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Activity_CreatedDate",
                table: "Sys_Activity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Account_CreatedDate",
                table: "Sys_Account");

            migrationBuilder.DropIndex(
                name: "IX_SlaPolicies_CreatedDate",
                table: "SlaPolicies");

            migrationBuilder.DropIndex(
                name: "IX_Comments_CreatedDate",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_TicketId_CreatedDate",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Categories_CreatedDate",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Attachments_CreatedDate",
                table: "Attachments");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_CreatedById_CreatedDate",
                table: "Tickets",
                columns: new[] { "CreatedById", "CreatedDate" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_CreatedDate",
                table: "Tickets",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_IsSlaBreached_ResolveDueAt",
                table: "Tickets",
                columns: new[] { "IsSlaBreached", "ResolveDueAt" })
                .Annotation("SqlServer:Include", new[] { "Status", "IsDeleted", "SlaWarningSentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_Status_CreatedDate",
                table: "Tickets",
                columns: new[] { "Status", "CreatedDate" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistories_CreatedDate",
                table: "TicketHistories",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistories_TicketId_CreatedDate",
                table: "TicketHistories",
                columns: new[] { "TicketId", "CreatedDate" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_UserRole_CreatedDate",
                table: "Sys_UserRole",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_UserActivity_CreatedDate",
                table: "Sys_UserActivity",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_RoleActivity_CreatedDate",
                table: "Sys_RoleActivity",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Role_CreatedDate",
                table: "Sys_Role",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_RefreshToken_CreatedDate",
                table: "Sys_RefreshToken",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_RefreshToken_ExpiresAt",
                table: "Sys_RefreshToken",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Notification_CreatedDate",
                table: "Sys_Notification",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Notification_UserId_CreatedDate",
                table: "Sys_Notification",
                columns: new[] { "UserId", "CreatedDate" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Notification_UserId_IsRead",
                table: "Sys_Notification",
                columns: new[] { "UserId", "IsRead" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Activity_CreatedDate",
                table: "Sys_Activity",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Account_CreatedDate",
                table: "Sys_Account",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicies_CreatedDate",
                table: "SlaPolicies",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_CreatedDate",
                table: "Comments",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_TicketId_CreatedDate",
                table: "Comments",
                columns: new[] { "TicketId", "CreatedDate" })
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CreatedDate",
                table: "Categories",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_CreatedDate",
                table: "Attachments",
                column: "CreatedDate")
                .Annotation("SqlServer:Include", new[] { "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tickets_CreatedById_CreatedDate",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_CreatedDate",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_IsSlaBreached_ResolveDueAt",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_Tickets_Status_CreatedDate",
                table: "Tickets");

            migrationBuilder.DropIndex(
                name: "IX_TicketHistories_CreatedDate",
                table: "TicketHistories");

            migrationBuilder.DropIndex(
                name: "IX_TicketHistories_TicketId_CreatedDate",
                table: "TicketHistories");

            migrationBuilder.DropIndex(
                name: "IX_Sys_UserRole_CreatedDate",
                table: "Sys_UserRole");

            migrationBuilder.DropIndex(
                name: "IX_Sys_UserActivity_CreatedDate",
                table: "Sys_UserActivity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_RoleActivity_CreatedDate",
                table: "Sys_RoleActivity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Role_CreatedDate",
                table: "Sys_Role");

            migrationBuilder.DropIndex(
                name: "IX_Sys_RefreshToken_CreatedDate",
                table: "Sys_RefreshToken");

            migrationBuilder.DropIndex(
                name: "IX_Sys_RefreshToken_ExpiresAt",
                table: "Sys_RefreshToken");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Notification_CreatedDate",
                table: "Sys_Notification");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Notification_UserId_CreatedDate",
                table: "Sys_Notification");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Notification_UserId_IsRead",
                table: "Sys_Notification");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Activity_CreatedDate",
                table: "Sys_Activity");

            migrationBuilder.DropIndex(
                name: "IX_Sys_Account_CreatedDate",
                table: "Sys_Account");

            migrationBuilder.DropIndex(
                name: "IX_SlaPolicies_CreatedDate",
                table: "SlaPolicies");

            migrationBuilder.DropIndex(
                name: "IX_Comments_CreatedDate",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Comments_TicketId_CreatedDate",
                table: "Comments");

            migrationBuilder.DropIndex(
                name: "IX_Categories_CreatedDate",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Attachments_CreatedDate",
                table: "Attachments");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_CreatedById",
                table: "Tickets",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_CreatedDate",
                table: "Tickets",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_Status",
                table: "Tickets",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_Status_ResolveDueAt",
                table: "Tickets",
                columns: new[] { "Status", "ResolveDueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistories_CreatedDate",
                table: "TicketHistories",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistories_TicketId_CreatedDate",
                table: "TicketHistories",
                columns: new[] { "TicketId", "CreatedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_UserRole_CreatedDate",
                table: "Sys_UserRole",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_UserActivity_CreatedDate",
                table: "Sys_UserActivity",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_RoleActivity_CreatedDate",
                table: "Sys_RoleActivity",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Role_CreatedDate",
                table: "Sys_Role",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_RefreshToken_CreatedDate",
                table: "Sys_RefreshToken",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Notification_CreatedDate",
                table: "Sys_Notification",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Notification_UserId_IsRead",
                table: "Sys_Notification",
                columns: new[] { "UserId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Activity_CreatedDate",
                table: "Sys_Activity",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Sys_Account_CreatedDate",
                table: "Sys_Account",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_SlaPolicies_CreatedDate",
                table: "SlaPolicies",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_CreatedDate",
                table: "Comments",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_TicketId_CreatedDate",
                table: "Comments",
                columns: new[] { "TicketId", "CreatedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CreatedDate",
                table: "Categories",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_CreatedDate",
                table: "Attachments",
                column: "CreatedDate");
        }
    }
}
