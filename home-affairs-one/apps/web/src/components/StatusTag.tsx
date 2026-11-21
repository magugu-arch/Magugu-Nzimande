import { Tag } from '@hao/design-system';
import { STATUS_INFO, type StatusFamily } from '@hao/shared-types';
import { CircleCheck, CircleDot, Clock3, TriangleAlert } from 'lucide-react';

const ICON = {
  neutral: <CircleDot aria-hidden="true" />,
  info: <Clock3 aria-hidden="true" />,
  attention: <TriangleAlert aria-hidden="true" />,
  success: <CircleCheck aria-hidden="true" />,
  danger: <TriangleAlert aria-hidden="true" />,
} as const;

/**
 * An application's status as a tag. `detail` is the short state within the
 * family ("In production"); without it the family's own label is shown. Tone
 * is always paired with words and an icon, never colour alone.
 */
export function StatusTag({ status, detail }: { status: StatusFamily; detail?: string }) {
  const info = STATUS_INFO[status];
  return (
    <Tag tone={info.tone} icon={ICON[info.tone]}>
      {detail ?? info.userLabel}
    </Tag>
  );
}
