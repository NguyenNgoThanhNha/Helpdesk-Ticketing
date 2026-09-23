import { Button, Result } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import { useCanAny, type PermissionRequirement } from '@/stores/authStore';

/** Renders child routes only when the user has at least one of the required permissions. */
export function PermissionRoute({ anyOf }: { anyOf: readonly PermissionRequirement[] }) {
  const allowed = useCanAny(anyOf);
  const navigate = useNavigate();
  if (!allowed) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Bạn không có quyền truy cập trang này."
        extra={
          <Button type="primary" onClick={() => navigate('/tickets')}>
            Về danh sách ticket
          </Button>
        }
      />
    );
  }
  return <Outlet />;
}
