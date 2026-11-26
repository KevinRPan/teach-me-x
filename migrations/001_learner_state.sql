create table if not exists learner_state (
  owner text primary key,
  profile_json text,
  pathways_json text,
  selected_json text,
  plan_json text,
  plan_status text,
  has_revised boolean not null default false,
  messages_json text not null default '[]',
  updated_at timestamptz not null default now()
);
