# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub:
**Security → Report a vulnerability** on this repository. Do not open a public
issue, and do not test against other people's accounts or data.

Include what you found, how to reproduce it, and which app version or commit you
used. You will get a reply as soon as the report has been read.

## Supported versions

Only the latest release on the
[Releases page](https://github.com/mattedhairr/YouDO/releases/latest) gets
security fixes. The app's built-in updater installs it.

## What is public by design

The Supabase project URL and its anon key in `src/lib/supabase.ts`, and the
Firebase client config in `android/app/google-services.json`, ship inside every
APK and are not secrets. Access to data is enforced by row-level security on
every table (`supabase/*.sql`). Service keys, the signing key and push
credentials are kept only in GitHub and Supabase secrets.
