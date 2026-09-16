// Outgoing email over SMTP (any provider: Gmail app password, Yandex, Brevo, Mailgun, ...).
import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST || "";
const PORT = Number(process.env.SMTP_PORT) || 587;
const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "";

const transport = HOST && FROM
  ? nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = implicit TLS; 587/25 upgrade with STARTTLS
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
  })
  : null;

export const mailEnabled = () => !!transport;

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function sendResetEmail(to, name, link) {
  const hi = name ? `Salom, ${name}!` : "Salom!";
  return transport.sendMail({
    from: FROM,
    to,
    subject: "UpKorean — parolni tiklash",
    text: `${hi}\n\nUpKorean hisobingiz parolini tiklash uchun havola:\n${link}\n\nHavola 30 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring — parolingiz o'zgarmaydi.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:480px">
      <p>${escHtml(hi)}</p>
      <p>UpKorean hisobingiz parolini tiklash uchun quyidagi tugmani bosing:</p>
      <p><a href="${escHtml(link)}" style="display:inline-block;padding:12px 22px;background:#D88B3F;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">Parolni tiklash</a></p>
      <p style="color:#666;font-size:13px">Havola 30 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring — parolingiz o'zgarmaydi.</p>
    </div>`,
  });
}
