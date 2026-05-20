# interview-mailer backend

Local Node.js backend that stores the email queue, template, and resume, and runs a cron that auto-sends pending emails at the user-configured time each day.

## Run

```bash
npm install
npm run dev
```

Server boots on `http://0.0.0.0:4000`. On startup it prints the LAN IPs the mobile app should connect to. Override with `PORT=5000 npm run dev` if needed.

## Endpoints

- `GET  /health`
- `GET  /settings` / `PUT /settings` (smtp_user, smtp_pass, sender_name, send_time HH:MM, timezone)
- `DELETE /settings/smtp-pass` (clear stored password)
- `GET  /template` / `PUT /template` (subject, body)
- `POST /resume` (multipart, field name `resume`) / `DELETE /resume`
- `GET  /emails?status=pending|sent|failed` / `POST /emails` (email, company, role) / `DELETE /emails/:id` / `POST /emails/:id/reset`
- `GET  /history` / `DELETE /history`
- `POST /run` (manually trigger the queue — useful for testing)

## Dry-run mode

If `smtp_user` or `smtp_pass` is empty, the cron and `/run` log `[DRY RUN]` and mark pending rows as `sent` with `mode='dry_run'` in history. Real sending kicks in once both fields are set.

## Cron

Runs every minute, compares current `HH:MM` in the configured timezone (default `Asia/Kolkata`) against `send_time`, and processes the queue **once per day** (guarded by `last_run_date`).
