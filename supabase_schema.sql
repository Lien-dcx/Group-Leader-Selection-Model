-- ============================================================
-- VoteLeader — Supabase SQL Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. ROOMS
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  creator_id  uuid,
  status      text not null default 'waiting',
  created_at  timestamptz default now()
);

-- 2. MEMBERS
create table if not exists members (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid references rooms(id) on delete cascade,
  member_no          integer not null,
  name               text not null,
  performance_rating integer not null check (performance_rating between 1 and 10),
  skills             text,
  strengths          text,
  experiences        text,
  is_creator         boolean default false,
  joined_at          timestamptz default now()
);

-- 3. BALLOTS
create table if not exists ballots (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) on delete cascade,
  voter_id     uuid references members(id) on delete cascade,
  rankings     jsonb not null,
  submitted_at timestamptz default now(),
  unique(room_id, voter_id)
);

-- Enable RLS
alter table rooms   enable row level security;
alter table members enable row level security;
alter table ballots enable row level security;

-- Open policies (school project)
create policy "allow_all_rooms"   on rooms   for all using (true) with check (true);
create policy "allow_all_members" on members for all using (true) with check (true);
create policy "allow_all_ballots" on ballots for all using (true) with check (true);

-- Enable Realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table ballots;