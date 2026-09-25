using Helpdesk.Persistence.Sql;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Helpdesk.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TicketSearchText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Tickets",
                type: "nvarchar(max)",
                nullable: true,
                collation: "Latin1_General_100_BIN2");

            // SP tìm kiếm dùng cột mới (file .sql luôn là bản mới nhất, CREATE OR ALTER). Dòng cũ có SearchText = NULL
            // được SearchTextBackfillService điền sau khi khởi động; trong lúc đó SP có fallback cho dòng NULL.
            migrationBuilder.Sql(SqlScripts.Read(SqlScripts.TicketSearch));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SearchText",
                table: "Tickets");
        }
    }
}
