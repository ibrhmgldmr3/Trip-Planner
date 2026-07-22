import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Lütfen e-posta ve şifre giriniz");
        }

        const email = credentials.email.trim().toLowerCase();

        // Deneme sayısını e-posta bazında sınırla (parola deneme saldırısı).
        const quota = rateLimit(`login:${email}`, 10, 15 * 60 * 1000);
        if (!quota.success) {
          throw new Error(
            "Çok fazla başarısız giriş denemesi. Lütfen biraz sonra tekrar deneyin"
          );
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // "Kullanıcı yok" ile "şifre yanlış" ayrımı yapmıyoruz; ayrım
        // saldırgana hangi e-postaların kayıtlı olduğunu söyler.
        // Kullanıcı yoksa da bcrypt karşılaştırması yaparak yanıt süresini
        // sabit tutuyoruz (timing üzerinden numaralandırma).
        const passwordHash =
          user?.password ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          passwordHash
        );

        if (!user?.password || !isPasswordValid) {
          throw new Error("E-posta veya şifre hatalı");
        }

        return user;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login", // Error code passed in query string as ?error=
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
