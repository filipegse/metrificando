# Metrificando — Plataforma de Métricas da TAP

Coleta automática das métricas dos times da TAP (Jira → banco único) com visões por time e
frente. **Sem visão individual**: nenhuma tela ou tabela de painel tem dimensão de pessoa.

Especificação e regras de negócio: `docs-ai-agilidade`
(`05-praticas/plataforma-metricas.md`, `05-praticas/principios-de-metricas.md`,
`03-jira/fluxos-de-status.md`).

## Arquitetura

```
Jira Automation ──POST──▶ /api/webhooks/jira  (netlify/functions/jira-webhook.mts, responde 202)
                                 │
                                 ▼
                    coleta-background (até 15 min): perfil → API do Jira → normalização → Postgres
rede-seguranca (diária): reprocessa sprints fechadas sem coleta ok
saude-diaria (diária): health checks fechados do TeamRetro → saude_time
coleta-github (diária) → coleta-github-background: PRs da org no GitHub → itens_pr (DORA/SPACE)
Next.js (app/): visões
```

- `src/config/perfis.ts`: um perfil por time (metodologia, período, campo de frente, tipos, fontes de suporte).
- `src/config/status.ts`: mapas status do Jira → etapa canônica, por workflow.
- `src/lib/normalizar.ts`: regras de delivery e suporte (exclusões, cycle time, resolução, N2/N3).
- `db/schema.sql`: modelo canônico.

## Regras implementadas

- Épico, Subtarefa e Suporte nunca entram em delivery. TRG e CF usam só o seu subconjunto de tipos.
- Suporte entra no período em que foi **resolvido** (entrada em `Resolvido`; em SP e SIS, `Concluído`).
- N3 = passou pelo status `Enviado para N3`. No Rematrix, o volume vem do SC e o SIS é trabalho N3 (não soma no volume).
- Kanban (IC, EFC): janela sábado–sexta, America/Bahia.
- Coleta idempotente por `time + periodo_id`.

## Engenharia (GitHub)

`/engenharia` mostra DORA e fluxo de PRs por time/frente e semana sábado–sexta. Coleta diária (07h Bahia)
dos PRs atualizados na última semana em todos os repos ativos da org (`GITHUB_ORG`); a primeira carrega 120 dias.
- Atribuição: chave do Jira de um projeto da TAP no branch/título; senão o login GitHub cadastrado em Pessoas
  (alocação vigente no merge); senão "não atribuído". Salvar um login reatribui os PRs já coletados.
- Deploy = merge em master/main/production (o deploy roda no merge); master + production no mesmo dia e repo = 1 release.
- Falha = release com branch hotfix/, fix/ ou bugfix/. Lead time = PR aberto → merge (PRs que não são deploy).
- O autor fica gravado só para reatribuição; nenhuma tela mostra pessoa.

## Modo apresentação

`/apresentacao?trimestre=2026-Q4&times=SCOPS,DSR,IC` monta o deck da Sync de Agilidade com o
layout da skill `sync-agilidade-deck`: capa, matriz com semáforo e cards, entrega (Scrum) ou
vazão (Kanban), desempenho COM/SEM SDD, tempo de ciclo, composições, roadmap, suporte e
destaques. Os textos de leitura são editados no próprio slide e salvos no banco (tabela
`leituras`). `demo=1` usa dados fictícios. Teclas: ← → navegar, F tela cheia, P imprimir/PDF.

Produtividade e motivação vêm do health check do TeamRetro (modelo Squad Feeling v2):
produtividade = média("o sprint foi", "meu trabalho foi") ÷ 5 e motivação = média("me senti
motivado", "senti o time motivado") ÷ 5. O health check é associado à sprint com fim mais
próximo (até 7 dias) ou, em Kanban, à semana que contém a data. Só agregados são gravados.
TRG e CF não têm time no TeamRetro.

Fora do deck por enquanto: ganho SDD e pontos de esforço (vêm da planilha auxiliar SDD, não
do Jira) e acumulados entre trimestres.

## Configuração

1. Netlify: ligar o repositório ao site e ativar o **Netlify DB** (define `NETLIFY_DATABASE_URL`).
2. Variáveis de ambiente (ver `.env.example`): `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `WEBHOOK_TOKEN`, `TEAMRETRO_API_KEY`
   e, até existir login, `APP_USUARIO`/`APP_SENHA` (senha única para abrir a aplicação).
3. Schema: aplicado automaticamente em cada deploy (`npm run db:schema` antes do build; comandos idempotentes).
4. Jira Automation:
   - Scrum (SCOPS, DSR, NXS, TRG, CF): gatilho **Sprint completed** → **Send web request**
     `POST https://<site>/api/webhooks/jira`, header `X-Webhook-Token: <WEBHOOK_TOKEN>`, corpo:
     ```json
     {"evento":"sprint_concluida","projeto":"{{project.key}}","sprint_id":"{{sprint.id}}",
      "sprint_nome":"{{sprint.name}}","inicio":"{{sprint.startDate}}","fim":"{{sprint.completeDate}}"}
     ```
   - Kanban (IC, EFC): gatilho **Scheduled** sexta 23h → mesmo request com
     `{"evento":"janela_semanal","projeto":"IC"}` (ou `EFC`).

## Desenvolvimento

```bash
npm install
npm test         # vitest
npm run typecheck
npm run dev
```

## Pendências conhecidas

- Login com Google Workspace (Auth.js) substituindo a senha provisória.
- Entrega % usa os itens na sprint no fechamento; itens removidos no meio da sprint não entram no planejado.
