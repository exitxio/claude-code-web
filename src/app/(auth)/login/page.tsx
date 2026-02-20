import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/chat");
  }

  const hasCredentials = !!process.env.USERS;
  const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">Claude Code Web</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to continue</p>
        </div>
        <LoginForm hasCredentials={hasCredentials} hasGoogle={hasGoogle} />
      </div>
    </div>
  );
}
