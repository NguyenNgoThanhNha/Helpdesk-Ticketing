import { Navigate } from 'react-router-dom';
import { useCan } from '@/stores/authStore';

export function HomeRedirect() {
  const canReport = useCan('REPORT', 'R');
  return <Navigate to={canReport ? '/dashboard' : '/tickets'} replace />;
}
