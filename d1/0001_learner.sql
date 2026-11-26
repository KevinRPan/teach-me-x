create table if not exists sessions (
  id text primary key,
  created_at text not null
);

create table if not exists learner_state (
  session_id text primary key,
  profile_json text,
  pathways_json text,
  selected_json text,
  plan_json text,
  plan_status text,
  has_revised integer not null default 0,
  messages_json text not null default '[]',
  updated_at text not null
);
