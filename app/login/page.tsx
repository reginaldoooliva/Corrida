"use client";

// SPEC_DEVIATION: tasks.md plans a Server Action (`app/login/actions.ts`) calling NextAuth's signIn.
// Reason: next-auth v4 (installed) only exposes `signIn` client-side, from `next-auth/react`; a
// Server Action could only sign in by hand-encoding the session cookie, which AD-002 rules out.
// The form calls that client `signIn`, which posts to the Credentials Provider wired in T6.

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const field = { display: "grid", gap: 4 } as const;
const input = { padding: "8px 10px", fontSize: 16 } as const;

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
    <main style={{ maxWidth: 360, margin: "15vh auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Entrar</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <label style={field}>
          Usuário
          <input name="username" autoComplete="username" required style={input} />
        </label>
        <label style={field}>
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={input}
          />
        </label>
        {error && (
          <p role="alert" style={{ color: "#b00020", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} style={{ padding: "10px 12px", fontSize: 16 }}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
