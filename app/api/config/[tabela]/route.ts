// CRUD simples das configurações: expedientes, feriados, pessoas, alocações e ausências.
import { db } from "@/lib/db";
import { FERIADOS_2026 } from "@/config/feriados-2026";

type Ctx = { params: Promise<{ tabela: string }> };
const erro = (msg: string, status = 400) => Response.json({ erro: msg }, { status });

export async function GET(_: Request, { params }: Ctx) {
  const sql = db();
  switch ((await params).tabela) {
    case "expedientes":
      return Response.json(await sql`select valido_de::text, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from expedientes order by valido_de`);
    case "feriados":
      return Response.json(await sql`select data::text, nome, abrangencia from feriados order by data`);
    case "pessoas":
      return Response.json(await sql`
        select p.id, p.nome, coalesce(json_agg(json_build_object('id', a.id, 'time', a.time, 'frente', a.frente, 'cargo', a.cargo,
          'percentual', a.percentual, 'inicio', a.inicio::text, 'fim', a.fim::text) order by a.inicio) filter (where a.id is not null), '[]') as alocacoes
        from pessoas p left join alocacoes a on a.pessoa_id = p.id group by p.id order by p.nome`);
    case "ausencias":
      return Response.json(await sql`select a.id, a.pessoa_id, p.nome, a.inicio::text, a.fim::text, a.tipo from ausencias a join pessoas p on p.id = a.pessoa_id order by a.inicio desc`);
    default:
      return erro("tabela desconhecida", 404);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const sql = db();
  const b = await req.json().catch(() => ({}));
  switch ((await params).tabela) {
    case "expedientes":
      if (!b.valido_de || !b.inicio || !b.fim || b.fim <= b.inicio) return erro("informe vigência, início e fim (fim depois do início)");
      await sql`insert into expedientes values (${b.valido_de}, ${b.inicio}, ${b.fim}) on conflict (valido_de) do update set inicio = excluded.inicio, fim = excluded.fim`;
      break;
    case "feriados":
      if (b.carregar === "2026") {
        await sql.transaction(FERIADOS_2026.map(([d, n, a]) => sql`insert into feriados values (${d}, ${n}, ${a}) on conflict do nothing`));
        break;
      }
      if (!b.data || !b.nome || !b.abrangencia) return erro("informe data, nome e abrangência");
      await sql`insert into feriados values (${b.data}, ${b.nome}, ${b.abrangencia}) on conflict (data) do update set nome = excluded.nome, abrangencia = excluded.abrangencia`;
      break;
    case "pessoas": {
      // Nova pessoa e/ou nova alocação. Mudar de time = encerrar a alocação atual e criar outra.
      if (!b.nome?.trim()) return erro("informe o nome");
      const [p] = (await sql`insert into pessoas (nome) values (${b.nome.trim()}) on conflict (nome) do update set nome = excluded.nome returning id`) as { id: number }[];
      if (b.time && b.cargo && b.inicio) {
        await sql`insert into alocacoes (pessoa_id, time, frente, cargo, percentual, inicio, fim)
          values (${p.id}, ${b.time}, ${b.frente ?? ""}, ${b.cargo}, ${b.percentual ?? 1}, ${b.inicio}, ${b.fim || null})`;
      }
      break;
    }
    case "alocacoes":
      if (!b.id || !b.fim) return erro("informe a alocação e a data de saída");
      await sql`update alocacoes set fim = ${b.fim} where id = ${b.id}`;
      break;
    case "ausencias":
      if (!b.pessoa_id || !b.inicio || !b.fim || b.fim < b.inicio) return erro("informe pessoa, início e fim");
      await sql`insert into ausencias (pessoa_id, inicio, fim, tipo) values (${b.pessoa_id}, ${b.inicio}, ${b.fim}, ${b.tipo || "Férias"})`;
      break;
    default:
      return erro("tabela desconhecida", 404);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const sql = db();
  const chave = new URL(req.url).searchParams.get("chave") ?? "";
  switch ((await params).tabela) {
    case "expedientes": await sql`delete from expedientes where valido_de = ${chave}`; break;
    case "feriados": await sql`delete from feriados where data = ${chave}`; break;
    case "alocacoes": await sql`delete from alocacoes where id = ${Number(chave)}`; break;
    case "ausencias": await sql`delete from ausencias where id = ${Number(chave)}`; break;
    case "pessoas": await sql`delete from pessoas where id = ${Number(chave)}`; break;
    default: return erro("tabela desconhecida", 404);
  }
  return Response.json({ ok: true });
}
