// Configurações do deck salvas pelo assistente, para a URL da apresentação levar só um id curto.
import { randomBytes } from "node:crypto";
import { db, urlBanco } from "./db";

export type ParametrosDeck = Record<string, string>;

const ID = /^[a-z0-9]{10}$/;

export async function salvarDeck(p: ParametrosDeck): Promise<string> {
  const id = Array.from(randomBytes(10), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  await db()`insert into decks_salvos (id, parametros) values (${id}, ${JSON.stringify(p)}::jsonb)`;
  return id;
}

export async function lerDeckSalvo(id: string): Promise<ParametrosDeck | null> {
  if (!ID.test(id) || !urlBanco()) return null;
  const [l] = (await db()`select parametros from decks_salvos where id = ${id}`) as { parametros: ParametrosDeck }[];
  return l?.parametros ?? null;
}
