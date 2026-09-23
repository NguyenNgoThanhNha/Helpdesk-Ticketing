import { useEffect, useState, type ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import relativeTime from 'dayjs/plugin/relativeTime';
import { setErrorNotifier } from '@/api/errors';
import { createQueryClient } from '@/api/queryClient';

dayjs.extend(relativeTime);
dayjs.locale('vi');

/** Connects antd's context-aware `message` API to non-React code (axios / query cache). */
function AntdBridge() {
  const { message } = AntdApp.useApp();
  useEffect(() => {
    setErrorNotifier((content) => {
      void message.error(content);
    });
  }, [message]);
  return null;
}

export function AppProviders({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <AntdApp>
        <AntdBridge />
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
