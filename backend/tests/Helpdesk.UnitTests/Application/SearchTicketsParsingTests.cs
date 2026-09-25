using Helpdesk.Application.Features.V1.Tickets.Queries.SearchTickets;

namespace Helpdesk.UnitTests.Application;

public class SearchTicketsParsingTests
{
    [Theory]
    [InlineData("#123", null, 123, false)]      // mã chính xác → seek khóa chính
    [InlineData("123", "123", 123, true)]       // số → mã hoặc tiêu đề
    [InlineData(" hóa đơn ", "hóa đơn", null, false)]
    [InlineData("#abc", "#abc", null, false)]   // '#' nhưng không phải số → tìm chữ
    [InlineData("", null, null, false)]
    [InlineData(null, null, null, false)]
    public void ParseSearch(string? input, string? text, int? id, bool idOrTitle)
    {
        var result = SearchTicketsQueryHandler.ParseSearch(input);

        Assert.Equal(text, result.Text);
        Assert.Equal(id, result.Id);
        Assert.Equal(idOrTitle, result.IdOrTitle);
    }

    [Fact]
    public void ParseSearch_truncates_long_terms() =>
        Assert.Equal(200, SearchTicketsQueryHandler.ParseSearch(new string('x', 500)).Text!.Length);

    [Theory]
    [InlineData("priority_asc", "priority", false)]
    [InlineData("PRIORITY_DESC", "priority", true)]
    [InlineData("resolveDueAt_asc", "resolveDueAt", false)]
    [InlineData("title", "title", true)]
    [InlineData("createdAt_desc; DROP TABLE Tickets", "createdAt", true)] // không nằm trong whitelist → mặc định
    [InlineData("hacker_asc", "createdAt", true)]
    [InlineData(null, "createdAt", true)]
    public void ParseSort_uses_whitelist(string? sort, string column, bool desc)
    {
        var (c, d) = SearchTicketsQueryHandler.ParseSort(sort);

        Assert.Equal(column, c);
        Assert.Equal(desc, d);
    }
}
