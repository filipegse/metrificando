// Calendário padrão de feriados e folgas da TAP para qualquer ano (base: vault, 07-prompts/relatorio-diario-sprint-slack.md).
// Datas móveis calculadas a partir da Páscoa: Carnaval = −48/−47, Cinzas = −46, Paixão = −2, Corpus Christi = +60.
// Eventos internos de data variável (Festa da Empresa, Encontro do setor) não entram: cadastrar à mão a cada ano.

export type Abrangencia = "nacional" | "estadual_rj" | "municipal_rj" | "evento_interno" | "folga";

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function feriadosDoAno(ano: number): [string, string, Abrangencia][] {
  const p = pascoa(ano).getTime();
  const movel = (dias: number) => new Date(p + dias * 86400000).toISOString().slice(0, 10);
  const fixo = (mm: number, dd: number) => `${ano}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const lista: [string, string, Abrangencia][] = [
    [fixo(1, 1), "Confraternização Universal", "nacional"],
    [fixo(1, 20), "São Sebastião", "municipal_rj"],
    [movel(-48), "Carnaval", "folga"],
    [movel(-47), "Carnaval", "folga"],
    [movel(-46), "Cinzas", "folga"],
    [movel(-2), "Paixão de Cristo", "nacional"],
    [fixo(4, 21), "Tiradentes", "nacional"],
    [fixo(4, 23), "São Jorge", "estadual_rj"],
    [fixo(5, 1), "Dia do Trabalho", "nacional"],
    [movel(60), "Corpus Christi", "folga"],
    [fixo(9, 7), "Independência do Brasil", "nacional"],
    [fixo(10, 12), "Nossa Senhora Aparecida", "nacional"],
    [fixo(10, 15), "Dia do Professor", "evento_interno"],
    [fixo(11, 2), "Finados", "nacional"],
    [fixo(11, 15), "Proclamação da República", "nacional"],
    [fixo(11, 20), "Consciência Negra", "nacional"],
    [fixo(12, 24), "Véspera de Natal", "folga"],
    [fixo(12, 25), "Natal", "nacional"],
    [fixo(12, 31), "Véspera de Ano Novo", "folga"],
  ];
  return lista.sort((a, b) => a[0].localeCompare(b[0]));
}
