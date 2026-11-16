import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "./rate-limit";

const LOGIN_ERROR = "E-posta veya şifre hatalı";

// Kullanıcı bulunamadığında da bir karşılaştırma yapılır; böylece yanıt süresi
// hesabın var olup olmadığını ele vermez.
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8n1xJkSgkHh0xJYp1r0YkN8nG1yXhK";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "E-posta", type: "email" },
      password: { label: "Şifre", type: "password" },
    },
    async authorize(credentials, request) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) throw new Error(LOGIN_ERROR);

      const ip = clientIp((request?.headers ?? {}) as Record<string, string | string[] | undefined>);
      const limited = rateLimit(`login:${ip}:${email}`, 10, 15 * 60 * 1000);
      // x-forwarded-for istemci tarafından yazılabilir; IP değiştirerek tek hesaba
      // sınırsız şifre denenmesin diye hesap başına da bir üst sınır vardır.
      const perAccount = rateLimit(`login:${email}`, 30, 15 * 60 * 1000);
      if (!limited.ok || !perAccount.ok) {
        throw new Error("Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.");
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });

      const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
      if (!user || !user.password || !valid) throw new Error(LOGIN_ERROR);

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Google ile giriş yalnızca anahtarları tanımlıysa sunulur.
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
      }
      // Profil güncellendiğinde (useSession().update) adı veritabanından tazele;
      // istemcinin gönderdiği veriye güvenilmez.
      if (trigger === "update" && token.sub) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true },
        });
        if (fresh) token.name = fresh.name;
      }
      return token;
    },
  },
  secret: env.NEXTAUTH_SECRET,
};
