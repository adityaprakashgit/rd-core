This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

`npm run dev` now enforces schema/client safety before startup:
- runs `prisma migrate status` (must be up to date)
- runs `prisma generate`

You can run the checks manually with:

```bash
npm run db:prepare
```

### Database Startup Recovery (Local Postgres)

If the app fails with a Prisma/database startup error, use this sequence:

```bash
npm run db:doctor
npm run db:bootstrap
npm run dev
```

What these do:
- `db:doctor`: validates `DATABASE_URL`, checks Postgres reachability, and verifies database connectivity with actionable errors.
- `db:bootstrap`: creates the target database if missing, applies migrations (`prisma migrate deploy`), and runs `prisma generate`.

Common troubleshooting:
- **Postgres not running**: start your local Postgres service, then rerun `db:doctor`.
- **Database missing** (`rd_core`): run `db:bootstrap`.
- **Auth failed**: correct username/password in `.env` `DATABASE_URL`.
- **Packet create blocked but app is up**: this is usually readiness validation, not DB outage. Run `npm run packet:health -- --sampleId=<sampleId> --sessionCookie='<cookie>'` for a DB + packet endpoint diagnostic.

Example local URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rd_core"
```

Repair historical seal-traceability mismatch (lot sealed but sample seal label incomplete):

```bash
npm run repair:sample-seal:dry-run
npm run repair:sample-seal:execute
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## UI Architecture Governance

For enterprise UI implementation standards and migration direction, use:

- Canonical UI governance: [`docs/enterprise-ui-governance.md`](docs/enterprise-ui-governance.md)
- Agent execution rules: [`AGENTS.md`](AGENTS.md)
- Supporting revamp references:
  - [`UI_REVAMP_PRD.md`](UI_REVAMP_PRD.md)
  - [`UI_REVAMP_COMPONENT_SYSTEM.md`](UI_REVAMP_COMPONENT_SYSTEM.md)

When guidance conflicts, follow:
1. `docs/enterprise-ui-governance.md`
2. `AGENTS.md`
3. module-specific/supporting docs

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Evidence Telemetry

Evidence funnel telemetry events are emitted from media upload and sampling handlers:
- `upload_attempt`
- `upload_success`
- `upload_failed`
- `stage_complete`

Telemetry configuration:
- `EVIDENCE_TELEMETRY_ENABLED` (`true` by default)
- `EVIDENCE_TELEMETRY_SINK` (`AUDIT_LOG` by default, supported: `AUDIT_LOG`, `CONSOLE`)
- `EVIDENCE_STUCK_HOURS` (daily report threshold, default `24`)
- `EVIDENCE_TELEMETRY_LOOKBACK_HOURS` (daily report window, default `24`)
- `MEDIA_STORAGE_PROVIDER` (`LOCAL` by default)

Generate daily telemetry/stuck report:

```bash
npm run telemetry:report:daily
```

Critical process regression suite (sampling transition, seal guards, export policy, mobile spacing checks):

```bash
npm run test:e2e:critical
```
# rd-core
