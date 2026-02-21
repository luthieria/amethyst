begin;

alter table public.reading_entries enable row level security;
alter table public.reading_yearly_goals enable row level security;
alter table public.reading_entry_history enable row level security;

drop policy if exists reading_entries_select_public on public.reading_entries;
create policy reading_entries_select_public
on public.reading_entries
for select
to anon, authenticated
using (true);

drop policy if exists reading_entries_insert_owner on public.reading_entries;
create policy reading_entries_insert_owner
on public.reading_entries
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists reading_entries_update_owner on public.reading_entries;
create policy reading_entries_update_owner
on public.reading_entries
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists reading_entries_delete_owner on public.reading_entries;
create policy reading_entries_delete_owner
on public.reading_entries
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists reading_yearly_goals_select_public on public.reading_yearly_goals;
create policy reading_yearly_goals_select_public
on public.reading_yearly_goals
for select
to anon, authenticated
using (true);

drop policy if exists reading_yearly_goals_insert_owner on public.reading_yearly_goals;
create policy reading_yearly_goals_insert_owner
on public.reading_yearly_goals
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists reading_yearly_goals_update_owner on public.reading_yearly_goals;
create policy reading_yearly_goals_update_owner
on public.reading_yearly_goals
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists reading_yearly_goals_delete_owner on public.reading_yearly_goals;
create policy reading_yearly_goals_delete_owner
on public.reading_yearly_goals
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists reading_entry_history_select_owner on public.reading_entry_history;
create policy reading_entry_history_select_owner
on public.reading_entry_history
for select
to authenticated
using (
  auth.uid() is not null
  and (snapshot ->> 'owner_user_id') is not null
  and ((snapshot ->> 'owner_user_id')::uuid = auth.uid())
);

commit;
