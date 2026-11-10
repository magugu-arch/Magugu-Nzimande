import { notificationSchema, type AppNotification } from '@kc-one/contracts';

/** Sample inbox entries that show categories, read state and deep links. */
export const demoNotifications: AppNotification[] = (
  [
    [
      'demo-n-1',
      'matchday',
      'Line-ups will appear here',
      'When the match feed is connected, matchday alerts open the Match Centre.',
      '/match',
    ],
    [
      'demo-n-2',
      'fan_moments',
      'Your moment is being reviewed',
      'Moderation updates land here once Fan Moments is connected.',
      '/fan/mine',
    ],
    [
      'demo-n-3',
      'club_news',
      'A sample club story',
      'News alerts open the story they are about.',
      '/news/demo-matchday-guide',
    ],
    [
      'demo-n-4',
      'rewards',
      'Khosi Rewards',
      'Reward alerts will open the rewards catalogue.',
      '/rewards',
    ],
  ] as const
).map(([id, category, title, body, deepLink], i) =>
  notificationSchema.parse({
    id,
    category,
    title,
    body,
    deepLink,
    createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    readAt: null,
    isDemo: true,
  }),
);
