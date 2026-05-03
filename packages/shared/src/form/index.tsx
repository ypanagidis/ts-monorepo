import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@acme/ui/field";
import { Input } from "@acme/ui/input";
import { Textarea } from "@acme/ui/textarea";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

function getFieldErrorMessages(errors: unknown[]) {
  return errors.flatMap((error) => {
    if (!error) {
      return [];
    }

    if (typeof error === "string") {
      return [{ message: error }];
    }

    if (error instanceof Error) {
      return [{ message: error.message }];
    }

    if (typeof error === "object" && "message" in error) {
      const message = error.message;

      if (typeof message === "string" && message.length > 0) {
        return [{ message }];
      }
    }

    return [{ message: "Invalid value" }];
  });
}

type TextFieldProps = Omit<
  React.ComponentProps<typeof Input>,
  "id" | "name"
> & {
  label: string;
  description?: React.ReactNode;
  fieldClassName?: string;
};

export function TextField({
  label,
  description,
  fieldClassName,
  onChange,
  onBlur,
  ...props
}: TextFieldProps) {
  const field = useFieldContext<string | null>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field className={fieldClassName} data-invalid={isInvalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={(event) => {
          field.handleBlur();
          onBlur?.(event);
        }}
        onChange={(event) => {
          field.handleChange(
            event.target.value === "" ? null : event.target.value,
          );
          onChange?.(event);
        }}
        aria-invalid={isInvalid}
        {...props}
      />
      {isInvalid ? (
        <FieldError errors={getFieldErrorMessages(field.state.meta.errors)} />
      ) : null}
    </Field>
  );
}

type TextareaFieldProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "id" | "name"
> & {
  label: string;
  description?: React.ReactNode;
  fieldClassName?: string;
};

export function TextareaField({
  label,
  description,
  fieldClassName,
  onChange,
  onBlur,
  ...props
}: TextareaFieldProps) {
  const field = useFieldContext<string | null>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <Field className={fieldClassName} data-invalid={isInvalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={(event) => {
          field.handleBlur();
          onBlur?.(event);
        }}
        onChange={(event) => {
          field.handleChange(
            event.target.value === "" ? null : event.target.value,
          );
          onChange?.(event);
        }}
        aria-invalid={isInvalid}
        {...props}
      />
      {isInvalid ? (
        <FieldError errors={getFieldErrorMessages(field.state.meta.errors)} />
      ) : null}
    </Field>
  );
}

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: React.ReactNode;
};

export function SubmitButton({
  children = "Submit",
  disabled,
  pendingLabel,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type={type} disabled={disabled || isSubmitting} {...props}>
          {isSubmitting ? (pendingLabel ?? children) : children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export function ResetButton({
  children = "Clear",
  onClick,
  type = "button",
  variant = "outline",
  ...props
}: React.ComponentProps<typeof Button>) {
  const form = useFormContext();

  return (
    <Button
      type={type}
      variant={variant}
      onClick={(event) => {
        form.reset();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

export function FormActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export const { useAppForm, useTypedAppFormContext, withFieldGroup, withForm } =
  createFormHook({
    fieldContext,
    formContext,
    fieldComponents: {
      TextareaField,
      TextField,
    },
    formComponents: {
      FormActions,
      ResetButton,
      SubmitButton,
    },
  });
