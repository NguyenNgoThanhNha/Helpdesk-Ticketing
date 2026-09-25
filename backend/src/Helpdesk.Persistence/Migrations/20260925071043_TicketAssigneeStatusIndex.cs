using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Helpdesk.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TicketAssigneeStatusIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tickets_AssigneeId",
                table: "Tickets");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_AssigneeId_Status",
                table: "Tickets",
                columns: new[] { "AssigneeId", "Status" })
                .Annotation("SqlServer:Include", new[] { "CreatedDate", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tickets_AssigneeId_Status",
                table: "Tickets");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_AssigneeId",
                table: "Tickets",
                column: "AssigneeId");
        }
    }
}
