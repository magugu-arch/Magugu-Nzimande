import type { ContentType, Topic } from './types';

/** Brief §6, Learn: the topic taxonomy. */
export const topics: Record<Topic, { label: string; description: string }> = {
  'offers-value': {
    label: 'Offers & Value',
    description: 'Building offers people want, and communicating their value honestly.',
  },
  'sales-closing': {
    label: 'Sales & Closing',
    description: 'Leading sales conversations with conviction instead of pressure.',
  },
  'business-growth': {
    label: 'Business Growth',
    description: 'Strategy for growing a business that serves its customers well.',
  },
  entrepreneurship: {
    label: 'Entrepreneurship',
    description: 'The habits, decisions and discipline of building something of your own.',
  },
  'money-stewardship': {
    label: 'Money & Stewardship',
    description: 'Handling money wisely, as something entrusted rather than owned.',
  },
  'faith-purpose': {
    label: 'Faith & Purpose',
    description: 'Where belief, calling and work meet.',
  },
  'speaking-content': {
    label: 'Speaking & Content',
    description: 'Teaching, presenting and creating content that serves an audience.',
  },
};

export const contentTypeLabels: Record<ContentType, string> = {
  video: 'Video',
  article: 'Article',
  resource: 'Resource',
};
