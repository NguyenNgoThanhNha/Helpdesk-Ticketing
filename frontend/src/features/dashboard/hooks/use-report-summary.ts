import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { reportsApi, type ReportRange } from '../api/reports-api';

export function useReportSummary(range: ReportRange) {
  return useQuery({
    queryKey: queryKeys.reportSummary(range),
    queryFn: () => reportsApi.summary(range),
    placeholderData: keepPreviousData,
  });
}
