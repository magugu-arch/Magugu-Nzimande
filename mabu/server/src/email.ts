/**
 * Email delivery over SMTP, which every provider Mábu is likely to choose
 * speaks (Google Workspace, Microsoft 365, SendGrid, Mailgun, Amazon SES,
 * Postmark, Brevo…). Configure with:
 *
 *   MABU_SMTP_URL    smtps://user:password@smtp.example.com:465
 *   MABU_EMAIL_FROM  "Mábu Restaurant <reservations@maburestaurant.com>"
 */
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailSender } from './auth';

export class SmtpEmailSender implements EmailSender {
  constructor(
    private readonly transport: Transporter,
    private readonly from: string,
  ) {}

  static fromUrl(url: string, from: string): SmtpEmailSender {
    return new SmtpEmailSender(nodemailer.createTransport(url), from);
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    // Header injection is refused rather than escaped: none of our subjects need a newline.
    if (/[\r\n]/.test(subject) || /[\r\n,;]/.test(to)) throw new Error('refused unsafe header');
    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html: toHtml(subject, text),
    });
  }
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A quiet branded HTML part: obsidian, ivory and brass, one column. */
export function toHtml(subject: string, text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#0B0B0B;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#1A1A1A;border:1px solid #2a2a2a;border-radius:12px;padding:32px;color:#E8E1D6;font-size:15px;line-height:1.55">
<div style="font-family:Georgia,serif;font-size:24px;letter-spacing:6px;color:#C9A35B;margin-bottom:24px">MÁBU</div>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:20px;margin:0 0 16px;color:#E8E1D6">${escape(subject)}</h1>
${paragraphs}
<p style="margin:24px 0 0;font-size:12px;color:#B7AEA4">Mábu Restaurant · Waterfall Wilds, Midrand</p>
</div></body></html>`;
}
