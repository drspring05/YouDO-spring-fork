# Contributing to YouDO

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug or idea

- **Bugs:** open a [GitHub issue](https://github.com/mattedhairr/YouDO/issues/new/choose) with the bug template. Say what you did, what you expected, what happened, and your app version (Settings → About).
- **Ideas and questions:** the feature template, or the [Telegram discussion group](https://t.me/+-manVNAPhThkMzRl).
- **Security problems:** never in a public issue. See [SECURITY.md](SECURITY.md).

## Making a change

1. Set up the project as described under **Run locally** in the [README](README.md).
2. Branch from `main` and keep the change focused on one thing.
3. Before opening a pull request, run:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run test:sql
   ```

   All four must pass; CI runs the same checks.
4. Database changes go in the matching `supabase/*.sql` file, written so it can be rerun. Add or update the suite in `tests/sql/` and keep [`supabase/README.md`](supabase/README.md) in step.
5. Describe what changed and how you checked it in the pull request.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/` | The React app; unit tests sit next to the code as `*.test.ts` |
| `tests/` | Cross-feature tests; `tests/sql/` holds the PostgreSQL suites |
| `supabase/` | Database setup and upgrade SQL, Edge Functions, email templates |
| `android/` | The Capacitor Android project |
| `scripts/` | Build tools: icons, email templates, setup order, build checks |
| `docs/` | Maintainer notes; start at [`docs/README.md`](docs/README.md) |
| `fastlane/` | Store listing text and changelogs |

By contributing, you agree that your work is released under the [MIT License](LICENSE).
