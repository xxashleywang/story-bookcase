create schema if not exists preview;

create table if not exists public.profiles (
  user_id text primary key,
  username text,
  username_key text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key_unique on public.profiles (username_key);

create table if not exists public.builds (
  id serial primary key,
  user_id text not null references public.profiles (user_id) on delete cascade,
  title text not null,
  description text,
  brand text,
  model_name text,
  category text not null default 'bookcase',
  color_name text,
  color_hex text,
  tags text[] not null default '{}',
  photo_paths text[] not null,
  configuration jsonb,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists builds_user_id_idx on public.builds (user_id);

create table if not exists public.photos (
  id text primary key,
  user_id text not null references public.profiles (user_id) on delete cascade,
  content_type text not null,
  size integer not null check (size > 0 and size <= 12000000),
  bytes bytea,
  attached boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_id_idx on public.photos (user_id);

create table if not exists public.favourites (
  user_id text not null,
  build_id integer not null references public.builds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, build_id)
);

create table if not exists public.photo_deletions (
  object_path text primary key,
  user_id text not null
);

create table if not exists preview.profiles (
  user_id text primary key,
  username text,
  username_key text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists preview_profiles_username_key_unique on preview.profiles (username_key);

create table if not exists preview.builds (
  id serial primary key,
  user_id text not null references preview.profiles (user_id) on delete cascade,
  title text not null,
  description text,
  brand text,
  model_name text,
  category text not null default 'bookcase',
  color_name text,
  color_hex text,
  tags text[] not null default '{}',
  photo_paths text[] not null,
  configuration jsonb,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists preview_builds_user_id_idx on preview.builds (user_id);

create table if not exists preview.photos (
  id text primary key,
  user_id text not null references preview.profiles (user_id) on delete cascade,
  content_type text not null,
  size integer not null check (size > 0 and size <= 12000000),
  bytes bytea,
  attached boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists preview_photos_user_id_idx on preview.photos (user_id);

create table if not exists preview.favourites (
  user_id text not null,
  build_id integer not null references preview.builds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, build_id)
);

create table if not exists preview.photo_deletions (
  object_path text primary key,
  user_id text not null
);
