-- =============================================
-- usp_Report_Summary: số liệu dashboard trong khoảng [@From, @To) theo ngày tạo ticket.
-- Trả 5 bảng theo thứ tự: KPI · ByStatus · ByCategory · ByDay · AgentPerformance.
-- Tính toán tổng hợp hoàn toàn trong SQL (1 round-trip) thay vì kéo dữ liệu lên RAM.
-- SP không có global query filter của EF → tự lọc IsDeleted = 0.
-- =============================================
CREATE OR ALTER PROCEDURE [dbo].[usp_Report_Summary]
    @From DATETIME2,
    @To   DATETIME2,   -- exclusive
    @Now  DATETIME2
AS
BEGIN
    SET NOCOUNT ON;

    SELECT t.Id, t.Status, t.CategoryId, t.AssigneeId, t.CreatedDate, t.ResolvedAt, t.ResolveDueAt, t.IsSlaBreached,
           CAST(CASE WHEN t.IsSlaBreached = 1
                       OR (t.Status NOT IN (4, 5) AND t.ResolveDueAt < @Now)
                       OR (t.ResolvedAt IS NOT NULL AND t.ResolvedAt > t.ResolveDueAt) THEN 1 ELSE 0 END AS BIT) AS IsBreached,
           CAST(CASE WHEN t.ResolvedAt IS NOT NULL AND t.IsSlaBreached = 0
                      AND (t.ResolveDueAt IS NULL OR t.ResolvedAt <= t.ResolveDueAt) THEN 1 ELSE 0 END AS BIT) AS IsMet
    INTO #r
    FROM dbo.Tickets t
    WHERE t.IsDeleted = 0 AND t.CreatedDate >= @From AND t.CreatedDate < @To;

    -- 1. KPI
    SELECT COUNT(*)                                                         AS TotalTickets,
           SUM(CASE WHEN Status NOT IN (4, 5) THEN 1 ELSE 0 END)            AS OpenTickets,
           SUM(CASE WHEN IsBreached = 1 THEN 1 ELSE 0 END)                  AS BreachedTickets,
           AVG(CASE WHEN ResolvedAt IS NOT NULL
                    THEN DATEDIFF(MINUTE, CreatedDate, ResolvedAt) / 60.0 END) AS AvgResolutionHours,
           CASE WHEN SUM(CASE WHEN ResolvedAt IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
                ELSE 100.0 * SUM(CASE WHEN IsMet = 1 THEN 1 ELSE 0 END)
                           / SUM(CASE WHEN ResolvedAt IS NOT NULL THEN 1 ELSE 0 END) END AS SlaComplianceRate
    FROM #r;

    -- 2. Theo trạng thái
    SELECT Status, COUNT(*) AS [Count] FROM #r GROUP BY Status ORDER BY Status;

    -- 3. Theo danh mục
    SELECT c.Name AS [Key], COUNT(*) AS [Count]
    FROM #r r JOIN dbo.Categories c ON c.Id = r.CategoryId
    GROUP BY c.Name ORDER BY COUNT(*) DESC;

    -- 4. Theo ngày (chỉ ngày có dữ liệu — tầng ứng dụng tự lấp ngày trống)
    SELECT CAST(CreatedDate AS DATE) AS [Day], COUNT(*) AS [Count]
    FROM #r GROUP BY CAST(CreatedDate AS DATE);

    -- 5. Hiệu suất theo người xử lý
    SELECT r.AssigneeId                                                     AS AgentId,
           ISNULL(a.FullName, N'?')                                         AS AgentName,
           COUNT(*)                                                         AS Assigned,
           SUM(CASE WHEN r.ResolvedAt IS NOT NULL THEN 1 ELSE 0 END)        AS Resolved,
           AVG(CASE WHEN r.ResolvedAt IS NOT NULL
                    THEN DATEDIFF(MINUTE, r.CreatedDate, r.ResolvedAt) / 60.0 END) AS AvgResolutionHours,
           CASE WHEN SUM(CASE WHEN r.ResolvedAt IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN NULL
                ELSE 100.0 * SUM(CASE WHEN r.IsMet = 1 THEN 1 ELSE 0 END)
                           / SUM(CASE WHEN r.ResolvedAt IS NOT NULL THEN 1 ELSE 0 END) END AS SlaComplianceRate
    FROM #r r
    LEFT JOIN dbo.Sys_Account a ON a.Id = r.AssigneeId
    WHERE r.AssigneeId IS NOT NULL
    GROUP BY r.AssigneeId, a.FullName
    ORDER BY Resolved DESC, AgentName;
END
