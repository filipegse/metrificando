-- Permissões de tabela (GRANT). Projetos Supabase novos não concedem acesso automático a tabelas criadas
-- por migration: sem isto, o banco recusa antes de aplicar o RLS.

-- service_role (servidor do app / endpoint do n8n): tudo, inclusive a camada crua e gravar_periodo().
grant usage on schema public to service_role, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function gravar_periodo(jsonb) to service_role;

-- authenticated (usuários logados): tabelas do app; o RLS limita ao domínio @gruposaltaedu.com.
-- A camada crua (jira_eventos, jira_transicoes, coleta_lotes, jira_issues_cruas) fica de fora.
do $$
declare t text;
begin
  foreach t in array array[
    'periodos', 'itens_delivery', 'itens_suporte', 'coletas', 'leituras', 'saude_time', 'historico_periodos',
    'import_mapeamentos', 'expedientes', 'feriados', 'pessoas', 'alocacoes', 'ausencias', 'historico_auditoria',
    'decks_salvos', 'migracoes', 'itens_pr'
  ] loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function eh_usuario_salta() to authenticated;

-- anon: nenhum acesso.
revoke all on all tables in schema public from anon;
