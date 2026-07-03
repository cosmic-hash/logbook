-- Run once in Supabase → SQL Editor
create table if not exists kv_store (
  key text primary key,
  value text not null
);

alter table kv_store enable row level security;
