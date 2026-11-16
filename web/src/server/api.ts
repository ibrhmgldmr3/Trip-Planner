import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z, ZodError } from "zod";
import { authOptions } from "./auth";

/** İstemciye güvenle gösterilebilecek, durum kodu taşıyan hata. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const jsonError = (status: number, message: string, headers?: Record<string, string>) =>
  NextResponse.json({ error: message }, { status, headers });

/** Oturumdaki kullanıcının kimliğini verir; oturum yoksa 401 fırlatır. */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, "Bu işlem için giriş yapmalısın.");
  return id;
}

/** İstek gövdesini JSON olarak okur ve şemayla doğrular. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "İstek gövdesi geçerli JSON değil.");
  }
  return schema.parse(raw);
}

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (request: Request, params: P) => Promise<Response>;

/**
 * Rota işleyicilerini sarar: beklenen hatalar anlamlı durum kodlarına çevrilir,
 * beklenmeyenler sunucuda loglanır ve istemciye ayrıntı sızdırmadan 500 döner.
 */
export function route<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context: RouteContext<P>): Promise<Response> => {
    try {
      const params = context?.params ? await context.params : ({} as P);
      return await handler(request, params);
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonError(error.status, error.message, error.headers);
      }
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return jsonError(400, issue?.message || "Gönderilen veri geçersiz.");
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, error);
      return jsonError(500, "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.");
    }
  };
}
