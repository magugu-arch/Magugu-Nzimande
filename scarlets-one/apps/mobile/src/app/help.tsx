import { officialLinks } from '@scarlets/adapters';
import type { Faq } from '@scarlets/domain';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { Press } from '@/components/Press';
import { RowGroup } from '@/components/Rows';
import { ErrorState, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useHelp } from '@/data/queries';
import { useL, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { hitTarget, space, useTheme } from '@/theme';

const TOPICS: Faq['topic'][] = [
  'app',
  'tickets',
  'matchday',
  'accessibility',
  'account',
  'privacy',
];

function Question({ faq }: { faq: Faq }) {
  const l = useL();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Press
        testID={`faq-${faq.id}`}
        onPress={() => setOpen(!open)}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={l(faq.question)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: hitTarget + 10,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
        }}
      >
        <Text variant="headline" style={{ flex: 1 }}>
          {l(faq.question)}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Press>
      {open ? (
        <Text
          variant="body"
          color="textSecondary"
          style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
        >
          {l(faq.answer)}
        </Text>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const t = useT();
  const query = useHelp();
  const faqs = query.data?.data ?? [];
  return (
    <Page testID="screen-help" title={t('help.title')} back>
      <View style={{ gap: space.xl }}>
        {query.isPending ? <SkeletonList rows={5} /> : null}
        {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}
        {TOPICS.map((topic) => {
          const items = faqs.filter((faq) => faq.topic === topic);
          if (items.length === 0) return null;
          return (
            <View key={topic} style={{ gap: space.sm }}>
              <Text
                variant="eyebrow"
                color="textSecondary"
                accessibilityRole="header"
                style={{ marginLeft: space.lg }}
              >
                {t(`help.topic.${topic}` as MessageKey)}
              </Text>
              <RowGroup>
                {items.map((faq) => (
                  <Question key={faq.id} faq={faq} />
                ))}
              </RowGroup>
            </View>
          );
        })}
        <Button
          testID="help-contact"
          label={t('help.contact')}
          icon="mail"
          variant="secondary"
          fill
          accessibilityHint={t('common.destinationPending')}
          onPress={() => {
            track('support_request_submit', { placement: 'help' });
            void openOfficial(officialLinks.contact.url);
          }}
        />
        <Text variant="caption" color="textSecondary" align="center">
          {t('common.destinationPending')}
        </Text>
      </View>
    </Page>
  );
}
