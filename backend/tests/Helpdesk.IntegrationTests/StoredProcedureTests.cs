using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Helpdesk.IntegrationTests;

/// <summary>
/// Kiểm tra usp_Ticket_Search và usp_Report_Summary chạy trên SQL Server thật (dynamic SQL chỉ lộ lỗi khi chạy).
/// Mỗi test tạo dữ liệu riêng có tiền tố duy nhất để không phụ thuộc test khác.
/// </summary>
[Collection(ApiCollection.Name)]
public class StoredProcedureTests(HelpdeskApiFactory factory)
{
    private async Task<(HttpClient Customer, HttpClient Agent, List<int> Ids, string Tag)> SeedAsync()
    {
        var tag = $"SP{Guid.NewGuid():N}"[..14];
        var customer = await factory.CreateClientForAsync("customer@helpdesk.local", "Customer@123");
        var agent = await factory.CreateClientForAsync("an.agent@helpdesk.local", "Agent@123");
        var categoryId = (await customer.GetFromJsonAsync<JsonArray>("/api/v1/categories"))![0]!["id"]!.GetValue<int>();

        var ids = new List<int>();
        foreach (var (title, priority) in new[] { ($"{tag} Alpha", "Low"), ($"{tag} Beta", "Urgent"), ($"{tag} Gamma", "Medium") })
        {
            var r = await customer.PostAsJsonAsync("/api/v1/tickets", new { title, description = "Mô tả " + tag, categoryId, priority });
            r.EnsureSuccessStatusCode();
            ids.Add(JsonNode.Parse(await r.Content.ReadAsStringAsync())!["id"]!.GetValue<int>());
        }
        return (customer, agent, ids, tag);
    }

    private static async Task<JsonObject> GetAsync(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
    }

    private static List<string> Titles(JsonObject page) =>
        page["items"]!.AsArray().Select(i => i!["title"]!.GetValue<string>()).ToList();

    [Fact]
    public async Task Search_filters_sorts_and_paginates()
    {
        var (_, agent, ids, tag) = await SeedAsync();

        var byText = await GetAsync(agent, $"/api/v1/tickets?search={tag}&sort=title_asc&pageSize=100");
        Assert.Equal(3, byText["totalCount"]!.GetValue<int>());
        Assert.Equal([$"{tag} Alpha", $"{tag} Beta", $"{tag} Gamma"], Titles(byText));

        var byPriority = await GetAsync(agent, $"/api/v1/tickets?search={tag}&sort=priority_desc");
        Assert.Equal($"{tag} Beta", Titles(byPriority)[0]); // Urgent trước

        var filtered = await GetAsync(agent, $"/api/v1/tickets?search={tag}&priority=Urgent");
        Assert.Equal([$"{tag} Beta"], Titles(filtered));

        var page2 = await GetAsync(agent, $"/api/v1/tickets?search={tag}&sort=title_asc&page=2&pageSize=2");
        Assert.Equal(3, page2["totalCount"]!.GetValue<int>());
        Assert.Equal([$"{tag} Gamma"], Titles(page2));

        var exact = await GetAsync(agent, $"/api/v1/tickets?search=%23{ids[1]}");
        Assert.Equal([ids[1]], exact["items"]!.AsArray().Select(i => i!["id"]!.GetValue<int>()));

        var item = byText["items"]![0]!;
        Assert.Equal("OnTrack", item["slaState"]!.GetValue<string>());
        Assert.False(string.IsNullOrEmpty(item["categoryName"]!.GetValue<string>()));
        Assert.EndsWith("Z", item["createdAt"]!.GetValue<string>());
    }

    [Fact]
    public async Task Search_respects_ownership_and_like_wildcards_are_escaped()
    {
        var (customer, _, _, tag) = await SeedAsync();
        var other = factory.CreateClient();
        var reg = await other.PostAsJsonAsync("/api/v1/auth/register",
            new { email = $"o{Guid.NewGuid():N}@test.local", password = "Secret@123", fullName = "Other" });
        other.DefaultRequestHeaders.Authorization = new("Bearer",
            JsonNode.Parse(await reg.Content.ReadAsStringAsync())!["accessToken"]!.GetValue<string>());

        Assert.Equal(3, (await GetAsync(customer, $"/api/v1/tickets?search={tag}"))["totalCount"]!.GetValue<int>());
        Assert.Equal(0, (await GetAsync(other, $"/api/v1/tickets?search={tag}"))["totalCount"]!.GetValue<int>());

        // '%' và '_' là ký tự thường, không phải wildcard.
        Assert.Equal(0, (await GetAsync(customer, "/api/v1/tickets?search=%25%25%25"))["totalCount"]!.GetValue<int>());
        Assert.Equal(0, (await GetAsync(customer, $"/api/v1/tickets?search={tag[..5]}_{tag[6..]}"))["totalCount"]!.GetValue<int>());
    }

    [Fact]
    public async Task Report_summary_aggregates_in_sql()
    {
        await SeedAsync();
        var admin = await factory.CreateClientForAsync("admin@helpdesk.local", "Admin@123");

        var report = await GetAsync(admin, "/api/v1/reports/summary");

        var total = report["totalTickets"]!.GetValue<int>();
        Assert.True(total >= 3);
        Assert.Equal(total, report["byStatus"]!.AsArray().Sum(s => s!["count"]!.GetValue<int>()));
        Assert.Equal(total, report["byCategory"]!.AsArray().Sum(s => s!["count"]!.GetValue<int>()));
        Assert.Equal(total, report["byDay"]!.AsArray().Sum(s => s!["count"]!.GetValue<int>()));
        Assert.Equal(30, report["byDay"]!.AsArray().Count);
        Assert.NotEmpty(report["agentPerformance"]!.AsArray());

        var tooLong = await admin.GetAsync("/api/v1/reports/summary?from=2020-01-01&to=2026-01-01");
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }
}
