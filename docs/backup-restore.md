# Backup And Restore

This document describes the recommended PostgreSQL backup strategy for this project.

## Direction

The preferred approach is:

- use `pg_dump -Fc` (custom format)
- run backups automatically every day
- keep the scheduler outside the NestJS app
- store backups in a separate location, ideally a dedicated GCS backup bucket
- retain multiple backup versions
- test restore periodically

This is closer to how production systems are usually operated than manual-only backup workflows.

## Why `pg_dump -Fc`

Compared with plain `.sql` dumps, `pg_dump -Fc` is more suitable for operational backup:

- smaller backup files
- better restore flexibility with `pg_restore`
- more professional and production-oriented workflow
- easier to evolve into scheduled backup and retention policies

Recommended output:

- file extension: `.dump`

## Recommended Operating Model

Use two modes together:

1. Scheduled backup
- run automatically once per day
- use Windows Task Scheduler, cron, Kubernetes CronJob, CI scheduler, or cloud scheduler
- do not depend on the NestJS process being alive

2. Manual backup
- keep a command for on-demand backup
- use it before risky database changes, major deploys, or migrations

## Why The Scheduler Should Be Outside The App

Do not make the main NestJS server responsible for daily backup timing.

Reasons:

- backup is an operations concern, not request/response business logic
- if the app is down, in-app scheduling also stops
- external schedulers are easier to observe and reason about
- this matches how larger teams usually separate application logic from operations jobs

## Recommended Frequency

For this project, a practical starting point is:

- daily backup: 1 time per day
- optional pre-deploy backup: manual

If the system becomes more important later, you can extend to:

- daily backups
- weekly retained backups
- monthly retained backups

## Storage Recommendation

Use two storage layers:

1. Local temporary backup output
- write the backup file locally first

2. Remote backup storage
- upload the backup to a dedicated GCS bucket
- do not mix database backups with the main document bucket if possible

Recommended:

- document bucket: for application files
- backup bucket: for database dumps

## Retention Recommendation

A simple and reasonable policy:

- keep 7 daily backups
- optionally keep 4 weekly backups
- optionally keep 3 monthly backups

At minimum, keep enough history to recover from:

- accidental deletion
- bad migration
- unnoticed data corruption discovered a few days later

## Restore Requirement

A backup is only useful if restore works.

The project should always include:

- a documented restore procedure
- a test restore on a non-production database from time to time

## Environment

Database:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_NAME=chatbot
```

If `pg_dump` is not in PATH:

```env
PG_DUMP_PATH=C:/Program Files/PostgreSQL/17/bin/pg_dump.exe
```

If backups are uploaded to GCS:

```env
BACKUP_GCS_BUCKET=your-backup-bucket
BACKUP_GCS_PREFIX=backups/postgres
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILENAME=E:/path/to/service-account.json
```

## Backup Command

Current command:

```bash
npm run backup:postgres
```

Recommended final behavior for this command:

- run `pg_dump -Fc`
- generate a `.dump` file
- store it under `backups/postgres/`
- optionally upload it to GCS

## Restore Command

For custom-format backups, restore should use `pg_restore`:

```bash
pg_restore -h localhost -p 5432 -U postgres -d chatbot backup.dump
```

If restoring into a fresh database, the common sequence is:

1. create target database
2. run `pg_restore`
3. validate tables and key business data

## Practical Recommendation For This Project

The recommended next implementation steps are:

1. Change the backup script from plain SQL output to `pg_dump -Fc`
2. Add a restore script using `pg_restore`
3. Keep manual execution available
4. Add daily scheduled execution outside the app
5. Store backups in a separate GCS backup bucket

## Summary

For a more professional design, this project should use:

- `pg_dump -Fc`
- scheduled daily backups outside the NestJS server
- manual backup on demand
- separate backup storage
- retention policy
- restore testing
