import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  CAPTION_MAX,
  COMMUNITY_RULES_VERSION,
  FAN_TERMS_VERSION,
  MEDIA_ISSUE_COPY,
  validateFanMedia,
  type FanPost,
  type FanPostDraft,
} from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  Checkbox,
  DemoTag,
  Eyebrow,
  Group,
  Headline,
  Notice,
  Screen,
  Text,
  ToggleRow,
} from '@/components';
import { useSubmitFanPost } from '@/data/queries';
import { SignInGate } from '@/features/auth/SignInGate';
import { usePreferences } from '@/state/preferences';
import { color, radius, space, type } from '@/theme';

type Step = 'consent' | 'media' | 'preview' | 'done';
type Picked = {
  uri: string;
  mimeType: string;
  bytes: number;
  durationSeconds: number | null;
  width: number;
  height: number;
};

const RULES = [
  'Share only what you took yourself, or have permission to share.',
  'Ask before you post anyone’s face. Never share a child’s photo without a parent or guardian’s agreement.',
  'No hate, harassment, threats or private information.',
  'Moments are reviewed before they appear. The club may decline any moment.',
];

/**
 * Consent first, then media, then a preview, then moderation. The steps are
 * one screen so going back never loses what the supporter has done.
 */
export default function NewFanMoment() {
  return (
    <Screen topInset={false} header={<BackHeader title="Share a moment" />}>
      <SignInGate
        title="Sign in to share"
        body="Fan Moments are linked to your account, so you can see their review status and remove them."
      >
        <Flow />
      </SignInGate>
    </Screen>
  );
}

function Flow() {
  const router = useRouter();
  const showNameDefault = usePreferences((s) => s.privacy.showNameOnFanMoments);
  const [step, setStep] = useState<Step>('consent');
  const [terms, setTerms] = useState(false);
  const [rights, setRights] = useState(false);
  const [showName, setShowName] = useState(showNameDefault);
  const [showsMinors, setShowsMinors] = useState<boolean | null>(null);
  const [guardian, setGuardian] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [result, setResult] = useState<FanPost | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submit = useSubmitFanPost();

  const consentReady = terms && rights && showsMinors !== null && (!showsMinors || guardian);

  async function pick() {
    setMediaError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMediaError('Photo access is off. You can allow it in Settings, or share another time.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 30,
      exif: false,
    });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    const mimeType = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const candidate = {
      uri: a.uri,
      mimeType,
      // Some platforms do not report size; the server re-checks every upload.
      bytes: a.fileSize ?? 1,
      durationSeconds: a.duration ? a.duration / 1000 : null,
      width: a.width,
      height: a.height,
    };
    const issues = validateFanMedia(candidate);
    if (issues.length > 0) {
      setMediaError(issues.map((i) => MEDIA_ISSUE_COPY[i]).join(' '));
      return;
    }
    setPicked(candidate);
    setStep('preview');
  }

  async function send() {
    if (!picked || showsMinors === null) return;
    setSubmitError(null);
    const draft: FanPostDraft = {
      caption: caption.trim(),
      media: {
        mimeType: picked.mimeType,
        bytes: picked.bytes,
        durationSeconds: picked.durationSeconds,
        width: picked.width || null,
        height: picked.height || null,
      },
      showsMinors,
      guardianConsentConfirmed: guardian,
      consent: {
        termsVersion: FAN_TERMS_VERSION,
        communityRulesVersion: COMMUNITY_RULES_VERSION,
        rightsConfirmed: true,
        showDisplayName: showName,
        acceptedAt: new Date().toISOString(),
      },
    };
    const r = await submit.mutateAsync({ draft, uri: picked.uri });
    if (r.status !== 'ok') return setSubmitError(r.message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setResult(r.data);
    setStep('done');
  }

  return (
    <Animated.View
      key={step}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(120)}
      style={{ gap: space.xl }}
    >
      <StepDots step={step} />
      {step === 'consent' ? (
        <>
          <Eyebrow>Step 1 · Before you share</Eyebrow>
          <Headline lead="Community" accent="first." size="display" />
          <View style={styles.rules}>
            {RULES.map((r) => (
              <Text key={r} variant="callout" color="textSecondary">
                — {r}
              </Text>
            ))}
          </View>
          <Checkbox
            checked={terms}
            onChange={setTerms}
            label="I agree to the Fan Moments terms and community rules"
            description={`Draft version ${FAN_TERMS_VERSION}, pending legal review.`}
          />
          <Checkbox
            checked={rights}
            onChange={setRights}
            label="I took this, or have permission from everyone in it"
          />
          <View style={{ gap: space.sm }}>
            <Text variant="headline">Does it show anyone under 18?</Text>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button
                label="No"
                variant={showsMinors === false ? 'primary' : 'secondary'}
                compact
                style={{ flex: 1 }}
                onPress={() => setShowsMinors(false)}
              />
              <Button
                label="Yes"
                variant={showsMinors === true ? 'primary' : 'secondary'}
                compact
                style={{ flex: 1 }}
                onPress={() => setShowsMinors(true)}
              />
            </View>
            {showsMinors ? (
              <Checkbox
                checked={guardian}
                onChange={setGuardian}
                label="A parent or guardian of every child shown has agreed"
                description="Moments showing children get an extra safeguarding review before they can appear."
              />
            ) : null}
          </View>
          <Group>
            <ToggleRow
              title="Show my display name"
              description="Otherwise the moment is shown without a name."
              value={showName}
              onValueChange={setShowName}
            />
          </Group>
          <Button
            label="Continue"
            trailingIcon="arrow-forward"
            disabled={!consentReady}
            onPress={() => setStep('media')}
          />
        </>
      ) : null}

      {step === 'media' ? (
        <>
          <Eyebrow>Step 2 · Choose</Eyebrow>
          <Headline lead="Pick your" accent="moment." size="display" />
          <Text variant="body" color="textSecondary">
            A photo up to 10 MB, or a video up to 30 seconds and 50 MB. Location data is removed
            before anything is stored.
          </Text>
          {mediaError ? (
            <Notice
              compact
              reason="not_eligible"
              title="That file can’t be used"
              body={mediaError}
            />
          ) : null}
          <Button label="Choose from library" icon="images-outline" onPress={pick} />
          <Button label="Back" variant="ghost" onPress={() => setStep('consent')} />
        </>
      ) : null}

      {step === 'preview' && picked ? (
        <>
          <Eyebrow>Step 3 · Preview</Eyebrow>
          <View style={styles.preview}>
            <Image
              source={{ uri: picked.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel="Your selected photo or video"
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Text variant="labelSmall" color="textSecondary">
              Caption
            </Text>
            <TextInput
              value={caption}
              onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
              placeholder="Say something about it (optional)"
              placeholderTextColor={color.textTertiary}
              multiline
              accessibilityLabel="Caption"
              style={styles.caption}
            />
            <Text variant="micro" color="textTertiary" align="right">
              {caption.length}/{CAPTION_MAX}
            </Text>
          </View>
          <Group>
            <ToggleRow title="Show my display name" value={showName} onValueChange={setShowName} />
          </Group>
          {submitError ? <Notice compact reason="error" body={submitError} /> : null}
          <Button
            label="Submit for review"
            trailingIcon="arrow-up"
            loading={submit.isPending}
            onPress={send}
          />
          <Button label="Choose another" variant="ghost" onPress={() => setStep('media')} />
        </>
      ) : null}

      {step === 'done' && result ? (
        <>
          <Eyebrow>Submitted</Eyebrow>
          <Headline lead="Thank you," accent="Khosi." size="display" />
          <View style={styles.status}>
            <Text variant="labelSmall" color="accent">
              {result.status === 'escalated' ? 'Safeguarding review' : 'Pending review'}
            </Text>
            <Text variant="callout" color="textSecondary">
              {result.status === 'escalated'
                ? 'Moments that show children get an extra review before they can appear.'
                : 'Moderators review every moment. You’ll see the outcome in My moments.'}
            </Text>
            {result.provenance.state === 'demo' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <DemoTag />
                <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                  Saved on this phone only. Nothing was uploaded and nobody will review it.
                </Text>
              </View>
            ) : null}
          </View>
          <Button label="See my moments" onPress={() => router.replace('/fan/mine')} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </>
      ) : null}
    </Animated.View>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ['consent', 'media', 'preview', 'done'];
  const at = order.indexOf(step);
  return (
    <View
      style={{ flexDirection: 'row', gap: space.xs }}
      accessibilityLabel={`Step ${Math.min(at + 1, 3)} of 3`}
      accessible
    >
      {order.slice(0, 3).map((s, i) => (
        <View key={s} style={[styles.dot, i <= at && styles.dotOn]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: space.sm, paddingLeft: space.xs },
  preview: {
    aspectRatio: 0.8,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  caption: {
    ...type.body,
    color: color.text,
    minHeight: 96,
    padding: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.bgRaised,
    textAlignVertical: 'top',
  },
  status: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineAccent,
    backgroundColor: color.bgRaised,
  },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.surfaceHigh },
  dotOn: { backgroundColor: color.accent },
});
