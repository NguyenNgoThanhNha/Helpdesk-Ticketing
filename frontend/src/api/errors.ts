import axios from 'axios';
import type { ProblemDetails } from '@/types';

type MessageFn = (content: string) => void;

let errorNotifier: MessageFn = (content) => {
  console.error(content);
};

/** Registered by <AntdBridge/> inside antd <App> so non-React code can show messages. */
export function setErrorNotifier(fn: MessageFn) {
  errorNotifier = fn;
}

export function getProblem(error: unknown): ProblemDetails | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as unknown;
    if (data && typeof data === 'object' && !(data instanceof Blob)) {
      return data as ProblemDetails;
    }
  }
  return undefined;
}

export function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function getErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi, vui lòng thử lại'): string {
  const problem = getProblem(error);
  if (problem) {
    if (problem.detail && problem.title) return `${problem.title}: ${problem.detail}`;
    if (problem.detail) return problem.detail;
    if (problem.errors) {
      const first = Object.values(problem.errors).flat()[0];
      if (first) return first;
    }
    if (problem.title) return problem.title;
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) return 'Bạn không có quyền thực hiện thao tác này';
    if (status === 404) return 'Không tìm thấy dữ liệu';
    if (!error.response) return 'Không kết nối được máy chủ';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function showError(error: unknown, fallback?: string) {
  errorNotifier(getErrorMessage(error, fallback));
}

/**
 * Maps ProblemDetails.errors (camelCase keys) to a setError callback (e.g. RHF setError).
 * Returns true when at least one field error was applied.
 */
export function applyFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: (field: TField, err: { type: string; message: string }) => void,
): boolean {
  const problem = getProblem(error);
  if (!problem?.errors) return false;
  let applied = false;
  for (const [key, messages] of Object.entries(problem.errors)) {
    const normalized = key.length ? key[0].toLowerCase() + key.slice(1) : key;
    const field = fields.find((f) => f === normalized);
    if (field && messages.length) {
      setError(field, { type: 'server', message: messages.join(' ') });
      applied = true;
    }
  }
  return applied;
}
