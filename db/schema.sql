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

-- Frente dona do período, quando cada frente tem a própria sequência de sprints (ex.: TRG). '' = time inteiro.
alter table periodos add column if not exists frente text not null default '';

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

-- Histórico importado das planilhas (valores agregados por sprint/ciclo, como foram fechados).
-- A coleta do Jira tem prioridade: o deck só usa o histórico em períodos sem coleta.
create table if not exists historico_periodos (
  time               text not null,
  frente             text not null default '',
  nome               text not null,
  tipo               text not null check (tipo in ('sprint', 'semana')),
  inicio             date,
  fim                date not null,
  fonte              text not null,          -- 'dados_sprints' | 'kanban' | 'outra'
  entrega            numeric,                -- fração 0–1
  extras             numeric,                -- fração 0–1
  pts_sdd            numeric,                -- CC: pontos concluídos COM SDD
  esforco_sdd        numeric,                -- CD: pontos de esforço COM SDD
  pts_sem_sdd        numeric,                -- CJ: pontos concluídos SEM SDD
  esforco_sem_sdd    numeric,                -- CK
  ganho_sdd          numeric,                -- CL: fração 0–1
  itens_entregues    numeric,
  cycle_p50          numeric,
  cycle_p85          numeric,
  produtividade      numeric,                -- fração 0–1
  motivacao          numeric,                -- fração 0–1
  importado_em       timestamptz not null default now()
);
create unique index if not exists historico_chave on historico_periodos (time, frente, nome);

-- Mapeamento de colunas confirmado na última importação de cada tipo de planilha.
create table if not exists import_mapeamentos (
  fonte         text primary key,
  mapa          jsonb not null,
  linha_titulo  int not null,
  atualizado_em timestamptz not null default now()
);

-- Configurações com histórico (vigência por data).
create table if not exists expedientes (
  valido_de  date primary key,
  inicio     time not null,
  fim        time not null
);
insert into expedientes (valido_de, inicio, fim) values ('2000-01-01', '09:00', '18:48') on conflict do nothing;

create table if not exists feriados (
  data         date primary key,
  nome         text not null,
  abrangencia  text not null check (abrangencia in ('nacional', 'estadual_rj', 'municipal_rj', 'evento_interno', 'folga'))
);

-- Pessoas e alocações (uma linha por período em um time/frente/cargo, e troca de time = nova linha).
create table if not exists pessoas (
  id    bigserial primary key,
  nome  text not null unique
);
create table if not exists alocacoes (
  id          bigserial primary key,
  pessoa_id   bigint not null references pessoas (id) on delete cascade,
  time        text not null,
  frente      text not null default '',
  cargo       text not null check (cargo in ('Dev', 'TL', 'PM', 'QA', 'PD', 'Suporte técnico', 'Agilista')),
  percentual  numeric not null default 1 check (percentual > 0 and percentual <= 1),
  inicio      date not null,
  fim         date            -- null = alocação vigente
);
create table if not exists ausencias (
  id         bigserial primary key,
  pessoa_id  bigint not null references pessoas (id) on delete cascade,
  inicio     date not null,
  fim        date not null,
  tipo       text not null default 'Férias'
);

-- Tempo útil (horas) ao lado dos dias úteis.
alter table itens_delivery add column if not exists cycle_time_horas numeric;
alter table itens_suporte add column if not exists tempo_resolucao_horas numeric;

-- Auditoria do histórico: toda importação, edição, exclusão e reversão guarda o antes e o depois.
create table if not exists historico_auditoria (
  id            bigserial primary key,
  quando        timestamptz not null default now(),
  usuario       text not null,
  acao          text not null check (acao in ('importacao', 'edicao', 'exclusao', 'reversao')),
  time          text not null,
  frente        text not null default '',
  nome          text not null,
  antes         jsonb,            -- null = a linha não existia
  depois        jsonb,            -- null = a linha foi apagada
  revertida_em  timestamptz,
  revertida_por text,
  reverte_id    bigint references historico_auditoria (id)
);
create index if not exists historico_auditoria_time on historico_auditoria (time, quando desc);

-- Vínculo da pessoa com a empresa.
alter table pessoas add column if not exists vinculo text not null default 'funcionario';
alter table pessoas drop constraint if exists pessoas_vinculo_check;
alter table pessoas add constraint pessoas_vinculo_check check (vinculo in ('funcionario', 'terceirizado'));
