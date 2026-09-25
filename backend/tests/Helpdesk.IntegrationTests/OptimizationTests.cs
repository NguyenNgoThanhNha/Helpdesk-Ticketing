using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Helpdesk.Application.Features.V1.Maintenance.Commands.PurgeExpiredData;
using Helpdesk.Domain.Entities.Sys;
using Helpdesk.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Helpdesk.IntegrationTests;

/// <summary>Dọn dữ liệu kỹ thuật (RULES 4.11), nén response (RULES 8.8), cache báo cáo (RULES 3.12) — chạy trên SQL thật.</summary>
[Collection(ApiCollection.Name)]
public class OptimizationTests(HelpdeskApiFactory factory)
{
    [Fact]
    public async Task Purge_deletes_expired_tokens_and_old_notifications_only()
    {
        var now = DateTime.UtcNow;
        Guid userId;
        long oldRead, oldUnread, veryOld, recentRead;
        Guid expired, revokedButValid, active;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
            userId = await db.SysAccounts.Where(u => u.Email == "admin@helpdesk.local").Select(u => u.Id).SingleAsync();

            SysRefreshToken Token(DateTime expiresAt, bool revoked) => new()
            {
                UserId = userId, TokenHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
                ExpiresAt = expiresAt, RevokedAt = revoked ? now.AddDays(-1) : null
            };
            var tokens = new[] { Token(now.AddDays(-3), false), Token(now.AddDays(5), true), Token(now.AddDays(5), false) };
            db.SysRefreshTokens.AddRange(tokens);

            SysNotification Notification(int ageDays, bool read) => new()
            {
                UserId = userId, Message = "purge-test", IsRead = read, CreatedDate = now.AddDays(-ageDays)
            };
            var notifications = new[] { Notification(100, true), Notification(100, false), Notification(200, false), Notification(10, true) };
            db.SysNotifications.AddRange(notifications);
            await db.SaveChangesAsync();

            (expired, revokedButValid, active) = (tokens[0].Id, tokens[1].Id, tokens[2].Id);
            (oldRead, oldUnread, veryOld, recentRead) = (notifications[0].Id, notifications[1].Id, notifications[2].Id, notifications[3].Id);
        }

        using (var scope = factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(new PurgeExpiredDataCommand());

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HelpdeskDbContext>();
            var tokenIds = await db.SysRefreshTokens.IgnoreQueryFilters()
                .Where(t => t.Id == expired || t.Id == revokedButValid || t.Id == active).Select(t => t.Id).ToListAsync();
            Assert.DoesNotContain(expired, tokenIds);
            Assert.Contains(revokedButValid, tokenIds); // còn hạn → giữ để phát hiện token bị dùng lại
            Assert.Contains(active, tokenIds);

            var ids = new[] { oldRead, oldUnread, veryOld, recentRead };
            var left = await db.SysNotifications.IgnoreQueryFilters().Where(n => ids.Contains(n.Id)).Select(n => n.Id).ToListAsync();
            Assert.Equal([oldUnread, recentRead], left.Order());
        }
    }

    [Fact]
    public async Task Responses_are_compressed_except_auth_and_api_log_keeps_plain_json()
    {
        var admin = await factory.CreateClientForAsync("admin@helpdesk.local", "Admin@123");

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users?pageSize=5");
        request.Headers.AcceptEncoding.ParseAdd("br");
        var compressed = await admin.SendAsync(request);
        Assert.Equal("br", Assert.Single(compressed.Content.Headers.ContentEncoding));

        using var login = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login")
        {
            Content = JsonContent.Create(new { email = "admin@helpdesk.local", password = "Admin@123" })
        };
        login.Headers.AcceptEncoding.ParseAdd("br, gzip");
        var auth = await factory.CreateClient().SendAsync(login);
        Assert.Empty(auth.Content.Headers.ContentEncoding); // có token → không nén (BREACH)

        // Request ghi (có log) được nén → log API phải chứa JSON đọc được, không phải byte nén.
        var marker = $"cmp-{Guid.NewGuid():N}";
        using var create = new HttpRequestMessage(HttpMethod.Post, "/api/v1/categories")
        {
            Content = JsonContent.Create(new { name = marker, defaultSlaHours = 24 })
        };
        create.Headers.AcceptEncoding.ParseAdd("br");
        var created = await admin.SendAsync(create);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("br", Assert.Single(created.Content.Headers.ContentEncoding));

        JsonObject? logs = null;
        for (var i = 0; i < 20 && (logs?["totalCount"]?.GetValue<int>() ?? 0) == 0; i++)
        {
            await Task.Delay(500);
            logs = await admin.GetFromJsonAsync<JsonObject>("/api/v1/api-logs?url=/api/v1/categories&method=POST&pageSize=50");
            if (logs is not null && !logs["items"]!.AsArray().Any()) logs = null;
        }
        var detailIds = logs!["items"]!.AsArray().Select(i => i!["id"]!.GetValue<long>());
        var found = false;
        foreach (var id in detailIds)
        {
            var detail = await admin.GetFromJsonAsync<JsonObject>($"/api/v1/api-logs/{id}");
            if (detail!["response"]?.GetValue<string>() is { } body && body.Contains(marker)) { found = true; break; }
        }
        Assert.True(found, "Log API phải ghi response JSON gốc (chưa nén) chứa tên danh mục vừa tạo.");
    }

    [Fact]
    public async Task Report_summary_is_cached_per_date_range()
    {
        var admin = await factory.CreateClientForAsync("admin@helpdesk.local", "Admin@123");
        var customer = await factory.CreateClientForAsync("customer@helpdesk.local", "Customer@123");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var url = $"/api/v1/reports/summary?from={today.AddDays(-4):yyyy-MM-dd}&to={today:yyyy-MM-dd}"; // khoảng riêng của test này

        var before = (await admin.GetFromJsonAsync<JsonObject>(url))!["totalTickets"]!.GetValue<int>();
        var categoryId = (await customer.GetFromJsonAsync<JsonArray>("/api/v1/categories"))![0]!["id"]!.GetValue<int>();
        (await customer.PostAsJsonAsync("/api/v1/tickets", new { title = "cache test", description = "x", categoryId, priority = "Low" }))
            .EnsureSuccessStatusCode();

        var cached = (await admin.GetFromJsonAsync<JsonObject>(url))!["totalTickets"]!.GetValue<int>();
        Assert.Equal(before, cached); // trong thời gian cache → vẫn số cũ

        var otherRange = $"/api/v1/reports/summary?from={today.AddDays(-3):yyyy-MM-dd}&to={today:yyyy-MM-dd}";
        Assert.True((await admin.GetFromJsonAsync<JsonObject>(otherRange))!["totalTickets"]!.GetValue<int>() >= before + 1);
    }
}
