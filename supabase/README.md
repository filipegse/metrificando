# Supabase — Metrificando (versão Lovable + n8n)

Banco e regras de negócio da nova versão. O app Lovable só lê e edita tabelas; o n8n orquestra a coleta;
as regras de métrica ficam **só** em `functions/_shared` (testadas pelo vitest na raiz do repositório).

## Estrutura

```
migrations/
  20261106000001_schema_base.sql   esquema canônico (cópia de db/schema.sql na tag v1.0-netlify)
  20261106000002_camada_crua.sql   jira_eventos, jira_transicoes, coleta_lotes, jira_issues_cruas, gravar_periodo()
  20261106000003_rls.sql           RLS: app só para contas @gruposaltaedu.com; camada crua só service_role
functions/
  _shared/config/                  perfis dos times e mapas de status (fonte única)
  _shared/lib/                     normalizar, calendário, tempo por status, período, JQL, coletaCore
  coleta/index.ts                  Edge Function chamada pelo n8n
```

`src/config/*` e `src/lib/{normalizar,calendario,tempoStatus,periodo,jql}` no app Next.js são só
reexportações destes arquivos: não edite lá.

## Contrato da Edge Function `coleta`

Header obrigatório: `x-coleta-token: <COLETA_TOKEN>`.

1. **Planejar** — `POST /functions/v1/coleta`
   ```json
   {"acao":"planejar","evento":{"evento":"sprint_concluida","projeto":"DSR","sprint_id":"1234","sprint_nome":"DSR 140","inicio":"…","fim":"…"}}
   ```
   ou `{"acao":"planejar","evento":{"evento":"janela_semanal","projeto":"IC"}}` (Kanban: última janela sáb–sex fechada,
   America/Bahia; `referencia` opcional). Resposta: `{lote_id, time, periodo_id, consultas:[{id, jql, fields}]}`.
2. **Buscar (n8n)** — para cada consulta: `POST {JIRA}/rest/api/3/search/jql` com
   `{jql, fields, expand:"changelog", maxResults:100, nextPageToken}` até acabar o `nextPageToken`, e gravar cada issue
   em `jira_issues_cruas (lote_id, consulta = consultas[i].id, chave = issue.key, payload = issue)`.
3. **Normalizar** — `POST /functions/v1/coleta` com `{"acao":"normalizar","lote_id":"…"}`. Grava o período
   (idempotente por time + período), registra em `coletas` e fecha o lote. Reprocessar = chamar de novo com um lote
   novo; o lote antigo continua guardado para auditoria.

Erros de regra (perfil inexistente, evento incompatível com a metodologia) voltam com status 422 e ficam em `coletas`
e `coleta_lotes.detalhe`.

## Implantação

```bash
supabase link --project-ref <ref>
supabase db push
supabase secrets set COLETA_TOKEN=<segredo>
supabase functions deploy coleta
```

Checagem local da função: `cd supabase/functions && npx deno@2 check coleta/index.ts`.

## Pendências (próximas fases)

- Workflows do n8n (Fase 2): webhook nativo do Jira → `jira_eventos`/`jira_transicoes`; coleta de sprint e janela;
  rede de segurança; TeamRetro → `saude_time`.
- Perfis e mapas de status em tabelas (hoje em `_shared/config`, com RegExp nas séries de sprint).
- Retenção de `jira_issues_cruas` (payload grande): expurgar lotes normalizados com mais de N meses.
