-- Modelo canônico da Plataforma de Métricas da TAP.
-- Regra de produto: nenhuma tabela de painel tem dimensão de pessoa.

create table if not exists periodos (
  time          text not null,
  periodo_id    text not null,          -- id da sprint no Jira ou 'AAAA-MM-DD' (sábado de início da janela)
  tipo          text not null check (tipo in ('sprint', 'semana')),
  nome          text,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  metodologia   text not null check (metodologia in ('scrum', 'kanban')),
  coletado_em   timestamptz not null default now(),
  primary key (time, periodo_id)
);

create table if not exists itens_delivery (
  time               text not null,
  periodo_id         text not null,
  chave              text not null,
  frente             text,
  tipo_jira          text not null,
  tipo_canonico      text not null,
  sp_sdd             numeric,
  sp_sem_sdd         numeric,
  sp_original        numeric,
  planejamento       text,
  categoria_roadmap  text,
  status_jira        text not null,
  etapa_final        text not null,
  entregue           boolean not null,
  entregue_em        timestamptz,
  cycle_time_dias    numeric,
  primary key (time, periodo_id, chave),
  foreign key (time, periodo_id) references periodos (time, periodo_id) on delete cascade
);

create table if not exists itens_suporte (
  time                  text not null,
  periodo_id            text not null,
  projeto               text not null,
  chave                 text not null,
  frente                text,
  nivel                 text check (nivel in ('N2', 'N3')),
  papel                 text not null default 'chamado' check (papel in ('chamado', 'trabalho_n3')),
  status_jira           text not null,
  etapa_final           text not null,
  criado_em             timestamptz not null,
  resolvido_em          timestamptz not null,
  tempo_resolucao_dias  numeric not null,
  na_sprint             boolean not null,
  primary key (time, periodo_id, chave),
  foreign key (time, periodo_id) references periodos (time, periodo_id) on delete cascade
);

create table if not exists coletas (
  id            bigserial primary key,
  evento        text not null,
  time          text not null,
  periodo_id    text not null,
  status        text not null check (status in ('ok', 'erro')),
  detalhe       text,
  executado_em  timestamptz not null default now()
);

create index if not exists coletas_time_periodo on coletas (time, periodo_id);

-- Textos de leitura escritos pelo agilista em cada slide do modo apresentação.
create table if not exists leituras (
  deck          text not null,          -- ex.: '2026-Q4'
  time          text not null,
  slide         text not null,          -- ex.: 'entrega', 'destaques'
  texto         text not null,
  atualizado_em timestamptz not null default now(),
  primary key (deck, time, slide)
);

-- Health check do TeamRetro (Squad Feeling v2), só agregado por time. Sem FK para sobreviver à recoleta do período.
create table if not exists saude_time (
  time                   text not null,
  periodo_id             text not null,
  frente                 text not null default '',  -- '' quando o health check é do time inteiro
  health_check_id        text not null,
  data                   date not null,
  prod_coletiva          numeric,   -- média 1–5 de "o sprint foi"
  prod_individual        numeric,   -- média 1–5 de "meu trabalho foi"
  mot_individual         numeric,   -- média 1–5 de "me senti motivado"
  mot_coletiva           numeric,   -- média 1–5 de "senti o time motivado"
  produtividade          numeric,   -- (coletiva + individual) / 2 / 5
  motivacao              numeric,   -- (individual + coletiva) / 2 / 5
  respostas              int not null,
  coletado_em            timestamptz not null default now()
);

-- Migração: um health check por frente (ex.: TRG = Retaguarda e X-Retaguarda).
alter table saude_time add column if not exists frente text not null default '';
alter table saude_time drop constraint if exists saude_time_pkey;
create unique index if not exists saude_time_chave on saude_time (time, periodo_id, frente);
