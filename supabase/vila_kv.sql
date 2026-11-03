-- Vila online (passaporte, ranking, A Turma): uma tabela chave → valor usada só pelo servidor da Vila.
-- Rode no SQL Editor de um projeto Supabase e coloque no Render: SUPABASE_URL e SUPABASE_SERVICE_KEY (service_role).
-- RLS ligado e sem políticas: o navegador (chave anon) não lê nem escreve nada; só o servidor, com a service_role.
create table if not exists public.vila_kv (
  k text primary key,
  v jsonb not null,
  atualizado timestamptz not null default now()
);
alter table public.vila_kv enable row level security;
