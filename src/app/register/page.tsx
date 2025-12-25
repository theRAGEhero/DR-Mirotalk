import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RegisterForm } from "@/app/register/RegisterForm";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="dr-card mx-auto mt-16 w-full max-w-md p-6">
      <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
        Create account
      </h1>
      <p className="mt-1 text-sm text-slate-500">Join the platform with your email.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  );
}
