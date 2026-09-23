import { api, cleanParams } from '@/lib/api-client';
import type { ReportSummaryDto } from '@/types';

export interface ReportRange {
  /** yyyy-MM-dd */
  from?: string;
  /** yyyy-MM-dd */
  to?: string;
}

export const reportsApi = {
  summary: (params: ReportRange) =>
    api.get<ReportSummaryDto>('/reports/summary', { params: cleanParams(params) }).then((r) => r.data),
};
