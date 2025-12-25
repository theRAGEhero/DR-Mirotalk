"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword })
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch (jsonError) {
      data = null;
    }
    if (!response.ok) {
      const message = data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to register";
      setError(message);
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      redirect: false,
      email,
      password
    });

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
        <p className="mt-1 text-xs text-slate-500">Minimum 12 characters, 1 letter, 1 number.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Confirm password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        className="dr-button w-full px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create account"}
      </button>
      <p className="text-center text-xs text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold">Sign in</Link>
      </p>
    </form>
  );
}
