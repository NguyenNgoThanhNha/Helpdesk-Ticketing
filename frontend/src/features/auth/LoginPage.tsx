import { Alert, Button, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { getErrorMessage, getStatus } from '@/api/errors';
import { useAuthStore } from '@/stores/authStore';
import { FormField } from '@/components/FormField';
import { AuthCard } from './AuthCard';
import { loginSchema, type LoginForm } from './schemas';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const from = (location.state as { from?: string } | null)?.from;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const login = useMutation({
    mutationFn: authApi.login,
    meta: { suppressGlobalError: true },
    onSuccess: (data) => {
      setSession(data);
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    },
  });

  const errorText = login.error
    ? getStatus(login.error) === 401
      ? 'Email hoặc mật khẩu không đúng'
      : getErrorMessage(login.error)
    : null;

  return (
    <AuthCard title="Đăng nhập Helpdesk">
      {errorText && <Alert type="error" showIcon message={errorText} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={() => void handleSubmit((v) => login.mutate(v))()}>
        <FormField label="Email" error={errors.email} htmlFor="email" required>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input {...field} id="email" prefix={<MailOutlined />} autoComplete="email" placeholder="you@company.com" />
            )}
          />
        </FormField>
        <FormField label="Mật khẩu" error={errors.password} htmlFor="password" required>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input.Password {...field} id="password" prefix={<LockOutlined />} autoComplete="current-password" />
            )}
          />
        </FormField>
        <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </div>
        <Button type="primary" htmlType="submit" block loading={login.isPending}>
          Đăng nhập
        </Button>
      </Form>
      <Typography.Paragraph style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </Typography.Paragraph>
    </AuthCard>
  );
}
