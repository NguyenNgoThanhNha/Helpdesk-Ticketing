import { Button, Form, Input, Result } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { FormField } from '@/components/FormField';
import { AuthCard } from './AuthCard';
import { forgotPasswordSchema, type ForgotPasswordForm } from './schemas';

export function ForgotPasswordPage() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const forgot = useMutation({ mutationFn: authApi.forgotPassword });

  if (forgot.isSuccess) {
    return (
      <AuthCard title="Quên mật khẩu">
        <Result
          status="success"
          title="Đã gửi yêu cầu"
          subTitle="Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link đặt lại mật khẩu."
          extra={<Link to="/login">Quay lại đăng nhập</Link>}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Quên mật khẩu">
      <Form layout="vertical" onFinish={() => void handleSubmit((v) => forgot.mutate(v.email))()}>
        <FormField label="Email" error={errors.email} htmlFor="email" required>
          <Controller name="email" control={control} render={({ field }) => <Input {...field} id="email" />} />
        </FormField>
        <Button type="primary" htmlType="submit" block loading={forgot.isPending}>
          Gửi link đặt lại mật khẩu
        </Button>
      </Form>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link to="/login">Quay lại đăng nhập</Link>
      </div>
    </AuthCard>
  );
}
