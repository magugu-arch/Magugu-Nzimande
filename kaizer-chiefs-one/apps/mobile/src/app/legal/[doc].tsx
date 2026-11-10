import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COMMUNITY_RULES_VERSION, FAN_TERMS_VERSION } from '@kc-one/contracts';
import { BackHeader, DemoTag, EmptyState, Screen, Text } from '@/components';
import { space } from '@/theme';

/**
 * Draft legal texts: structure only, for the club's legal and privacy teams to
 * replace. Each is marked DRAFT on screen and versioned so consent can be
 * re-requested when the wording changes.
 */
const DOCS: Record<string, { title: string; version: string; sections: [string, string][] }> = {
  terms: {
    title: 'Terms of use',
    version: 'draft-1',
    sections: [
      [
        'About these terms',
        'These terms will set out who provides the app, who may use it and the rules for using it.',
      ],
      ['Your account', 'How accounts are created, kept secure, suspended and closed.'],
      [
        'Club content',
        'Club content is provided for personal use and remains the club’s property.',
      ],
      [
        'Third-party services',
        'Tickets, membership, shopping and rewards are provided by the club’s partners under their own terms.',
      ],
      ['Changes', 'How the club will tell you about changes to these terms.'],
    ],
  },
  privacy: {
    title: 'Privacy notice',
    version: 'draft-1',
    sections: [
      [
        'Who is responsible',
        'The responsible party and information officer under POPIA, with contact details.',
      ],
      [
        'What we collect',
        'Account details you give us; your choices in Privacy; your Fan Moments; and, only if you opt in, anonymous usage data.',
      ],
      [
        'Why we use it',
        'To run your account and the features you use, and for marketing only where you have opted in.',
      ],
      [
        'Who we share it with',
        'The club’s ticketing, membership, rewards and hosting providers, only as needed to provide those services.',
      ],
      [
        'How long we keep it',
        'Retention periods for each kind of data, agreed with the club’s privacy team.',
      ],
      [
        'Your rights',
        'Access, correction, deletion and objection, and how to complain to the Information Regulator.',
      ],
    ],
  },
  community: {
    title: 'Community rules',
    version: COMMUNITY_RULES_VERSION,
    sections: [
      ['Share your own moments', 'Post only what you took yourself or have permission to share.'],
      [
        'Respect people',
        'Ask before you post anyone’s face. No hate, harassment, threats or private information.',
      ],
      [
        'Protect children',
        'Never share a child’s image without a parent or guardian’s agreement. Moments that show children get an extra safeguarding review.',
      ],
      [
        'Review and removal',
        'Every moment is reviewed before it appears. The club may decline or remove any moment and will record why.',
      ],
      [
        'Reporting',
        'Report anything that breaks these rules from the moment’s menu. Reports are private.',
      ],
    ],
  },
};

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[doc];
  if (!d) {
    return (
      <Screen topInset={false} header={<BackHeader title="Document" />}>
        <EmptyState title="Document not found" />
      </Screen>
    );
  }
  return (
    <Screen topInset={false} header={<BackHeader title={d.title} />}>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <DemoTag kind="DRAFT" />
          <Text variant="micro" color="textTertiary">
            Version {d.version}
            {doc === 'community' ? ` · Fan terms ${FAN_TERMS_VERSION}` : ''}
          </Text>
        </View>
        <Text variant="callout" color="textSecondary">
          Structure only. The club’s legal and privacy teams supply the final wording before
          release.
        </Text>
        {d.sections.map(([h, b]) => (
          <View key={h} style={{ gap: space.xs }}>
            <Text variant="title3">{h}</Text>
            <Text variant="body" color="textSecondary">
              {b}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
