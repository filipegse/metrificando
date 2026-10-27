// Proteção provisória por senha (HTTP Basic) até o login com Google Workspace.
// Ativa só quando APP_USUARIO e APP_SENHA estão definidos. O webhook tem o próprio token.
import { NextResponse, type NextRequest } from "next/server";

/** Respostas da API nunca ficam em cache (evita listas desatualizadas depois de salvar). */
function seguir(req: NextRequest) {
  const r = NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    r.headers.set("Cache-Control", "no-store, max-age=0");
    r.headers.set("Netlify-CDN-Cache-Control", "no-store");
  }
  return r;
}

export function proxy(req: NextRequest) {
  const { APP_USUARIO, APP_SENHA } = process.env;
  if (!APP_USUARIO || !APP_SENHA) return seguir(req);
  // Webhooks (automações do Jira) não mandam a senha do site: a própria função valida o X-Webhook-Token.
  if (req.nextUrl.pathname.startsWith("/api/webhooks/")) return seguir(req);
  const [tipo, valor] = (req.headers.get("authorization") ?? "").split(" ");
  if (tipo === "Basic" && valor && atob(valor) === `${APP_USUARIO}:${APP_SENHA}`) return seguir(req);
  return new NextResponse("Autenticação necessária", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Metrificando"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.netlify/).*)"] };
