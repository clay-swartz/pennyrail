-- OPTIONAL in v0.1. Add when we want persistent trend history.
create table if not exists pennyrail_radar_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pennyrail_radar_snapshots_source_created_idx on pennyrail_radar_snapshots(source, created_at desc);
