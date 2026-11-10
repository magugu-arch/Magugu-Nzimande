# Decisions

Short architecture decision records. Each can be revisited when the club's inputs arrive.

## D1. A separate workspace inside the existing repository

The repository already holds a working, tested app for another client. The One App is an npm
workspace in `kaizer-chiefs-one/` with its own lockfile and CI job, and the root tooling ignores
it. Moving it to its own repository later is a folder copy.

## D2. Expo SDK 57, matching the repository

`AGENTS.md` pins Expo documentation to v57 and the root app is proven on SDK 57 (React Native 0.86,
React 19.2). SDK 58 is available; upgrading is a separate, testable step once the club approves the
build pipeline.

## D3. Contracts carry the accuracy rules

The brief's non-negotiables are encoded as zod refinements (no demo scores, membership, balances,
prices or partner names; short-lived ticket tokens; consent on uploads). Demo adapters validate
their own data at load, so a mistake fails loudly in development rather than reaching a screen.

## D4. Demo, off and live per feature

Capability flags let each integration go live independently once its provider, legal and
operational requirements are approved. Production allows only off and live.

## D5. Supabase behind adapters

Supabase is the recommended MVP backend (subject to club IT approval). Screens never talk to it
directly: they call provider hooks, and the live adapters call edge functions. Replacing Supabase,
or pointing an adapter at an existing club system, does not touch screens.

## D6. RLS tests in PGlite

Policy tests run the real migrations in PGlite, with a small stand-in for Supabase's auth schema,
roles and default grants. They run in seconds in CI without Docker. A Supabase CLI run against a
real local stack remains part of the release checklist.

## D7. Editorial design from the inspiration, typeset in the brief's system

The supplied inspiration sets the composition and rhythm; the brief sets the palette and type
families. The inspiration's serif display is replaced with Barlow Condensed (including its italic,
which the brand board also shows), keeping the gold italic accent line.

## D8. No live sign-in yet

The identity provider is an open decision, so live sign-in refuses plainly. Demo sign-in exercises
validation, session storage, expiry and sign-out end to end without creating accounts.
