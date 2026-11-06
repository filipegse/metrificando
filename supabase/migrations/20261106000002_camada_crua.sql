-- Camada crua: o n8n grava aqui o que veio do Jira, sem regra de negócio. A Edge Function `coleta`
-- normaliza a partir daqui para o modelo canônico. Permite reprocessar um período sem chamar o Jira de novo.

-- Eventos recebidos do webhook nativo do Jira (não consome a cota do Jira Automation) e da reconciliação diária.
create table if not exists jira_eventos (
  id            bigserial primary key,
  idempotencia  text not null unique,     -- ex.: issue_updated:<issue.id>:<changelog.id> ou sprint_closed:<sprint.id>
  origem        text not null check (origem in ('webhook', 'reconciliacao')),
  tipo          text not null,            -- webhookEvent do Jira (jira:issue_updated, sprint_closed, ...)
  projeto       text,
  chave         text,                     -- issue key, quando houver
  sprint_id     text,
  ocorrido_em   timestamptz not null,
  payload       jsonb not null,
  recebido_em   timestamptz not null default now()
);
create index if not exists jira_eventos_projeto on jira_eventos (projeto, ocorrido_em desc);
create index if not exists jira_eventos_chave on jira_eventos (chave);

-- Transições de status (changelog) já extraídas do evento. Sem autor: só campo, de, para e quando.
create table if not exists jira_transicoes (
  chave        text not null,
  history_id   text not null,
  projeto      text not null,
  de           text,
  para         text,
  ocorrido_em  timestamptz not null,
  primary key (chave, history_id)
);
create index if not exists jira_transicoes_projeto on jira_transicoes (projeto, ocorrido_em desc);

-- Lote de coleta de um período: aberto por `planejar`, preenchido pelo n8n, fechado por `normalizar`.
create table if not exists coleta_lotes (
  id            uuid primary key default gen_random_uuid(),
  evento        jsonb not null,
  time          text not null,
  periodo_id    text not null,
  consultas     jsonb not null,           -- [{id, jql, fields}] que o n8n executa
  status        text not null default 'aberto' check (status in ('aberto', 'normalizado', 'erro')),
  detalhe       text,
  criado_em     timestamptz not null default now(),
  fechado_em    timestamptz
);
create index if not exists coleta_lotes_time_periodo on coleta_lotes (time, periodo_id, criado_em desc);

-- Issues cruas (com changelog) de cada consulta do lote, como o Jira devolveu.
create table if not exists jira_issues_cruas (
  lote_id   uuid not null references coleta_lotes (id) on delete cascade,
  consulta  text not null,                -- 'delivery' | 'suporte:<projeto>'
  chave     text not null,
  payload   jsonb not null,
  primary key (lote_id, consulta, chave)
);

-- Grava um período por inteiro numa transação (idempotente por time + periodo_id).
-- Recebe {periodo:{...}, delivery:[...], suporte:[...]} com chaves = nomes das colunas.
create or replace function gravar_periodo(g jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from periodos where time = g->'periodo'->>'time' and periodo_id = g->'periodo'->>'periodo_id';
  insert into periodos select * from jsonb_populate_record(null::periodos, g->'periodo' || jsonb_build_object('coletado_em', now()));
  insert into itens_delivery select * from jsonb_populate_recordset(null::itens_delivery, coalesce(g->'delivery', '[]'));
  insert into itens_suporte select * from jsonb_populate_recordset(null::itens_suporte, coalesce(g->'suporte', '[]'))
    on conflict (time, periodo_id, chave) do nothing;
end $$;
revoke all on function gravar_periodo(jsonb) from public, anon, authenticated;
