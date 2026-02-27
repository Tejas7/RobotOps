"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { RobotOpsLogo } from "@/components/brand/robotops-logo";

export default function LoginPage() {
  const callbackUrl = "/overview";
  const [email, setEmail] = useState("owner@demo.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl
    });

    if (result?.error) {
      setError("Invalid credentials. Try ops@demo.com / password123.");
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <RobotOpsLogo iconSize={64} titleClassName="text-4xl" className="mb-8 self-center" />
      <div className="w-full rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Use seeded credentials to access the demo tenant.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input
              className="w-full rounded-2xl border border-border bg-white px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">Password</label>
            <input
              className="w-full rounded-2xl border border-border bg-white px-3 py-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-border bg-white p-3 text-xs text-muted">
          <p>Seed users:</p>
          <p>`owner@demo.com` / `password123`</p>
          <p>`ops@demo.com` / `password123`</p>
          <p>`engineer@demo.com` / `password123`</p>
        </div>
      </div>
    </main>
  );
}
