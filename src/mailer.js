const fs = require('fs');
const { google } = require('googleapis');
const { db } = require('./db');

function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

function getTemplate() {
  return db.prepare('SELECT * FROM template WHERE id = 1').get();
}

function getOAuthClient(settings) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://interview-mailer-backend.onrender.com/auth/google/callback'
  );
  client.setCredentials({
    access_token: settings.google_access_token,
    refresh_token: settings.google_refresh_token,
  });
  // persist refreshed tokens automatically
  client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      db.prepare("UPDATE settings SET google_access_token=? WHERE id=1").run(tokens.access_token);
    }
  });
  return client;
}

function buildRawEmail({ from, to, subject, body, attachmentPath, attachmentName }) {
  const boundary = 'boundary_' + Date.now();
  const hasAttachment = attachmentPath && fs.existsSync(attachmentPath);

  let raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (hasAttachment) {
    raw.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    raw.push('');
    raw.push(`--${boundary}`);
    raw.push('Content-Type: text/plain; charset=utf-8');
    raw.push('');
    raw.push(body);
    raw.push('');
    raw.push(`--${boundary}`);
    const fileContent = fs.readFileSync(attachmentPath).toString('base64');
    const filename = attachmentName || 'resume.pdf';
    raw.push(`Content-Type: application/octet-stream; name="${filename}"`);
    raw.push(`Content-Disposition: attachment; filename="${filename}"`);
    raw.push('Content-Transfer-Encoding: base64');
    raw.push('');
    raw.push(fileContent);
    raw.push('');
    raw.push(`--${boundary}--`);
  } else {
    raw.push('Content-Type: text/plain; charset=utf-8');
    raw.push('');
    raw.push(body);
  }

  const rawStr = raw.join('\r\n');
  return Buffer.from(rawStr).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendOne({ to, subject, body, attachmentPath, attachmentName, settings }) {
  const auth = getOAuthClient(settings);
  const gmail = google.gmail({ version: 'v1', auth });

  const from = settings.sender_name
    ? `"${settings.sender_name}" <${settings.google_email}>`
    : settings.google_email;

  const raw = buildRawEmail({ from, to, subject, body, attachmentPath, attachmentName });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

async function processQueue() {
  const settings = getSettings();
  const template = getTemplate();
  const pending = db.prepare("SELECT * FROM emails WHERE status = 'pending'").all();

  if (pending.length === 0) {
    return { processed: 0, mode: 'noop', results: [] };
  }

  const dryRun = !settings.google_refresh_token;
  const mode = dryRun ? 'dry_run' : 'real';
  const results = [];

  const markSent = db.prepare("UPDATE emails SET status='sent', sent_at=datetime('now') WHERE id=?");
  const markFailed = db.prepare("UPDATE emails SET status='failed' WHERE id=?");
  const insertHistory = db.prepare(`
    INSERT INTO history (email_id, email, company, role, status, mode, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of pending) {
    if (dryRun) {
      console.log(`[DRY RUN] Would send to ${row.email}`);
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
        settings,
      });
      markSent.run(row.id);
      insertHistory.run(row.id, row.email, row.company, row.role, 'sent', 'real', '');
      results.push({ email: row.email, status: 'sent', mode: 'real' });
      console.log(`[SENT] ${row.email}`);
    } catch (err) {
      const msg = err?.message || String(err);
      markFailed.run(row.id);
      insertHistory.run(row.id, row.email, row.company, row.role, 'failed', 'real', msg);
      results.push({ email: row.email, status: 'failed', mode: 'real', error: msg });
      console.error(`[FAIL] ${row.email}: ${msg}`);
    }
  }

  return { processed: results.length, mode, results };
}

module.exports = { processQueue, getSettings, getTemplate };
