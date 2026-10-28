<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS

- Pure business rules (kcal/min, challenges, week start, weight estimates) live in `src/lib/calc.ts` with tests in `calc.test.ts`; keep them I/O-free so they stay testable.
- Client data access goes through `src/lib/data.ts` (browser Supabase client, RLS scoped to the user); photo reading runs server-side in `src/lib/vision.functions.ts` via the AI Gateway so the key never reaches the browser.
- Photos are stored in the private `photos` bucket under `<user_id>/...`; the DB stores the storage path and the UI uses signed URLs.
- Signed-in screens live under `src/routes/_authenticated/` (client-only gate); the layout there renders the tab bar and workout photo flow provider.
