"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  hasCredentials: boolean;
}

export function LoginForm({ hasCredentials }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid username or password");
      } else {
        router.push("/chat");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasCredentials) {
    return (
      <div className="text-center text-sm text-red-400 border border-red-900/50 rounded-lg p-4">
        No authentication provider configured.
        <br />
        Set <code className="font-mono text-xs">USERS</code> in your environment.
      </div>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-3">
      <div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          autoComplete="username"
          className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete="current-password"
          className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
