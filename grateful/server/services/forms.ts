import { config } from '../config';
import { repository } from '../db';
import { sendSafely } from '../email/providers';
import { contactNotificationStudio, newsletterWelcome } from '../email/templates';
import { sanitizeText } from '../security';

export async function submitContact(input: { name: string; email: string; phone: string; subject: string; message: string }) {
  const msg = {
    name: sanitizeText(input.name),
    email: input.email,
    phone: sanitizeText(input.phone),
    subject: sanitizeText(input.subject),
    message: sanitizeText(input.message),
  };
  // Stored first: if email is down, the enquiry is still on record.
  await repository().addContactMessage(msg);
  const { siteUrl, studioEmail } = config();
  await sendSafely([contactNotificationStudio(siteUrl, msg, studioEmail)]);
}

export async function subscribe(email: string, consent: boolean) {
  const { created } = await repository().addSubscriber(email, consent);
  // Only welcome someone once, however many times they submit.
  if (created) await sendSafely([newsletterWelcome(config().siteUrl, email)]);
}
