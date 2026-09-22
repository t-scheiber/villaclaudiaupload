import nodemailer from 'nodemailer';
import { validToken } from './wordpress';

export function validateEmailConfiguration() {
  for (const field of ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD']) {
    if (!process.env[field]) throw new Error('Email service is not configured.');
  }
  const port = Number(process.env.EMAIL_PORT || '587');
  if (![465, 587].includes(port)) throw new Error('SMTP requires port 465 or 587.');
  const publicUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL || '');
  if (publicUrl.protocol !== 'https:') throw new Error('A secure public application URL is required.');
}
export function createEmailTransporter() {
  validateEmailConfiguration();
  const port = Number(process.env.EMAIL_PORT || '587');
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    tls: { rejectUnauthorized: true },
    debug: false, logger: false, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
  });
}
export async function sendDocumentRequestEmail(uploadToken: string, guestEmail: string, guestName: string, checkInDate: Date): Promise<{ success: boolean; uncertain?: boolean }> {
  if (!validToken(uploadToken)) throw new Error('Invalid upload token.');
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  let publicUrl: URL;
  try { publicUrl = new URL(base || ''); }
  catch { throw new Error('A secure public application URL is required.'); }
  if (publicUrl.protocol !== 'https:') throw new Error('A secure public application URL is required.');
  const uploadUrl = `${publicUrl.toString().replace(/\/$/, '')}/uploads/${uploadToken}`;
  const transporter = createEmailTransporter();
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Villa Claudia <administration@villa-claudia.eu>',
      to: guestEmail,
      subject: 'Please Upload Your Travel Documents for Your Stay at Villa Claudia',
      text: `Dear ${guestName},\n\nYour stay at Villa Claudia starts on ${checkInDate.toLocaleDateString('en-GB', { timeZone: 'Europe/Zagreb' })}. Please use your personal link to upload documents for all travelers:\n\n${uploadUrl}\n\nKeep this link private. It grants access to your booking's document form.\n\nIf you have questions, contact info@villa-claudia.eu.\n\nVilla Claudia Team`,
    });
    return { success: Boolean(info.accepted?.length) };
  } catch (error) {
    console.error('Document reminder email was not accepted.');
    const failure = error as { code?: string; command?: string; responseCode?: number };
    const rejected = typeof failure.responseCode === 'number' && failure.responseCode >= 400;
    const beforeDelivery = ['EAUTH', 'EDNS', 'ECONNECTION'].includes(failure.code || '') ||
      ['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO'].includes(failure.command || '');
    return { success: false, uncertain: !(rejected || beforeDelivery) };
  }
}
