require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error("Usage: node mailer.js <email_address>");
  process.exit(1);
}

if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
  console.error("Error: Missing SMTP credentials.");
  process.exit(1);
}

const HTML_TEMPLATE = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #2a2a2a; line-height: 1.75; max-width: 600px;">
  <p style="margin-bottom: 16px;">Hi team,</p>
  <p style="margin-bottom: 16px;">Quick question — when a new patient calls your office at 8 PM on a Tuesday, what happens?</p>
  <p style="margin-bottom: 16px;">For most dental practices, it goes to voicemail. And <strong style="color: #000;">80% of callers who hit voicemail don't leave a message</strong> — they call the next practice on Google instead.</p>
  <p style="margin-bottom: 16px;">I built something that fixes this.</p>
  <p style="margin-bottom: 16px;"><strong style="color: #000;">AgentFlo</strong> is an AI receptionist that answers your phone after hours, knows your services, hours, insurance, and team — and captures every caller's info so your front desk can follow up first thing in the morning.</p>
  <div style="background-color: #f0fdf4; border-left: 3px solid #22c55e; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 14px; color: #166534; line-height: 1.7;">
    <strong style="color: #166534;">Here's what it does:</strong><br>
    ✓ Answers calls 24/7 — nights, weekends, holidays<br>
    ✓ Handles scheduling, insurance questions, directions, anxiety concerns<br>
    ✓ Sends your team an instant lead notification with patient details<br>
    ✓ Sounds like a real, friendly receptionist — not a robot
  </div>
  <p style="margin-bottom: 16px;">I'd love to build a <strong style="color: #000;">free demo agent trained on your clinic's actual info</strong> — your hours, services, everything — so you can hear exactly how it sounds.</p>
  <p style="margin-bottom: 16px;">Takes 90 seconds to listen. No commitment. Interested?</p>
  <a href="mailto:admin@agentflo.dev" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; margin: 8px 0 16px;">→ Reply to get your free demo</a>
  <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 14px; color: #555; line-height: 1.6;">
    <span style="font-weight: 700; color: #1a1a1a; font-size: 15px;">Shubham Patil</span><br>
    Founder, AgentFlo<br>
    <a href="https://agentflo.dev" style="color: #22c55e; text-decoration: none; font-weight: 600;">agentflo.dev</a>
  </div>
`;

// --- PAYLOAD RANDOMIZATION ---
// Generate a unique tracking ID and append it visibly but inconspicuously to bypass spam filters checking identical HTML hashes
const uniqueId = crypto.randomUUID();
const uniqueTimestamp = new Date().toISOString();
const hiddenJitterHtml = `
  <div style="font-size: 10px; color: #fdfdfd; user-select: none;">
    Ref: ${uniqueId}-${uniqueTimestamp}
  </div>
</div>
`;

const FINAL_HTML = HTML_TEMPLATE + hiddenJitterHtml;

async function sendSingleEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    pool: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("ABSOLUTE SCRIPT TIMEOUT EXCEEDED")), 30000);
    });

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: targetEmail,
      subject: "Don't Let 80% of After-Hours Callers Go to the Next Dentist on Google",
      html: FINAL_HTML,
    };

    const sendPromise = transporter.sendMail(mailOptions);
    const info = await Promise.race([sendPromise, timeoutPromise]);
    
    console.log(`[${new Date().toISOString()}] Successfully sent to ${targetEmail} (Message ID: ${info.messageId})`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to send to ${targetEmail}:`, error.message);
    process.exit(1);
  } finally {
    transporter.close();
  }
}

sendSingleEmail();
