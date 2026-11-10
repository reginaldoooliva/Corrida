"use client";

// SPEC_DEVIATION: tasks.md plans a Server Action (`app/login/actions.ts`) calling NextAuth's signIn.
// Reason: next-auth v4 (installed) only exposes `signIn` client-side, from `next-auth/react`; a
// Server Action could only sign in by hand-encoding the session cookie, which AD-002 rules out.
// The form calls that client `signIn`, which posts to the Credentials Provider wired in T6.

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RunIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    if (result?.ok) {
      router.replace("/dashboard");
      return;
    }
    // Spec AUTH-02: one generic message, never which field was wrong.
    setError("Credenciais inválidas.");
    setPending(false);
  }

  return (
    <main className="page page--center" style={{ maxWidth: 400 }}>
      <header className="stack" style={{ gap: 8 }}>
        <span className="brand">
          <RunIcon size={28} /> Corrida
        </span>
        <p>Seu coach de corrida: planilha periodizada que se ajusta ao que você realmente correu.</p>
      </header>
      <section className="card stack-lg" style={{ padding: 24 }}>
        <h1>Entrar</h1>
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            Usuário
            <input name="username" autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="field">
            Senha
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn-block">
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
