using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Helpdesk.IntegrationTests;

[Collection(ApiCollection.Name)]
public class ApiTests(HelpdeskApiFactory factory)
{
    private const string CustomerEmail = "customer@helpdesk.local";
    private const string CustomerPassword = "Customer@123";

    [Fact]
    public async Task Login_returns_effective_permissions()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "an.agent@helpdesk.local", password = "Agent@123" });

        response.EnsureSuccessStatusCode();
        var json = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        var permissions = json["user"]!["permissions"]!.AsArray();
        Assert.Contains(permissions, p => p!["code"]!.GetValue<string>() == "TICKET" && p["d"]!.GetValue<bool>());
        Assert.False(json["user"]!["isAdmin"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Wrong_password_returns_401_problem_details()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/v1/auth/login", new { email = CustomerEmail, password = "wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Customer_is_forbidden_on_reports_and_admin_endpoints()
    {
        var client = await factory.CreateClientForAsync(CustomerEmail, CustomerPassword);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/reports/summary")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/api-logs")).StatusCode);
    }

    [Fact]
    public async Task Customer_creates_ticket_and_agent_sees_it_in_list()
    {
        var customer = await factory.CreateClientForAsync(CustomerEmail, CustomerPassword);
        var categories = await customer.GetFromJsonAsync<JsonArray>("/api/v1/categories");

        var created = await customer.PostAsJsonAsync("/api/v1/tickets", new
        {
            title = "Integration ticket", description = "Created by test", categoryId = categories![0]!["id"]!.GetValue<int>(), priority = "Urgent"
        });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var ticket = JsonNode.Parse(await created.Content.ReadAsStringAsync())!;
        Assert.Equal("New", ticket["status"]!.GetValue<string>());
        Assert.NotNull(ticket["assignee"]); // auto-assign cho Agent

        var agent = await factory.CreateClientForAsync("an.agent@helpdesk.local", "Agent@123");
        var list = await agent.GetFromJsonAsync<JsonObject>("/api/v1/tickets?search=Integration&pageSize=50");
        Assert.Contains(list!["items"]!.AsArray(), i => i!["id"]!.GetValue<int>() == ticket["id"]!.GetValue<int>());
    }

    [Fact]
    public async Task Per_user_permission_takes_effect_immediately_and_api_is_logged()
    {
        var admin = await factory.CreateClientForAsync("admin@helpdesk.local", "Admin@123");
        var register = await factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
            new { email = $"it{Guid.NewGuid():N}@test.local", password = "Secret@123", fullName = "IT user" });
        var auth = JsonNode.Parse(await register.Content.ReadAsStringAsync())!;
        var user = factory.CreateClient();
        user.DefaultRequestHeaders.Authorization = new("Bearer", auth["accessToken"]!.GetValue<string>());

        var denied = await user.GetAsync("/api/v1/reports/summary");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        var traceId = JsonNode.Parse(await denied.Content.ReadAsStringAsync())!["traceId"]!.GetValue<string>();

        var activities = await admin.GetFromJsonAsync<JsonArray>("/api/v1/activities");
        var reportId = activities!.First(a => a!["code"]!.GetValue<string>() == "REPORT")!["id"]!.GetValue<string>();
        var grant = await admin.PutAsJsonAsync($"/api/v1/users/{auth["user"]!["id"]}/permissions",
            new { activities = new[] { new { activityId = reportId, c = false, r = true, u = false, d = false } } });
        grant.EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/v1/reports/summary")).StatusCode);

        // Log API được ghi nền theo lô → chờ tối đa ~10 giây.
        JsonObject? logs = null;
        for (var i = 0; i < 20 && (logs?["totalCount"]?.GetValue<int>() ?? 0) == 0; i++)
        {
            await Task.Delay(500);
            logs = await admin.GetFromJsonAsync<JsonObject>($"/api/v1/api-logs?traceId={Uri.EscapeDataString(traceId)}");
        }
        Assert.Equal(1, logs!["totalCount"]!.GetValue<int>());

        var registerLog = await admin.GetFromJsonAsync<JsonObject>("/api/v1/api-logs?url=/auth/register&pageSize=1");
        var detail = await admin.GetFromJsonAsync<JsonObject>($"/api/v1/api-logs/{registerLog!["items"]![0]!["id"]}");
        Assert.DoesNotContain("Secret@123", detail!["request"]!.GetValue<string>());
    }
}
