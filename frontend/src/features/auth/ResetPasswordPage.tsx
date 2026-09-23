import { Alert, Button, Form, Input, Result } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { applyFieldErrors } from '@/api/errors';
import { FormField } from '@/components/FormField';
import { AuthCard } from './AuthCard';
import { resetPasswordSchema, type ResetPasswordForm } from './schemas';

const FIELDS = ['newPassword', 'email', 'token'] as const;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email, token, newPassword: '', confirmPassword: '' },
  });

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onError: (err) => {
      applyFieldErrors(err, FIELDS, setError);
    },
  });

  if (reset.isSuccess) {
    return (
      <AuthCard title="Đặt lại mật khẩu">
        <Result
          status="success"
          title="Đổi mật khẩu thành công"
          extra={
            <Link to="/login">
              <Button type="primary">Đăng nhập</Button>
            </Link>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Đặt lại mật khẩu">
      {!token && (
        <Alert
          type="warning"
          showIcon
          message="Link đặt lại mật khẩu không hợp lệ (thiếu token)."
          style={{ marginBottom: 16 }}
        />
      )}
      {errors.token && <Alert type="error" showIcon message={errors.token.message} style={{ marginBottom: 16 }} />}
      <Form
        layout="vertical"
        onFinish={() =>
          void handleSubmit((v) => reset.mutate({ email: v.email, token: v.token, newPassword: v.newPassword }))()
        }
      >
        <FormField label="Email" error={errors.email} htmlFor="email" required>
          <Controller
            name="email"
            control={control}
            render={({ field }) => <Input {...field} id="email" readOnly={!!email} />}
          />
        </FormField>
        <FormField label="Mật khẩu mới" error={errors.newPassword} htmlFor="newPassword" required>
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} id="newPassword" autoComplete="new-password" />}
          />
        </FormField>
        <FormField label="Nhập lại mật khẩu" error={errors.confirmPassword} htmlFor="confirmPassword" required>
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} id="confirmPassword" autoComplete="new-password" />}
          />
        </FormField>
        <Button type="primary" htmlType="submit" block loading={reset.isPending} disabled={!token}>
          Đặt lại mật khẩu
        </Button>
      </Form>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link to="/login">Quay lại đăng nhập</Link>
      </div>
    </AuthCard>
  );
}
