export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * A transactional email sender. Swap providers by implementing this and
 * changing EMAIL_PROVIDER; templates and callers stay as they are.
 * Credentials are read from the server environment only.
 */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
