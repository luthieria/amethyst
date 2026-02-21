# Reading Analytics Setup

This document configures the `Reading analytics` page (`layout: reading-analytics`) to use Supabase directly from the frontend.

## 1. Configure Site Params

Edit `config.yaml`:

```yaml
params:
  readingAnalytics:
    supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co"
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
    ownerEmail: "you@example.com"
```

These values are injected into the page as data attributes and used by `static/js/reading-analytics.js`.

## 2. Run SQL Migrations (in this order)

Execute the files in Supabase SQL editor:

1. `supabase/sql/001_reading_analytics_schema.sql`
2. `supabase/sql/002_reading_analytics_rls.sql`
3. `supabase/sql/003_reading_analytics_views.sql`

## 3. Auth Configuration

1. In Supabase Auth, enable Email provider (magic link).
2. Add your local and production URLs to allowed redirect URLs.
3. Ensure `params.readingAnalytics.ownerEmail` matches the account email you will sign in with.

## 4. Bootstrap Spreadsheet Data (optional one-time import)

Generate seed JSON:

```powershell
python scripts/bootstrap_reading_analytics_from_xlsx.py
```

Upload directly to Supabase (service role key required):

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:READING_ANALYTICS_OWNER_USER_ID="YOUR_OWNER_USER_UUID"
python scripts/bootstrap_reading_analytics_from_xlsx.py --upload --replace
```

Default input spreadsheet path is `D:\Downloads\Tareas.xlsx` on sheet `Livros`.

## 5. Verify

1. Open `Reading analytics` page.
2. As anonymous user: table loads in read-only mode.
3. Sign in with owner email magic link.
4. Edit/add/remove rows, save, and confirm persistence.
5. Confirm yearly goals save and that monthly/yearly stats update.
6. Confirm `reading_entry_history` receives rows after insert/update/delete.
