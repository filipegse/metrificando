-- Acesso: o app Lovable usa a chave anon + login Google (Supabase Auth). Só contas @gruposaltaedu.com entram.
-- As tabelas cruas e o registro de lotes não têm política: só a service_role (n8n e Edge Function) acessa.

create or replace function eh_usuario_salta() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@gruposaltaedu.com'
$$;

do $$
declare t text;
begin
  -- Tabelas do app: leitura e escrita para usuários do domínio.
  foreach t in array array[
    'periodos', 'itens_delivery', 'itens_suporte', 'coletas', 'leituras', 'saude_time', 'historico_periodos',
    'import_mapeamentos', 'expedientes', 'feriados', 'pessoas', 'alocacoes', 'ausencias', 'historico_auditoria',
    'decks_salvos', 'migracoes', 'itens_pr'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists salta_tudo on %I', t);
    execute format('create policy salta_tudo on %I for all to authenticated using (eh_usuario_salta()) with check (eh_usuario_salta())', t);
  end loop;
  -- Camada crua: RLS ligado e nenhuma política.
  foreach t in array array['jira_eventos', 'jira_transicoes', 'coleta_lotes', 'jira_issues_cruas'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
