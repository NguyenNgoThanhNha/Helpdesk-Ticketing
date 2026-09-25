-- =============================================
-- usp_Ticket_Search: danh sách ticket có lọc động + phân trang + sắp xếp.
-- Kết quả: bảng 1 = TotalCount; bảng 2 = các dòng của trang.
--
-- Kỹ thuật: dynamic SQL CÓ THAM SỐ (sp_executesql) — chỉ ghép điều kiện được truyền vào, ORDER BY lấy từ
-- whitelist → mỗi "hình dạng" truy vấn có plan riêng dùng đúng index (vd trang 1 mặc định chỉ đọc 20 dòng
-- theo IX CreatedDate). Mọi GIÁ TRỊ đều đi qua tham số → không có SQL injection.
-- SP không có global query filter của EF → phải tự lọc IsDeleted = 0.
-- Tạo/cập nhật bằng EF migration (chuẩn BE §3.3) — KHÔNG tạo tay trên DB.
-- =============================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Ticket_Search]
    @ViewerId        UNIQUEIDENTIFIER,
    @CanViewAll      BIT,
    @Status          INT              = NULL,
    @Priority        INT              = NULL,
    @CategoryId      INT              = NULL,
    @AssigneeId      UNIQUEIDENTIFIER = NULL,
    @Unassigned      BIT              = 0,
    @SearchText      NVARCHAR(200)    = NULL,  -- từ khóa gốc (chỉ dùng cho dòng cũ chưa có SearchText)
    @SearchNorm      NVARCHAR(200)    = NULL,  -- từ khóa đã chuẩn hóa (SearchNormalizer) → LIKE trên cột SearchText (BIN2)
    @SearchId        INT              = NULL,  -- "#123" → chỉ tìm theo Id (seek khóa chính)
    @SearchIdOrTitle BIT              = 0,     -- "123"  → Id = 123 OR Title LIKE %123%
    @SlaState        INT              = NULL,  -- 0 OnTrack · 1 AtRisk · 2 Breached · 3 Met
    @Now             DATETIME2,
    @AtRiskLimit     DATETIME2,
    @SortColumn      VARCHAR(20)      = 'createdAt',
    @SortDesc        BIT              = 1,
    @PageNumber      INT              = 1,
    @PageSize        INT              = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Like NVARCHAR(420) = CASE WHEN @SearchText IS NULL THEN NULL
        ELSE N'%' + REPLACE(REPLACE(REPLACE(@SearchText, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]') + N'%' END;
    DECLARE @NormLike NVARCHAR(420) = CASE WHEN @SearchNorm IS NULL OR @SearchNorm = N'' THEN @Like
        ELSE N'%' + REPLACE(REPLACE(REPLACE(@SearchNorm, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]') + N'%' END;
    DECLARE @Offset INT = (CASE WHEN @PageNumber < 1 THEN 0 ELSE @PageNumber - 1 END) * @PageSize;

    -- ---------- WHERE: chỉ ghép điều kiện có giá trị ----------
    DECLARE @Where NVARCHAR(MAX) = N' WHERE t.IsDeleted = 0';
    IF @CanViewAll = 0         SET @Where += N' AND t.CreatedById = @ViewerId';
    IF @Status IS NOT NULL     SET @Where += N' AND t.Status = @Status';
    IF @Priority IS NOT NULL   SET @Where += N' AND t.Priority = @Priority';
    IF @CategoryId IS NOT NULL SET @Where += N' AND t.CategoryId = @CategoryId';
    IF @Unassigned = 1         SET @Where += N' AND t.AssigneeId IS NULL';
    ELSE IF @AssigneeId IS NOT NULL SET @Where += N' AND t.AssigneeId = @AssigneeId';

    IF @SearchId IS NOT NULL AND @SearchIdOrTitle = 0 SET @Where += N' AND t.Id = @SearchId';
    ELSE IF @SearchIdOrTitle = 1                      SET @Where += N' AND (t.Id = @SearchId OR t.SearchText LIKE @NormLike'
                                                     + N' OR CASE WHEN t.SearchText IS NULL THEN CASE WHEN t.Title LIKE @Like THEN 1 ELSE 0 END ELSE 0 END = 1)';
    ELSE IF @Like IS NOT NULL                         SET @Where += N' AND (t.SearchText LIKE @NormLike'
                                                     + N' OR CASE WHEN t.SearchText IS NULL THEN CASE WHEN t.Title LIKE @Like OR t.Description LIKE @Like THEN 1 ELSE 0 END ELSE 0 END = 1)';

    SET @Where += CASE @SlaState
        WHEN 2 THEN N' AND (t.IsSlaBreached = 1 OR (t.Status NOT IN (4, 5) AND t.ResolveDueAt < @Now)'
                  + N' OR (t.ResolvedAt IS NOT NULL AND t.ResolvedAt > t.ResolveDueAt))'
        WHEN 1 THEN N' AND t.IsSlaBreached = 0 AND t.Status NOT IN (4, 5) AND t.ResolveDueAt >= @Now AND t.ResolveDueAt <= @AtRiskLimit'
        WHEN 0 THEN N' AND t.IsSlaBreached = 0 AND t.Status NOT IN (4, 5) AND (t.ResolveDueAt IS NULL OR t.ResolveDueAt > @AtRiskLimit)'
        WHEN 3 THEN N' AND t.IsSlaBreached = 0 AND t.Status IN (4, 5) AND (t.ResolveDueAt IS NULL OR t.ResolvedAt <= t.ResolveDueAt)'
        ELSE N'' END;

    -- ---------- ORDER BY: whitelist, tie-breaker Id để phân trang ổn định ----------
    DECLARE @Dir NVARCHAR(4) = CASE WHEN @SortDesc = 1 THEN N'DESC' ELSE N'ASC' END;
    DECLARE @OrderBy NVARCHAR(200) = N' ORDER BY ' + CASE @SortColumn
        WHEN 'priority'     THEN N't.Priority ' + @Dir + N', t.CreatedDate DESC'
        WHEN 'status'       THEN N't.Status ' + @Dir + N', t.CreatedDate DESC'
        WHEN 'resolveDueAt' THEN N't.ResolveDueAt ' + @Dir
        WHEN 'title'        THEN N't.Title ' + @Dir
        ELSE                     N't.CreatedDate ' + @Dir END + N', t.Id ' + @Dir;

    -- Tìm theo chữ: LIKE '%x%' không ước lượng được bằng plan cache → plan của từ khóa phổ biến (duyệt index CreatedDate
    -- + tra từng dòng) bị dùng lại cho từ khóa hiếm = tra cả bảng (đo: 1,4–1,8 s). RECOMPILE → plan theo đúng từ khóa
    -- (quét song song ~20–30 ms mọi loại từ khóa). Không tìm chữ → giữ plan cache như bình thường.
    -- Fallback cho dòng chưa backfill (SearchText NULL) bọc trong CASE lồng nhau: OR/AND KHÔNG đảm bảo thứ tự đánh giá,
    -- nếu viết "SearchText IS NULL AND Title LIKE" SQL vẫn chạy LIKE collation Unicode (rất tốn CPU) trên mọi dòng
    -- (đo: 1.360 ms CPU/câu). CASE đánh giá tuần tự → chỉ dòng NULL mới LIKE.
    DECLARE @Hint NVARCHAR(30) = CASE WHEN @Like IS NOT NULL THEN N' OPTION (RECOMPILE)' ELSE N'' END;

    DECLARE @Params NVARCHAR(MAX) = N'@ViewerId UNIQUEIDENTIFIER, @Status INT, @Priority INT, @CategoryId INT,
        @AssigneeId UNIQUEIDENTIFIER, @SearchId INT, @Like NVARCHAR(420), @NormLike NVARCHAR(420), @Now DATETIME2, @AtRiskLimit DATETIME2,
        @Offset INT, @PageSize INT';

    -- Bảng 1: tổng số dòng
    DECLARE @CountSql NVARCHAR(MAX) = N'SELECT COUNT(*) AS TotalCount FROM dbo.Tickets t' + @Where + @Hint + N';';
    EXEC sp_executesql @CountSql, @Params, @ViewerId, @Status, @Priority, @CategoryId, @AssigneeId, @SearchId, @Like, @NormLike,
         @Now, @AtRiskLimit, @Offset, @PageSize;

    -- Bảng 2: trang dữ liệu — phân trang trên khóa trước (đọc ít cột), rồi mới JOIN lấy thông tin hiển thị
    DECLARE @PageSql NVARCHAR(MAX) = N'
        WITH page AS (
            SELECT t.Id FROM dbo.Tickets t' + @Where + @OrderBy + N'
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
        )
        SELECT t.Id, t.Title, t.Status, t.Priority, t.CategoryId,
               c.Name                   AS CategoryName,
               t.AssigneeId,
               a.FullName               AS AssigneeName,
               t.CreatedById,
               ISNULL(cb.FullName, N'''') AS CreatedByName,
               t.CreatedDate            AS CreatedAt,
               t.ResolveDueAt, t.ResolvedAt, t.IsSlaBreached,
               (SELECT COUNT(*) FROM dbo.Comments cm WHERE cm.TicketId = t.Id AND cm.IsDeleted = 0) AS CommentCount
        FROM page p
        JOIN dbo.Tickets t           ON t.Id = p.Id
        JOIN dbo.Categories c        ON c.Id = t.CategoryId
        LEFT JOIN dbo.Sys_Account a  ON a.Id = t.AssigneeId
        LEFT JOIN dbo.Sys_Account cb ON cb.Id = t.CreatedById' + @OrderBy + @Hint + N';';
    EXEC sp_executesql @PageSql, @Params, @ViewerId, @Status, @Priority, @CategoryId, @AssigneeId, @SearchId, @Like, @NormLike,
         @Now, @AtRiskLimit, @Offset, @PageSize;
END
