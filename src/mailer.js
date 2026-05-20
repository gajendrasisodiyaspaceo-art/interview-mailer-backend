const fs = require('fs');
const { Resend } = require('resend');
const { db } = require('./db');

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function getTemplate() {
  return db.prepare('SELECT * FROM template WHERE id = 1').get();
}

async function sendOne({ to, subject, body, attachmentPath, attachmentName, fromUser, fromName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const resend = new Resend(apiKey);

  const fromLabel = fromName ? `${fromName} <${fromUser}>` : fromUser;

  const payload = {
    from: fromLabel,
    to: [to],
    subject,
    text: body,
    reply_to: fromUser,
  };

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const content = fs.readFileSync(attachmentPath).toString('base64');
    payload.attachments = [
      {
        filename: attachmentName || 'resume.pdf',
        content,
      },
    ];
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

async function processQueue({ force = false } = {}) {
  const settings = getSettings();
  const template = getTemplate();
  const pending = db.prepare("SELECT * FROM emails WHERE status = 'pending'").all();

  if (pending.length === 0) {
    return { processed: 0, mode: 'noop', results: [] };
  }

  const hasResend = !!process.env.RESEND_API_KEY;
  const dryRun = !settings.smtp_user || !hasResend;
  const mode = dryRun ? 'dry_run' : 'real';
  const results = [];

  const markSent = db.prepare("UPDATE emails SET status = 'sent', sent_at = datetime('now') WHERE id = ?");
  const markFailed = db.prepare("UPDATE emails SET status = 'failed' WHERE id = ?");
  const insertHistory = db.prepare(`
    INSERT INTO history (email_id, email, company, role, status, mode, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of pending) {
    if (dryRun) {
      console.log(`[DRY RUN] Would have sent to ${row.email} (${row.company || 'no company'})`);
      markSent.run(row.id);
      insertHistory.run(row.id, row.email, row.company, row.role, 'sent', 'dry_run', '');
      results.push({ email: row.email, status: 'sent', mode: 'dry_run' });
      continue;
    }

    try {
      await sendOne({
        to: row.email,
        subject: template.subject,
        body: template.body,
        attachmentPath: template.resume_path,
        attachmentName: template.resume_original_name,
        fromUser: settings.smtp_user,
        fromName: settings.sender_name,
      });
      markSent.run(row.id);
      insertHistory.run(row.id, row.email, row.company, row.role, 'sent', 'real', '');
      results.push({ email: row.email, status: 'sent', mode: 'real' });
      console.log(`[SENT] ${row.email}`);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      markFailed.run(row.id);
      insertHistory.run(row.id, row.email, row.company, row.role, 'failed', 'real', msg);
      results.push({ email: row.email, status: 'failed', mode: 'real', error: msg });
      console.error(`[FAIL] ${row.email}: ${msg}`);
    }
  }

  return { processed: results.length, mode, results };
}

module.exports = { processQueue, getSettings, getTemplate };
