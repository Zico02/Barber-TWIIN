"use client";
import { useState, useTransition } from "react";
import { LogIn, Crown, Scissors, ConciergeBell } from "lucide-react";
import { demoLoginAction, loginAction } from "@/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { Field, Spinner } from "@/components/ui";
import type { Role } from "@/lib/domain/types";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await loginAction({ email, password, next });
          if (res && !res.ok) setError(res.message);
        });
      }}
    >
      <Field label={t.common.email} htmlFor="lg-email">
        <input id="lg-email" type="email" autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t.login.password} htmlFor="lg-pass">
        <input id="lg-pass" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      <button className="btn-gold w-full" disabled={pending}>
        {pending ? <Spinner className="border-ink/30 border-t-ink" /> : <LogIn className="h-4 w-4" />} {t.login.submit}
      </button>
    </form>
  );
}

const ICON: Record<Role, React.ReactNode> = {
  owner: <Crown className="h-4 w-4" />,
  barber: <Scissors className="h-4 w-4" />,
  receptionist: <ConciergeBell className="h-4 w-4" />,
  customer: null,
};

export function DemoLogin({ users, next, title, text }: { users: { id: string; label: string; role: Role }[]; next?: string; title: string; text: string }) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  return (
    <div>
      <p className="eyebrow text-center">{title}</p>
      <p className="mt-2 text-center text-sm text-ivory-muted">{text}</p>
      <ul className="mt-6 space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <button
              disabled={pending}
              onClick={() => {
                setWhich(u.id);
                start(() => demoLoginAction(u.id, next));
              }}
              className="flex w-full items-center gap-3 rounded border border-hair px-4 py-3 text-start text-sm transition hover:border-gold hover:bg-gold/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-gold">{ICON[u.role]}</span>
              <span className="flex-1">{u.label}</span>
              {pending && which === u.id && <Spinner />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
