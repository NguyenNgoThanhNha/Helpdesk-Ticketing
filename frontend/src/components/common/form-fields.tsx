import type { ComponentProps, ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  description?: ReactNode;
}

/** Adds a red asterisk via CSS (keeps the label's accessible name clean). */
export const REQUIRED_LABEL_CLASS = "after:ml-0.5 after:text-destructive after:content-['*']";

/** RHF-bound text input with label, description and error message (shadcn Form). */
export function TextFormField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  ...inputProps
}: BaseFieldProps<T> & Omit<ComponentProps<typeof Input>, 'name' | 'value' | 'onChange' | 'onBlur'>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? REQUIRED_LABEL_CLASS : undefined}>{label}</FormLabel>
          <FormControl>
            <Input {...inputProps} {...field} value={field.value ?? ''} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** RHF-bound textarea with an optional character counter. */
export function TextareaFormField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  maxLength,
  ...textareaProps
}: BaseFieldProps<T> & Omit<ComponentProps<typeof Textarea>, 'name' | 'value' | 'onChange' | 'onBlur'>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? REQUIRED_LABEL_CLASS : undefined}>{label}</FormLabel>
          <FormControl>
            <Textarea {...textareaProps} {...field} value={field.value ?? ''} />
          </FormControl>
          <div className="flex justify-between gap-2">
            <div>
              {description && <FormDescription>{description}</FormDescription>}
              <FormMessage />
            </div>
            {maxLength && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {String(field.value ?? '').length}/{maxLength}
              </span>
            )}
          </div>
        </FormItem>
      )}
    />
  );
}
