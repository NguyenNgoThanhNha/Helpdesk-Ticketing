using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Helpdesk.Application.Features.V1.Tickets.Commands.BackfillSearchText;
using Helpdesk.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Helpdesk.IntegrationTests;

[Collection(ApiCollection.Name)]
public class RealtimeAndSearchTests(HelpdeskApiFactory factory)
{
    private async Task<(HttpClient Client, string Token, Guid UserId)> LoginAsync(string email, string password)
    {
        var client = factory.CreateClient();
        var body = JsonNode.Parse(await (await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }))
            .Content.ReadAsStringAsync())!;
        var token = body["accessToken"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return (client, token, Guid.Parse(body["user"]!["id"]!.GetValue<string>()));
    }

    private HubConnection Hub(string token) => new HubConnectionBuilder()
        .WithUrl(new Uri(factory.Server.BaseAddress, "hubs/notifications"), o =>
        {
            o.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            o.Transports = HttpTransportType.LongPolling; // TestServer không hỗ trợ WebSocket
            o.AccessTokenProvider = () => Task.FromResult<string?>(token);
        })
        .Build();

    private async Task<int> CreateTicketAsync(HttpClient customer, string title)
    {
        var categoryId = (await customer.GetFromJsonAsync<JsonArray>("/api/v1/categories"))![0]!["id"]!.GetValue<int>();
        var r = await customer.PostAsJsonAsync("/api/v1/tickets", new { title, description = "Mô tả chi tiết", categoryId, priority = "High" });
        r.EnsureSuccessStatusCode();
        return JsonNode.Parse(await r.Content.ReadAsStringAsync())!["id"]!.GetValue<int>();
    }

    [Fact]
    public async Task Assignee_receives_notification_and_ticket_changes_in_realtime()
    {
        var (customer, _, _) = await LoginAsync("customer@helpdesk.local", "Customer@123");
        var (admin, adminToken, adminId) = await LoginAsync("admin@helpdesk.local", "Admin@123");
        var ticketId = await CreateTicketAsync(customer, $"Realtime {Guid.NewGuid():N}");

        // Admin tự nhận ticket → khi khách trả lời, thông báo đi tới admin.
        var detail = await admin.GetFromJsonAsync<JsonObject>($"/api/v1/tickets/{ticketId}");
        (await admin.PatchAsJsonAsync($"/api/v1/tickets/{ticketId}",
            new { rowVersion = detail!["rowVersion"]!.GetValue<string>(), assigneeId = adminId })).EnsureSuccessStatusCode();

        await using var hub = Hub(adminToken);
        var notification = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var changed = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        hub.On<JsonElement>("notification", n => { if (n.GetProperty("ticketId").GetInt32() == ticketId) notification.TrySetResult(n); });
        hub.On<JsonElement>("ticketChanged", c => changed.TrySetResult(c));
        await hub.StartAsync();
        await hub.InvokeAsync("JoinTicket", ticketId);

        (await customer.PostAsJsonAsync($"/api/v1/tickets/{ticketId}/comments", new { body = "Em vẫn chưa đăng nhập được" }))
            .EnsureSuccessStatusCode();

        var n = await notification.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.True(n.GetProperty("id").GetInt64() > 0);
        Assert.EndsWith("Z", n.GetProperty("createdAt").GetString());

        var c = await changed.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(ticketId, c.GetProperty("ticketId").GetInt32());
        Assert.Equal("commented", c.GetProperty("change").GetString());
    }

    [Fact]
    public async Task JoinTicket_is_forbidden_for_users_who_cannot_view_the_ticket()
    {
        var (customer, _, _) = await LoginAsync("customer@helpdesk.local", "Customer@123");
        var ticketId = await CreateTicketAsync(customer, "Không cho người lạ xem");

        var reg = await factory.CreateClient().PostAsJsonAsync("/api/v1/auth/register",
            new { email = $"x{Guid.NewGuid():N}@test.local", password = "Secret@123", fullName = "Người lạ" });
        var strangerToken = JsonNode.Parse(await reg.Content.ReadAsStringAsync())!["accessToken"]!.GetValue<string>();

        await using var hub = Hub(strangerToken);
        await hub.StartAsync();
        var ex = await Assert.ThrowsAsync<HubException>(() => hub.InvokeAsync("JoinTicket", ticketId));
        Assert.Contains("forbidden", ex.Message);
    }

    [Fact]
    public async Task Hub_rejects_anonymous_connections()
    {
        await using var hub = Hub("not-a-token");
        await Assert.ThrowsAnyAsync<Exception>(() => hub.StartAsync());
    }

    [Fact]
    public async Task Search_ignores_case_and_vietnamese_diacritics_and_backfill_fills_old_rows()
    {
        var (customer, _, _) = await LoginAsync("customer@helpdesk.local", "Customer@123");
        var tag = $"q{Guid.NewGuid():N}"[..10];
        var ticketId = await CreateTicketAsync(customer, $"Lỗi xuất HÓA ĐƠN điện tử {tag}");

        async Task<int> Count(string q) =>
            (await customer.GetFromJsonAsync<JsonObject>($"/api/v1/tickets?search={Uri.EscapeDataString(q)}"))!["totalCount"]!.GetValue<int>();

        Assert.Equal(1, await Count($"hoa don dien tu {tag}"));  // không dấu, chữ thường
        Assert.Equal(1, await Count($"HÓA ĐƠN ĐIỆN TỬ {tag}"));  // có dấu, chữ hoa
        Assert.Equal(0, await Count($"hoa don dien thoai {tag}"));

        // Mô phỏng dòng cũ (chưa có SearchText): fallback vẫn tìm được, backfill điền lại.
        using (var scope = factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>().Database
                .ExecuteSqlInterpolatedAsync($"UPDATE dbo.Tickets SET SearchText = NULL WHERE Id = {ticketId}");
        Assert.Equal(1, await Count($"HÓA ĐƠN ĐIỆN TỬ {tag}")); // fallback LIKE theo collation thường

        using (var scope = factory.Services.CreateScope())
            Assert.True(await scope.ServiceProvider.GetRequiredService<ISender>().Send(new BackfillTicketSearchTextCommand()) >= 1);
        Assert.Equal(1, await Count($"hoa don dien tu {tag}"));
    }
}
