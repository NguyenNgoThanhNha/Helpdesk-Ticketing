using System.Collections;
using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Helpdesk.Application.Common.Interfaces;

/// <summary>
/// Cửa truy cập dữ liệu DUY NHẤT cho handler (chuẩn BE §5). Handler inject IUnitOfWork&lt;HelpdeskDbContext&gt;,
/// không inject DbContext trực tiếp. Gọi <see cref="SaveChangesAsync"/> một lần ở cuối mỗi handler ghi.
/// </summary>
public interface IUnitOfWork<TContext> where TContext : DbContext
{
    /// <summary>DbSet để query LINQ / Add / Remove.</summary>
    DbSet<T> Repository<T>() where T : class;

    /// <summary>Generic repository cho CRUD cơ bản.</summary>
    IRepository<TEntity, TContext> GetRepository<TEntity>() where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Raw SQL trả về một bảng, map theo tên cột.</summary>
    Task<List<T>> RawSqlQueryAsync<T>(string querySql, params SqlParameter[] parameters);

    /// <summary>
    /// Raw SQL ghi (UPDATE/DELETE hàng loạt) — placeholder {0}, {1}… được EF chuyển thành tham số (an toàn injection).
    /// KHÔNG đi qua SaveChanges/interceptor → chỉ dùng cho tác vụ kỹ thuật (backfill, bảo trì), không cho nghiệp vụ.
    /// </summary>
    Task<int> ExecuteSqlRawAsync(string sql, IEnumerable<object> parameters, CancellationToken cancellationToken = default);

    /// <summary>Gọi stored procedure trả nhiều bảng (đồng bộ — giữ để tương thích template cũ; code mới dùng bản Async).</summary>
    DataSet ExecuteStoreProcedureGetMultiTables(string storeProcedure, Hashtable data);

    /// <summary>
    /// Bản async của <see cref="ExecuteStoreProcedureGetMultiTables"/> — ƯU TIÊN dùng trong handler (RULES 3.7):
    /// không giữ thread pool trong lúc chờ SQL. Key Hashtable có tiền tố '@', tên SP dạng [dbo].[usp_X].
    /// </summary>
    Task<DataSet> ExecuteStoreProcedureGetMultiTablesAsync(string storeProcedure, Hashtable data, CancellationToken cancellationToken = default);
}

public interface IRepository<TEntity, TContext>
    where TEntity : class
    where TContext : DbContext
{
    IQueryable<TEntity> Query(bool asNoTracking = false);
    ValueTask<TEntity?> GetByIdAsync(object id, CancellationToken cancellationToken = default);
    void Add(TEntity entity);
    void AddRange(IEnumerable<TEntity> entities);
    void Update(TEntity entity);

    /// <summary>Với BaseEntity sẽ thành xóa mềm (AuditSaveChangesInterceptor).</summary>
    void Remove(TEntity entity);

    void RemoveRange(IEnumerable<TEntity> entities);
}
