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

const motivationVariants = [
  {
    icon: '💪',
    title: "It's okay to take a break",
    subtitle: 'Rest today, reset tomorrow',
    intro: "You've marked today as a rest day. That is completely fine. Rest is part of long-term consistency.",
    quote: 'Success is the sum of small efforts, repeated day in and day out.',
    author: 'Robert Collier',
    outro: 'SSC CGL is competitive. Come back tomorrow stronger and log even 30 minutes.',
    cta: "📖 Plan Tomorrow's Study",
    ctaPath: '/log',
  },
  {
    icon: '🔥',
    title: 'Momentum starts small',
    subtitle: 'One focused session can restart your streak',
    intro: 'A skipped day does not define your prep. What matters is the next honest effort.',
    quote: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    author: 'James Clear',
    outro: 'Make tomorrow simple: choose one topic, set one timer, and begin.',
    cta: '▶ Start with 30 Minutes',
    ctaPath: '/study',
  },
  {
    icon: '🎯',
    title: 'Your target is still in sight',
    subtitle: 'A single day never decides the final result',
    intro: 'Every aspirant has off days. The difference is returning quickly with intention.',
    quote: 'It always seems impossible until it is done.',
    author: 'Nelson Mandela',
    outro: 'Tomorrow, pick your toughest subject first and build confidence early.',
    cta: '🗂 Set Tomorrow Plan',
    ctaPath: '/log',
  },
  {
    icon: '📈',
    title: 'Progress is not linear',
    subtitle: 'Consistency wins over perfection',
    intro: 'Missing one day is normal. Missing many starts a pattern. Break the pattern early.',
    quote: 'Small disciplines repeated with consistency every day lead to great achievements.',
    author: 'John C. Maxwell',
    outro: 'Get back in rhythm with a short revision session and one practice set.',
    cta: '✅ Commit for Tomorrow',
    ctaPath: '/log',
  },
  {
    icon: '⚡',
    title: 'Action beats overthinking',
    subtitle: 'Start before you feel fully ready',
    intro: 'A low-energy day can still hold a small win. Even 20 focused minutes count.',
    quote: 'Do what you can, with what you have, where you are.',
    author: 'Theodore Roosevelt',
    outro: 'Tomorrow, begin with a timer and let momentum do the rest.',
    cta: '⏱ Start Study Timer',
    ctaPath: '/study',
  },
  {
    icon: '🏆',
    title: 'Discipline builds confidence',
    subtitle: 'Each comeback makes you stronger',
    intro: 'Today may be light, but your goal is still alive. Restarting quickly is a superpower.',
    quote: 'Success is nothing more than a few simple disciplines, practiced every day.',
    author: 'Jim Rohn',
    outro: 'Show up tomorrow, even for a short session. That is how streaks are rebuilt.',
    cta: '📚 Resume Preparation',
    ctaPath: '/study',
  },
];

const motivationVariantCount = motivationVariants.length;

const getMotivationVariantByIndex = (variantIndex = 0) => {
  const normalizedIndex = ((variantIndex % motivationVariants.length) + motivationVariants.length) % motivationVariants.length;
  return motivationVariants[normalizedIndex];
};

const getMotivationVariant = (name, dateSeed = new Date()) => {
  const firstName = (name || 'there').split(' ')[0];
  const date = new Date(dateSeed);
  const utcStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const utcCurrent = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.floor((utcCurrent - utcStart) / (24 * 60 * 60 * 1000));
  const nameHash = firstName.toLowerCase().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const index = (dayOfYear + nameHash) % motivationVariants.length;
  return motivationVariants[index];
};

const motivationEmail = (name, options = {}) => {
  const firstName = (name || 'there').split(' ')[0];

  let variant;
  if (typeof options === 'number') {
    variant = getMotivationVariantByIndex(options);
  } else if (options && Number.isInteger(options.variantIndex)) {
    variant = getMotivationVariantByIndex(options.variantIndex);
  } else {
    const dateSeed = options?.dateSeed || new Date();
    variant = getMotivationVariant(firstName, dateSeed);
  }

  return {
    subject: `${variant.icon} Keep going, ${firstName}! — VEER`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#18181b,#3f3f46);padding:40px 32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">${variant.icon}</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">${variant.title}</h1>
          <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:14px;">${variant.subtitle}</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#1e293b;font-size:16px;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#475569;line-height:1.8;">${variant.intro}</p>
          <div style="background:#18181b;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
            <p style="color:#a1a1aa;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Today's Motivation</p>
            <p style="color:#fff;font-size:18px;font-weight:600;line-height:1.6;margin:0;">"${variant.quote}"</p>
            <p style="color:#71717a;font-size:13px;margin:12px 0 0;">- ${variant.author}</p>
          </div>
          <p style="color:#475569;line-height:1.8;">${variant.outro}</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}${variant.ctaPath}"
               style="background:#18181b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block;">
              ${variant.cta}
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
            VEER Study Tracker - Built for SSC CGL aspirants 🎯
          </p>
        </div>
      </div>
    `,
  };
};

const dailyNudgeEmail = (name) => ({
  subject: `🔥 Stay consistent today, ${name.split(' ')[0]}! — VEER`,
  html: `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">🔥</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">A small session today makes a big difference</h1>
        <p style="color:rgba(255,255,255,0.65);margin:8px 0 0;font-size:14px;">Consistency beats intensity for SSC CGL</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#1e293b;font-size:16px;">Hi <strong>${name.split(' ')[0]}</strong>,</p>
        <p style="color:#475569;line-height:1.8;">Quick motivation for today: start with just 30 focused minutes. Once you begin, momentum takes over.</p>
        <div style="background:#0f172a;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
          <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Today's Push</p>
          <p style="color:#fff;font-size:18px;font-weight:600;line-height:1.6;margin:0;">"You do not rise to the level of your goals. You fall to the level of your systems."</p>
          <p style="color:#64748b;font-size:13px;margin:12px 0 0;">— James Clear</p>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/study"
             style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block;">
            ▶ Start Study Session
          </a>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
          VEER Study Tracker — Built for SSC CGL aspirants
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
  motivationVariantCount,
  dailyNudgeEmail,
  dailyProgressEmail,
};
