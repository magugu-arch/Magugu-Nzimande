import { showContentFlags, type Approval } from '@/content';
import styles from './ui.module.css';

const LABEL: Record<Exclude<Approval, 'approved'>, string> = {
  pending: 'Copy pending approval',
  placeholder: 'Placeholder — awaiting supplied content',
};

/**
 * Marks content that management has not signed off, so a placeholder can
 * never be mistaken for the real thing in review. Hidden entirely in
 * production launch mode, where unapproved entries do not render at all.
 */
export function ApprovalFlag({ approval, label, className }: { approval: Approval; label?: string; className?: string }) {
  if (approval === 'approved' || !showContentFlags()) return null;
  return (
    <span className={[styles.flag, className].filter(Boolean).join(' ')} data-approval={approval}>
      {label ?? LABEL[approval]}
    </span>
  );
}
