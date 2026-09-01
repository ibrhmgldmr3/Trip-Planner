import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * JWT'nin `sub` alanından geliyor; her koşulda dolu OLMAYABİLİR
       * (bayat token, bozulmuş oturum). Bilinçli olarak opsiyonel:
       * `as string` ile zorlanınca Prisma `where`inde `undefined`a dönüşüp
       * sahiplik filtresini sessizce düşürüyordu. Sunucu tarafında doğrudan
       * kullanmak yerine `requireUser()` (src/lib/auth-session.ts) kullanın.
       */
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
