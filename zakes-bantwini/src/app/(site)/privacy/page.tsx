import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Privacy',
  description: 'How the Zakes Bantwini website handles personal information.',
  path: '/privacy',
});

/*
 * A plain-language notice describing what this build actually does with
 * data. It is a starting point for management's legal adviser (POPIA), not
 * legal advice — hence the pending flag.
 */
export default function PrivacyPage() {
  return (
    <div className="container section" style={{ paddingTop: 'calc(var(--header-h) + 64px)' }}>
      <div className={styles.prose}>
        <p className="eyebrow eyebrow-accent">Privacy notice</p>
        <h1 className="display display-m">Your information</h1>
        <ApprovalFlag approval="pending" label="Draft — for review by management’s legal adviser" />
        <p>This website collects personal information only when you give it to us, and uses it only for the reason you gave it.</p>
        <h2>Booking requests</h2>
        <p>
          Your name, organisation, contact details and event details are used by management to review your request, prepare a quote and agreement, take payment
          and deliver the event. Uploaded event briefs are stored privately and opened only by management.
        </p>
        <h2>Payments</h2>
        <p>Card payments are processed by a third-party payment provider on its own secure pages. Card details are never sent to, or stored by, this website.</p>
        <h2>Community and collaboration</h2>
        <p>
          If you join the community, we keep your email (and mobile number, if you choose WhatsApp) with the exact wording you agreed to. You can unsubscribe or reply
          STOP at any time. Collaboration proposals are read by the team and used only to respond.
        </p>
        <h2>Analytics</h2>
        <p>We measure how the site is used (for example, that a booking was started) without recording names, emails or phone numbers in analytics.</p>
        <h2>Your rights</h2>
        <p>You may ask to see, correct or delete the information we hold about you by replying to any email we have sent, or through the booking team.</p>
      </div>
    </div>
  );
}
