import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "crypto";

// Parse USERS="username:password,user2:pass2" format
function parseUsers(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.USERS || "";
  for (const pair of raw.split(",")) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) continue;
    const username = pair.slice(0, colonIdx).trim();
    const password = pair.slice(colonIdx + 1).trim();
    if (username && password) map.set(username, password);
  }
  return map;
}

const providers: NextAuthOptions["providers"] = [];

// Credentials-based accounts (enabled when USERS is set)
if (process.env.USERS) {
  providers.push(
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const users = parseUsers();
        const storedPassword = users.get(credentials.username);
        if (!storedPassword) return null;
        // timing-safe comparison
        const inputBuf = Buffer.from(credentials.password);
        const storedBuf = Buffer.from(storedPassword);
        if (
          inputBuf.length !== storedBuf.length ||
          !crypto.timingSafeEqual(inputBuf, storedBuf)
        ) {
          return null;
        }
        return { id: credentials.username, name: credentials.username, email: `${credentials.username}@local` };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
