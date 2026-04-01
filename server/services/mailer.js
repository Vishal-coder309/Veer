const nodemailer = require('nodemailer');

// Create reusable transporter — mirrors Spring's JavaMailSender
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,       // smtp.gmail.com
  port: Number(process.env.MAIL_PORT), // 587
  secure: false,                      // false = STARTTLS (same as starttls.enable=true)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Verify connection on startup (logs warning, doesn't crash)
transporter.verify((err) => {
  if (err) console.warn('Mailer not ready:', err.message);
  else console.log('Mailer ready — SMTP connected');
});

/**
 * Send a plain/HTML email.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
const sendMail = async (to, subject, html) => {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
  });
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const welcomeEmail = (name) => ({
  subject: '🎯 Welcome to VEER — Your SSC CGL Study Tracker',
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:40px 32px;text-align:center;">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;">V</div>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Welcome to VEER!</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Your SSC CGL Study Companion</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#1e293b;font-size:16px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#475569;line-height:1.7;">Your VEER account is ready. Start tracking your preparation for <strong>SSC CGL</strong> — log study sessions, track topics, record mock test scores, and build your daily streak.</p>
        <div style="background:#eff6ff;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="color:#1e40af;font-weight:700;margin:0 0 12px;font-size:14px;">🚀 Getting started:</p>
          <ul style="color:#3b82f6;margin:0;padding-left:20px;font-size:14px;line-height:2;">
            <li>Open the <strong>Study Timer</strong> and log your first session</li>
            <li>Visit <strong>Topics</strong> to mark your syllabus progress</li>
            <li>Add a <strong>Mock Test score</strong> to start analytics</li>
          </ul>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
          VEER Study Tracker — Built for SSC CGL aspirants 🎯
        </p>
      </div>
    </div>
  `,
});

const studyReminderEmail = (name, goalMinutes, minutesStudiedToday) => ({
  subject: `⏰ Don't break your streak, ${name.split(' ')[0]}! Study reminder`,
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f97316,#ef4444);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">⏰</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Time to study, ${name.split(' ')[0]}!</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#1e293b;font-size:16px;">You've studied <strong>${minutesStudiedToday} of ${goalMinutes} minutes</strong> today.</p>
        <p style="color:#475569;line-height:1.7;">Don't break your streak — even a focused 30-minute session counts. Open VEER and start a timer now.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/study"
             style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block;">
            ▶ Start Studying Now
          </a>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
          To turn off reminders, update your notification settings in VEER.
        </p>
      </div>
    </div>
  `,
});

const weeklyReportEmail = (name, stats) => ({
  subject: `📊 Your VEER Weekly Report — ${stats.totalHours}h studied this week`,
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);padding:40px 32px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">📊</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Weekly Study Report</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">${stats.weekLabel}</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#1e293b;font-size:16px;">Great week, <strong>${name.split(' ')[0]}</strong>! Here's your summary:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;">
          ${[
            ['⏱️ Total Time', `${stats.totalHours}h ${stats.totalMinutes % 60}m`],
            ['🔥 Streak', `${stats.streak} days`],
            ['📚 Sessions', `${stats.sessions}`],
            ['✅ Topics Done', `${stats.topicsCompleted}`],
          ].map(([label, value]) => `
            <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
              <p style="font-size:20px;margin:0 0 4px;">${label.split(' ')[0]}</p>
              <p style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">${value}</p>
              <p style="font-size:12px;color:#94a3b8;margin:4px 0 0;">${label.split(' ').slice(1).join(' ')}</p>
            </div>
          `).join('')}
        </div>
        <p style="color:#475569;line-height:1.7;margin-top:20px;">Keep the momentum going into next week. Consistency beats intensity for SSC CGL preparation.</p>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
          VEER Study Tracker — Built for SSC CGL aspirants 🎯
        </p>
      </div>
    </div>
  `,
});

const dailyProgressEmail = (name, stats) => {
  const breakdownRows = Object.entries(stats.subjectBreakdown || {})
    .sort(([, a], [, b]) => b - a)
    .map(([subject, minutes]) => `
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:14px;">${subject}</td>
        <td style="padding:8px 0;color:#1e293b;font-size:14px;font-weight:700;text-align:right;">${minutes}m</td>
      </tr>
    `)
    .join('') || `
      <tr>
        <td colspan="2" style="padding:8px 0;color:#94a3b8;font-size:14px;">No session breakdown yet.</td>
      </tr>
    `;

  return {
    subject: `📈 Your VEER progress for ${stats.dateLabel}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:40px 32px;text-align:center;">
          <div style="font-size:44px;margin-bottom:8px;">📈</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Daily progress saved</h1>
          <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;">${stats.dateLabel}</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#1e293b;font-size:16px;">Nice work, <strong>${name.split(' ')[0]}</strong>. Here is today's summary:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;">
            ${[
              ['⏱️ Study Time', `${stats.totalMinutes}m`],
              ['🧩 Sessions', `${stats.sessionCount}`],
              ['🔥 Streak', `${stats.streak} days`],
              ['🎯 Goal', `${stats.goalMinutes}m`],
            ].map(([label, value]) => `
              <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
                <p style="font-size:20px;margin:0 0 4px;">${label.split(' ')[0]}</p>
                <p style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">${value}</p>
                <p style="font-size:12px;color:#94a3b8;margin:4px 0 0;">${label.split(' ').slice(1).join(' ')}</p>
              </div>
            `).join('')}
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:20px;">
            <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;">Subject breakdown</p>
            <table width="100%" cellspacing="0" cellpadding="0">${breakdownRows}</table>
          </div>
          <p style="color:#475569;line-height:1.7;margin-top:20px;">Keep the rhythm going. Small daily sessions add up fast.</p>
          <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">VEER Study Tracker — Built for SSC CGL aspirants 🎯</p>
        </div>
      </div>
    `,
  };
};

// ─── OTP Verification Email ───────────────────────────────────────────────────

const otpEmail = (email, otp) => ({
  subject: `${otp} is your VEER verification code`,
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:36px 32px;text-align:center;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin:0 auto 14px;line-height:56px;font-size:28px;font-weight:900;color:#fff;">V</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Verify your email</h1>
      </div>
      <div style="padding:32px;text-align:center;">
        <p style="color:#475569;font-size:15px;margin:0 0 24px;">
          Use the code below to verify <strong>${email}</strong>
        </p>
        <div style="display:inline-block;background:#1e3a8a;color:#fff;font-size:40px;font-weight:900;letter-spacing:12px;padding:20px 36px;border-radius:16px;font-family:monospace;">
          ${otp}
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">
          This code expires in <strong>5 minutes</strong>.<br/>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `,
});

const motivationEmail = (name) => ({
  subject: `💪 You've got this, ${name.split(' ')[0]}! — VEER`,
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#18181b,#3f3f46);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">💪</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">It's okay to take a break</h1>
        <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:14px;">But remember — your dream is waiting</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#1e293b;font-size:16px;">Hi <strong>${name.split(' ')[0]}</strong>,</p>
        <p style="color:#475569;line-height:1.8;">You've marked today as a rest day. That's completely fine — rest is part of the journey. But here's a reminder of why you started:</p>
        <div style="background:#18181b;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
          <p style="color:#a1a1aa;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Today's Motivation</p>
          <p style="color:#fff;font-size:18px;font-weight:600;line-height:1.6;margin:0;">"Success is the sum of small efforts, repeated day in and day out."</p>
          <p style="color:#71717a;font-size:13px;margin:12px 0 0;">— Robert Collier</p>
        </div>
        <p style="color:#475569;line-height:1.8;">SSC CGL is competitive. Every day matters. Come back tomorrow stronger — open VEER and log even 30 minutes.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/log"
             style="background:#18181b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block;">
            📖 Plan Tomorrow's Study
          </a>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
          VEER Study Tracker — Built for SSC CGL aspirants 🎯
        </p>
      </div>
    </div>
  `,
});

module.exports = {
  sendMail,
  otpEmail,
  welcomeEmail,
  studyReminderEmail,
  weeklyReportEmail,
  motivationEmail,
  dailyProgressEmail,
};
