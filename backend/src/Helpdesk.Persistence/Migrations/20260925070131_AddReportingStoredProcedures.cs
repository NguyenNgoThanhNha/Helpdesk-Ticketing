using Helpdesk.Persistence.Sql;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Helpdesk.Persistence.Migrations
{
    /// <summary>Tạo stored procedure cho màn danh sách ticket và báo cáo (chuẩn BE §3.3, §5).</summary>
    public partial class AddReportingStoredProcedures : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(SqlScripts.Read(SqlScripts.TicketSearch));
            migrationBuilder.Sql(SqlScripts.Read(SqlScripts.ReportSummary));
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS [dbo].[usp_Report_Summary];");
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS [dbo].[usp_Ticket_Search];");
        }
    }
}
