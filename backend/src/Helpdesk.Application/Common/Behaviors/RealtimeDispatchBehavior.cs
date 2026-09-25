using Helpdesk.Application.Common.Realtime;
using MediatR;

namespace Helpdesk.Application.Common.Behaviors;

/// <summary>Sau khi handler chạy xong KHÔNG lỗi (đã SaveChanges) → gửi các sự kiện realtime đã xếp hàng trong outbox.</summary>
public sealed class RealtimeDispatchBehavior<TRequest, TResponse>(IRealtimeOutbox outbox) : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var response = await next(cancellationToken);
        await outbox.FlushAsync(cancellationToken);
        return response;
    }
}
