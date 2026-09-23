import type { ReactNode } from 'react';
import { Form } from 'antd';
import type { FieldError } from 'react-hook-form';

/** antd Form.Item displaying an RHF field error. */
export function FormField({
  label,
  error,
  required,
  children,
  htmlFor,
  style,
}: {
  label: ReactNode;
  error?: Pick<FieldError, 'message'>;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Form.Item
      label={label}
      required={required}
      htmlFor={htmlFor}
      validateStatus={error ? 'error' : undefined}
      help={error?.message}
      style={style}
    >
      {children}
    </Form.Item>
  );
}
