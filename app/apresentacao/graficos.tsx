// Gráficos SVG sem dependência. Dimensão interna fixa; o slide é escalado inteiro.

export const PALETA = ["#04A15C", "#0E1A15", "#9DB3A8", "#F57C00", "#00C46A", "#6C7B73"];

type Serie = { nome: string; valores: (number | null)[]; cor?: string };
type Props = {
  rotulos: string[];
  series: Serie[];
  modo?: "agrupado" | "empilhado100";
  formato?: (v: number) => string;
  referencia?: { valor: number; rotulo: string };
  largura?: number;
  altura?: number;
};

const M = { t: 24, r: 16, b: 56, l: 48 };

function Legenda({ series, y }: { series: Serie[]; y: number }) {
  let x = M.l;
  return (
    <g fontSize={13} fill="#33413A">
      {series.map((s, i) => {
        const el = (
          <g key={s.nome} transform={`translate(${x},${y})`}>
            <rect width={12} height={12} rx={2} fill={s.cor ?? PALETA[i % PALETA.length]} />
            <text x={18} y={11}>{s.nome}</text>
          </g>
        );
        x += 34 + s.nome.length * 7.5;
        return el;
      })}
    </g>
  );
}

export function Barras({ rotulos, series, modo = "agrupado", formato = (v) => String(Math.round(v)), referencia, largura = 1100, altura = 380 }: Props) {
  const w = largura - M.l - M.r, h = altura - M.t - M.b;
  const n = rotulos.length || 1;
  const banda = w / n;
  const totais = rotulos.map((_, k) => series.reduce((s, x) => s + (x.valores[k] ?? 0), 0));
  const max = modo === "empilhado100" ? 1
    : Math.max(referencia?.valor ?? 0, ...series.flatMap((s) => s.valores.map((v) => v ?? 0)), 1) * 1.15;
  const y = (v: number) => M.t + h - (v / max) * h;
  const fmt = modo === "empilhado100" ? (v: number) => `${Math.round(v * 100)}%` : formato;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height="100%" role="img">
      <line x1={M.l} x2={M.l + w} y1={M.t + h} y2={M.t + h} stroke="#E2EAE5" />
      {rotulos.map((r, k) => {
        const x0 = M.l + k * banda;
        if (modo === "empilhado100") {
          let acum = 0;
          return (
            <g key={r}>
              {series.map((s, i) => {
                const frac = totais[k] ? (s.valores[k] ?? 0) / totais[k] : 0;
                const y1 = y(acum + frac), y0 = y(acum);
                acum += frac;
                return frac > 0 ? (
                  <g key={s.nome}>
                    <rect x={x0 + banda * 0.18} width={banda * 0.64} y={y1} height={y0 - y1} fill={s.cor ?? PALETA[i % PALETA.length]} />
                    {y0 - y1 > 18 && <text x={x0 + banda / 2} y={(y0 + y1) / 2 + 5} textAnchor="middle" fontSize={12} fill={i === 1 ? "#fff" : "#13211B"}>{fmt(frac)}</text>}
                  </g>
                ) : null;
              })}
              <text x={x0 + banda / 2} y={M.t + h + 22} textAnchor="middle" fontSize={13} fill="#6C7B73">{r}</text>
            </g>
          );
        }
        const bw = (banda * 0.7) / series.length;
        return (
          <g key={r}>
            {series.map((s, i) => {
              const v = s.valores[k];
              if (v == null) return null;
              const bx = x0 + banda * 0.15 + i * bw;
              return (
                <g key={s.nome}>
                  <rect x={bx} width={bw * 0.9} y={y(v)} height={M.t + h - y(v)} rx={3} fill={s.cor ?? PALETA[i % PALETA.length]} />
                  <text x={bx + bw * 0.45} y={y(v) - 6} textAnchor="middle" fontSize={12} fill="#13211B">{fmt(v)}</text>
                </g>
              );
            })}
            <text x={x0 + banda / 2} y={M.t + h + 22} textAnchor="middle" fontSize={13} fill="#6C7B73">{r}</text>
          </g>
        );
      })}
      {referencia && (
        <g>
          <line x1={M.l} x2={M.l + w} y1={y(referencia.valor)} y2={y(referencia.valor)} stroke="#F57C00" strokeDasharray="6 4" />
          <text x={M.l + w} y={y(referencia.valor) - 6} textAnchor="end" fontSize={12} fill="#F57C00">{referencia.rotulo}</text>
        </g>
      )}
      <Legenda series={series} y={altura - 18} />
    </svg>
  );
}

export function Linhas({ rotulos, series, formato = (v) => String(v), largura = 1100, altura = 380 }: Props) {
  const w = largura - M.l - M.r, h = altura - M.t - M.b;
  const passo = rotulos.length > 1 ? w / (rotulos.length - 1) : 0;
  const max = Math.max(...series.flatMap((s) => s.valores.map((v) => v ?? 0)), 1) * 1.2;
  const x = (k: number) => M.l + (rotulos.length > 1 ? k * passo : w / 2);
  const y = (v: number) => M.t + h - (v / max) * h;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height="100%" role="img">
      <line x1={M.l} x2={M.l + w} y1={M.t + h} y2={M.t + h} stroke="#E2EAE5" />
      {series.map((s, i) => {
        const cor = s.cor ?? PALETA[i % PALETA.length];
        const pts = s.valores.map((v, k) => (v == null ? null : [x(k), y(v), v] as const)).filter((p) => p !== null);
        return (
          <g key={s.nome}>
            <polyline fill="none" stroke={cor} strokeWidth={3} points={pts.map(([a, b]) => `${a},${b}`).join(" ")} />
            {pts.map(([a, b, v], k) => (
              <g key={k}>
                <circle cx={a} cy={b} r={4.5} fill={cor} />
                <text x={a} y={b - 10} textAnchor="middle" fontSize={12} fill="#13211B">{formato(v)}</text>
              </g>
            ))}
          </g>
        );
      })}
      {rotulos.map((r, k) => (
        <text key={r + k} x={x(k)} y={M.t + h + 22} textAnchor="middle" fontSize={13} fill="#6C7B73">{r}</text>
      ))}
      <Legenda series={series} y={altura - 18} />
    </svg>
  );
}
