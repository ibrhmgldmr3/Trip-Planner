import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Google sağlayıcısı YALNIZCA kimlik bilgileri tanımlıysa kayda giriyor.
 *
 * Eskiden `clientId: process.env.GOOGLE_CLIENT_ID!` yazıyordu. `!` yalnızca
 * TypeScript'i susturur; değer tanımsızsa provider yine de kaydolur, giriş
 * ekranında "Google ile giriş" butonu görünür ve tıklayan kullanıcı
 * OAuth sağlayıcısından anlamsız bir hata alır. Env boşken butonu hiç
 * göstermemek daha dürüst bir davranış.
 */
function googleSaglayicisi(): Provider[] {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) return [];

  return [GoogleProvider({ clientId, clientSecret })];
}

/**
 * Kullanıcı bulunamadığında karşılaştırılan sahte hash.
 *
 * Amaç zaman saldırısıyla kullanıcı numaralandırmayı engellemek: kayıtlı
 * olmayan bir e-posta için de bcrypt maliyeti ödenir, böylece yanıt süresi
 * ayırt edici olmaz. Maliyet faktörü (12) gerçek hash'lerle aynı olmalı.
 *
 * DİKKAT: burada GEÇERLİ bir bcrypt hash'i durmak zorunda. Önceki değer
 * ("$2a$12$invalidinvalid...") geçerli bir salt taşımadığı için bcryptjs
 * karşılaştırmayı hiç yapmadan false dönüyordu: ölçümde kayıtsız e-posta
 * 0.002 ms, kayıtlı e-posta 216 ms sürüyordu. Yani koruma tam tersine
 * kusursuz bir numaralandırma kanalı açıyordu.
 */
const SAHTE_HASH = "$2b$12$qY.nKPmqPrVWSaBP8m7Ye.PBdgDTDrnf2GLpMtKmePIqsBgBAiNj6";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    ...googleSaglayicisi(),
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
        const passwordHash = user?.password ?? SAHTE_HASH;

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
    async jwt({ token, user }) {
      // İlk girişte kullanıcı objesi geliyor; sonraki isteklerde token'daki
      // değer korunuyor. `sub` NextAuth tarafından zaten dolduruluyor ama
      // ikisini de yazıp session tarafında yedekli okuyoruz.
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // DİKKAT: `session.user.id` aşağı akıştaki tüm sahiplik kontrollerinin
      // girdisi. Boş bırakılırsa Prisma `where`inde `undefined` olur ve
      // filtre sessizce düşer. Bu yüzden değer yoksa oturumu kimliksiz
      // döndürüyoruz — route'lar `requireUser()` ile e-postadan çözüyor.
      const id = (typeof token.id === "string" && token.id) || token.sub;
      if (session.user && typeof id === "string" && id.length > 0) {
        session.user.id = id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
