import { Alert, Button, Form, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { applyFieldErrors, getErrorMessage, getStatus } from '@/api/errors';
import { useAuthStore } from '@/stores/authStore';
import { FormField } from '@/components/FormField';
import { AuthCard } from './AuthCard';
import { registerSchema, type RegisterForm } from './schemas';

const FIELDS = ['fullName', 'email', 'password'] as const;

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const register = useMutation({
    mutationFn: authApi.register,
    meta: { suppressGlobalError: true },
    onSuccess: (data) => {
      setSession(data);
      navigate('/', { replace: true });
    },
    onError: (err) => {
      if (getStatus(err) === 409) {
        setError('email', { type: 'server', message: 'Email đã được sử dụng' });
        return;
      }
      applyFieldErrors(err, FIELDS, setError);
    },
  });

  const showAlert = !!register.error && getStatus(register.error) !== 409 && !Object.keys(errors).length;

  return (
    <AuthCard title="Đăng ký tài khoản">
      {showAlert && <Alert type="error" showIcon message={getErrorMessage(register.error)} style={{ marginBottom: 16 }} />}
      <Form
        layout="vertical"
        onFinish={() =>
          void handleSubmit(({ fullName, email, password }) => register.mutate({ fullName, email, password }))()
        }
      >
        <FormField label="Họ tên" error={errors.fullName} htmlFor="fullName" required>
          <Controller name="fullName" control={control} render={({ field }) => <Input {...field} id="fullName" />} />
        </FormField>
        <FormField label="Email" error={errors.email} htmlFor="email" required>
          <Controller
            name="email"
            control={control}
            render={({ field }) => <Input {...field} id="email" autoComplete="email" />}
          />
        </FormField>
        <FormField label="Mật khẩu" error={errors.password} htmlFor="password" required>
          <Controller
            name="password"
            control={control}
            render={({ field }) => <Input.Password {...field} id="password" autoComplete="new-password" />}
          />
        </FormField>
        <FormField label="Nhập lại mật khẩu" error={errors.confirmPassword} htmlFor="confirmPassword" required>
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} id="confirmPassword" autoComplete="new-password" />}
          />
        </FormField>
        <Button type="primary" htmlType="submit" block loading={register.isPending}>
          Đăng ký
        </Button>
      </Form>
      <Typography.Paragraph style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </Typography.Paragraph>
    </AuthCard>
  );
}
