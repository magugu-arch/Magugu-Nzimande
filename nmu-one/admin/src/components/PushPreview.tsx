import type { NotificationPriority } from '@core/domain/models';
import { formatTime } from '@core/time/sast';

/** How the notice will look on a lock screen and in the NMU ONE inbox. */
export function PushPreview({
  title,
  body,
  actionLabel,
  priority,
  at,
}: {
  title: string;
  body: string;
  actionLabel: string;
  priority: NotificationPriority;
  at: string;
}) {
  const emergency = priority === 'emergency';
  return (
    <figure className="phone-preview" aria-label="Lock-screen preview" style={{ margin: 0 }}>
      <div className="lock-time" aria-hidden="true">
        {formatTime(at)}
      </div>
      <div className={`push-card${emergency ? ' emergency' : ''}`}>
        <div className="push-app">
          <span>NMU ONE{emergency ? ' · EMERGENCY' : ''}</span>
          <span>now</span>
        </div>
        <span className="push-title">{title || 'Your title appears here'}</span>
        <span>{body || 'Your message appears here.'}</span>
        {actionLabel ? <span className="push-action">{actionLabel} →</span> : null}
      </div>
    </figure>
  );
}
