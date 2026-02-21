begin;

create table if not exists public.reading_entries (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null,
  title text not null,
  author text,
  year_published int,
  pages int check (pages is null or pages >= 0),
  pages_read int check (pages_read is null or pages_read >= 0),
  start_date date,
  finish_date date,
  genre text,
  language text,
  format text,
  rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  notes text,
  reread boolean not null default false,
  abandoned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reading_entries_owner_idx on public.reading_entries (owner_user_id);
create index if not exists reading_entries_finish_date_idx on public.reading_entries (finish_date);
create index if not exists reading_entries_year_idx on public.reading_entries (year_published);

create table if not exists public.reading_yearly_goals (
  owner_user_id uuid not null,
  year int not null,
  target_books int not null default 0,
  target_pages int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, year),
  constraint reading_yearly_goals_target_books_nonneg check (target_books >= 0),
  constraint reading_yearly_goals_target_pages_nonneg check (target_pages >= 0)
);

create index if not exists reading_yearly_goals_year_idx on public.reading_yearly_goals (year);

create table if not exists public.reading_entry_history (
  history_id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  entry_id bigint,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  snapshot jsonb not null
);

create index if not exists reading_entry_history_entry_idx on public.reading_entry_history (entry_id);
create index if not exists reading_entry_history_changed_at_idx on public.reading_entry_history (changed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reading_entries_set_updated_at on public.reading_entries;
create trigger trg_reading_entries_set_updated_at
before update on public.reading_entries
for each row
execute function public.set_updated_at();

drop trigger if exists trg_reading_yearly_goals_set_updated_at on public.reading_yearly_goals;
create trigger trg_reading_yearly_goals_set_updated_at
before update on public.reading_yearly_goals
for each row
execute function public.set_updated_at();

create or replace function public.log_reading_entry_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _snapshot jsonb;
  _entry_id bigint;
begin
  if tg_op = 'DELETE' then
    _snapshot := to_jsonb(old);
    _entry_id := old.id;
  else
    _snapshot := to_jsonb(new);
    _entry_id := new.id;
  end if;

  insert into public.reading_entry_history (changed_by, entry_id, action, snapshot)
  values (auth.uid(), _entry_id, tg_op, _snapshot);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reading_entries_history on public.reading_entries;
create trigger trg_reading_entries_history
after insert or update or delete on public.reading_entries
for each row
execute function public.log_reading_entry_change();

commit;
