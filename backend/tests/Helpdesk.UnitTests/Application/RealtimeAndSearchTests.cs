using Helpdesk.Application.Common.Realtime;
using Helpdesk.Domain.Common;
using Helpdesk.Domain.Entities.Sys;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Helpdesk.UnitTests.Application;

public class RealtimeAndSearchTests
{
    [Theory]
    [InlineData("Hóa Đơn  lỗi", "hoa don loi")]
    [InlineData("KHÔNG ĐĂNG NHẬP được", "khong dang nhap duoc")]
    [InlineData("Tiếng Việt: ắ ằ ẳ ẵ ặ ơ ư", "tieng viet: a a a a a o u")]
    [InlineData("  ", "")]
    [InlineData(null, "")]
    public void SearchNormalizer_removes_case_and_vietnamese_diacritics(string? input, string expected) =>
        Assert.Equal(expected, SearchNormalizer.Normalize(input));

    [Fact]
    public async Task Outbox_publishes_only_saved_notifications_and_dedupes_ticket_changes()
    {
        var publisher = Substitute.For<IRealtimePublisher>();
        var outbox = new RealtimeOutbox(publisher, NullLogger<RealtimeOutbox>.Instance);
        var saved = new SysNotification { Id = 7, UserId = Guid.NewGuid(), Message = "đã lưu", TicketId = 3 };
        var unsaved = new SysNotification { UserId = Guid.NewGuid(), Message = "chưa lưu" }; // Id = 0
        outbox.Enqueue(saved);
        outbox.Enqueue(unsaved);
        outbox.TicketChanged(3, TicketChangeKind.Commented, null);
        outbox.TicketChanged(3, TicketChangeKind.Commented, null);

        await outbox.FlushAsync(default);

        await publisher.Received(1).PublishAsync(
            Arg.Is<IReadOnlyList<RealtimeNotification>>(l => l.Count == 1 && l[0].Id == 7 && l[0].TicketId == 3),
            Arg.Is<IReadOnlyList<TicketChangedMessage>>(l => l.Count == 1),
            Arg.Any<CancellationToken>());

        publisher.ClearReceivedCalls();
        await outbox.FlushAsync(default); // đã xả → không gửi lại
        await publisher.DidNotReceiveWithAnyArgs().PublishAsync(default!, default!, default);
    }

    [Fact]
    public async Task Outbox_publish_failure_does_not_throw()
    {
        var publisher = Substitute.For<IRealtimePublisher>();
        publisher.PublishAsync(default!, default!, default).ReturnsForAnyArgs(Task.FromException(new InvalidOperationException("hub down")));
        var outbox = new RealtimeOutbox(publisher, NullLogger<RealtimeOutbox>.Instance);
        outbox.TicketChanged(1, TicketChangeKind.Updated, null);

        await outbox.FlushAsync(default); // không ném lỗi — realtime không được làm hỏng request
    }
}
