import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  apiErrorSchema,
  loginRequestSchema,
  registerRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@/domain/contracts";
import { login, register, sessionQueryKey } from "@/app/session";
import { safeReturnPath } from "./return-path";

function apiMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) return parsed.data.message;
  }
  return "Something went wrong. Please try again.";
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error">{message}</small> : null;
}

export function LoginPage() {
  const search = useSearch({ from: "/login" });
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<LoginRequest>({
    email: "",
    password: "",
  });
  const [validation, setValidation] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: ({ session }) => {
      queryClient.setQueryData(sessionQueryKey, session);
      void router.navigate({
        href: safeReturnPath(search.redirect),
        replace: true,
      });
    },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = loginRequestSchema.safeParse(values);
    if (!parsed.success) {
      setValidation(
        z.flattenError(parsed.error).fieldErrors as Record<string, string>
      );
      return;
    }
    setValidation({});
    mutation.mutate(parsed.data);
  };
  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to continue collecting."
      alternate="New here?"
      linkLabel="Create an account"
      linkTo="/register"
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>
          Email
          <Input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) =>
              setValues({ ...values, email: event.target.value })
            }
            aria-invalid={Boolean(validation.email)}
          />
        </label>
        <FieldError message={validation.email} />
        <label>
          Password
          <Input
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) =>
              setValues({ ...values, password: event.target.value })
            }
            aria-invalid={Boolean(validation.password)}
          />
        </label>
        <FieldError message={validation.password} />
        {mutation.isError && (
          <p className="form-error" role="alert">
            {apiMessage(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<RegisterRequest>({
    name: "",
    email: "",
    password: "",
  });
  const [validation, setValidation] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: ({ session }) => {
      queryClient.setQueryData(sessionQueryKey, session);
      void router.navigate({ href: "/", replace: true });
    },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = registerRequestSchema.safeParse(values);
    if (!parsed.success) {
      setValidation(
        z.flattenError(parsed.error).fieldErrors as Record<string, string>
      );
      return;
    }
    setValidation({});
    mutation.mutate(parsed.data);
  };
  return (
    <AuthLayout
      title="Join the uncommon."
      subtitle="Create an account for your collection."
      alternate="Already collecting?"
      linkLabel="Sign in"
      linkTo="/login"
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label>
          Name
          <Input
            autoComplete="name"
            value={values.name}
            onChange={(event) =>
              setValues({ ...values, name: event.target.value })
            }
            aria-invalid={Boolean(validation.name)}
          />
        </label>
        <FieldError message={validation.name} />
        <label>
          Email
          <Input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) =>
              setValues({ ...values, email: event.target.value })
            }
            aria-invalid={Boolean(validation.email)}
          />
        </label>
        <FieldError message={validation.email} />
        <label>
          Password
          <Input
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) =>
              setValues({ ...values, password: event.target.value })
            }
            aria-invalid={Boolean(validation.password)}
          />
        </label>
        <FieldError message={validation.password} />
        {mutation.isError && (
          <p className="form-error" role="alert">
            {apiMessage(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({
  title,
  subtitle,
  alternate,
  linkLabel,
  linkTo,
  children,
}: {
  title: string;
  subtitle: string;
  alternate: string;
  linkLabel: string;
  linkTo: "/login" | "/register";
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow accent">NFTMKT / ACCOUNT</p>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
        <p className="auth-alternate">
          {alternate} <a href={linkTo}>{linkLabel}</a>
        </p>
      </section>
    </main>
  );
}
