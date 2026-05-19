const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

async function sendEmail({ to, subject, text }) {
  const from = process.env.EMAIL_FROM || "no-reply@atomquest.local";
  const transport = getTransporter();
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return { skipped: true };

  if (!transport) {
    console.log("[email skipped]", { to: recipients, subject });
    return { skipped: true };
  }

  await transport.sendMail({
    from,
    to: recipients.join(","),
    subject,
    text,
  });

  return { sent: true };
}

module.exports = { sendEmail };
