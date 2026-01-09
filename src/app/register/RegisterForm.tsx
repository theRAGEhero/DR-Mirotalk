"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  initialCode: string;
  registrationOpen: boolean;
  requireCode: boolean;
};

export function RegisterForm({ initialCode, registrationOpen, requireCode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword, code })
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

    if (data?.verificationRequired) {
      setSuccess(
        data?.emailSent
          ? "Account created. Check your email to activate your account."
          : "Account created, but confirmation email was not sent. Contact support."
      );
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
      {!registrationOpen ? (
        <p className="text-sm text-amber-700">
          Registration is currently closed.
        </p>
      ) : null}
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
      {requireCode ? (
        <div>
          <label className="text-sm font-medium">Registration code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            required
          />
        </div>
      ) : code ? (
        <div>
          <label className="text-sm font-medium">Registration code (optional)</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <button
        type="submit"
        className="dr-button w-full px-4 py-2 text-sm"
        disabled={loading || !registrationOpen}
      >
        {loading ? "Creating..." : "Create account"}
      </button>
      <p className="text-center text-xs text-slate-600">
        Already have an account? <Link href="/login" className="font-semibold">Sign in</Link>
      </p>
    </form>
  );
}
