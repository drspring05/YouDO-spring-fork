# YouDO docs

Maintainer notes for features, accounts and the hosted setup. Supabase setup
and SQL order live in [`supabase/README.md`](../supabase/README.md); releases
follow [`RELEASE_PROCEDURE.md`](../RELEASE_PROCEDURE.md).

## Accounts and data

- [Account lifecycle](account-lifecycle.md): who owns the device workspace, cloud backup and sessions, and what happens on sign-in, sign-out and account switches.
- [Account links](account-links.md): confirmation and password-reset links, Vercel and Supabase redirect setup.
- [Signed-in devices](account-sessions.md): the device list under Account security and its SQL.
- [Data integrity](data-integrity.md): sources of truth and the rules that keep local and cloud copies consistent.

## Features

- [Plan with AI](ai-blueprint-planning.md): the Blueprint planning prompt and how its output is imported.
- [Focus sounds](focus-sounds.md): where the sounds come from and how playback follows the timer.
- [Community setup](community-setup.md): Board community, chat and hashtags, with the hosted checks for each upgrade.
- [Community rooms](community-rooms.md): fixed chat rooms and per-room read markers.
- [Board loading and update delivery](update-delivery.md): how the Board loads and how update notices reach users.

## History

Past investigations and release handoffs, kept for reference.

- [v6.3.0 missing-session investigation](history/focus-session-investigation.md)
- [Batch 9: performance and handoff](history/performance-handoff.md)

## Media

- [`screenshots/`](screenshots): current screenshots used in the main README.
- [`screenshots/v7-classic/`](screenshots/v7-classic): the v7 design, shown by Classic Look, and the promo poster.
