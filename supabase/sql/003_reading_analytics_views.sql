begin;

create or replace view public.reading_monthly_stats_v as
select
  owner_user_id,
  extract(year from finish_date)::int as year,
  extract(month from finish_date)::int as month,
  count(*) filter (where abandoned = false) as books_finished,
  coalesce(sum(pages_read) filter (where abandoned = false), 0)::int as pages_finished,
  count(*) filter (where abandoned = false and reread = true) as rereads_finished,
  count(*) filter (where abandoned = true) as abandoned_count,
  round(avg(rating) filter (where rating is not null), 1) as avg_rating
from public.reading_entries
where finish_date is not null
group by
  owner_user_id,
  extract(year from finish_date),
  extract(month from finish_date);

create or replace view public.reading_yearly_stats_v as
with years as (
  select owner_user_id, extract(year from finish_date)::int as year
  from public.reading_entries
  where finish_date is not null
  union
  select owner_user_id, year
  from public.reading_yearly_goals
),
aggregated as (
  select
    owner_user_id,
    extract(year from finish_date)::int as year,
    count(*) filter (where abandoned = false) as books_finished,
    coalesce(sum(pages_read) filter (where abandoned = false), 0)::int as pages_finished,
    count(*) filter (where abandoned = false and reread = true) as rereads_finished,
    count(*) filter (where abandoned = true) as abandoned_count,
    round(avg(rating) filter (where rating is not null), 1) as avg_rating
  from public.reading_entries
  where finish_date is not null
  group by owner_user_id, extract(year from finish_date)
)
select
  y.owner_user_id,
  y.year,
  coalesce(a.books_finished, 0)::int as books_finished,
  coalesce(a.pages_finished, 0)::int as pages_finished,
  coalesce(a.rereads_finished, 0)::int as rereads_finished,
  coalesce(a.abandoned_count, 0)::int as abandoned_count,
  a.avg_rating,
  coalesce(g.target_books, 0)::int as target_books,
  coalesce(g.target_pages, 0)::int as target_pages
from years y
left join aggregated a
  on a.owner_user_id = y.owner_user_id
 and a.year = y.year
left join public.reading_yearly_goals g
  on g.owner_user_id = y.owner_user_id
 and g.year = y.year;

grant select on public.reading_monthly_stats_v to anon, authenticated;
grant select on public.reading_yearly_stats_v to anon, authenticated;

commit;
