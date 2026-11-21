# Staff console (lives in `apps/web` for now)

The brief asks for a separate, protected operations console. In the prototype it is the `/staff`
area of `apps/web` (`apps/web/src/app/staff`), with its own shell and a mock staff sign-in, so the
whole concept ships as one static site.

Before any pilot it must become its own deployable in a separate network zone, behind workforce
identity with hardware-bound multi-factor authentication. See `docs/architecture/decisions.md`.
