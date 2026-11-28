import styles from './admin.module.css';

const map: Record<string, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: styles.stGo! },
  pending_payment: { label: 'Awaiting payment', tone: styles.stWarn! },
  held: { label: 'Held', tone: styles.stWarn! },
  cancelled: { label: 'Cancelled', tone: '' },
  expired: { label: 'Expired', tone: '' },
  refunded: { label: 'Refunded', tone: styles.stStop! },
  new: { label: 'New', tone: styles.stInfo! },
  replied: { label: 'Replied', tone: styles.stGo! },
  closed: { label: 'Closed', tone: '' },
  open: { label: 'Open', tone: styles.stInfo! },
  requested: { label: 'Requested', tone: styles.stWarn! },
  confirmed: { label: 'Confirmed', tone: styles.stGo! },
  declined: { label: 'Declined', tone: '' },
  active: { label: 'Active', tone: styles.stGo! },
  redeemed: { label: 'Used', tone: '' },
  void: { label: 'Void', tone: styles.stStop! },
  pending: { label: 'Pending', tone: styles.stWarn! },
  draft: { label: 'Draft', tone: '' },
  published: { label: 'Published', tone: styles.stGo! },
  sent: { label: 'Sent', tone: styles.stGo! },
  simulated: { label: 'Simulated', tone: styles.stInfo! },
  failed: { label: 'Failed', tone: styles.stStop! },
};

/** One badge vocabulary for every status in the console. */
export function StatusBadge({ status }: { status: string }) {
  const m = map[status] ?? { label: status.replace(/_/g, ' '), tone: '' };
  return <span className={`${styles.st} ${m.tone}`}>{m.label}</span>;
}
