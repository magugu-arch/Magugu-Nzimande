'use client';

import { announce } from '@hao/accessibility';
import type { GatewayCallRecord } from '@hao/api-gateway';
import {
  Button,
  Card,
  Container,
  Dialog,
  Notice,
  PageHeader,
  RadioGroup,
  Section,
  Stack,
  Switch,
  Tag,
} from '@hao/design-system';
import { TOPICS, type NetworkMode } from '@hao/local-platform';
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_INFO,
  type ErrorCategory,
  type FeatureFlag,
} from '@hao/shared-types';
import {
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  Handshake,
  Info,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Row, Rows } from '@/components/cards';
import { getGateway, resetDemoData } from '@/lib/gateway';
import { FLAG_PROFILE_NAME, useFlags } from '@/lib/prefs';
import { useNetworkMode } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from '../profile.module.css';

const NETWORK_OPTIONS: Array<{ value: NetworkMode; label: string; hint: string }> = [
  { value: 'normal', label: 'Normal', hint: 'Requests answer quickly.' },
  {
    value: 'slow',
    label: 'Slow',
    hint: 'Every request takes a few seconds — shows loading states.',
  },
  { value: 'offline', label: 'Offline', hint: 'Requests fail at once — shows offline states.' },
  {
    value: 'error',
    label: 'Service error',
    hint: 'Requests fail after retries — shows error and retry.',
  },
];

function isNetworkMode(value: string): value is NetworkMode {
  return NETWORK_OPTIONS.some((option) => option.value === value);
}

const ERROR_WORDS: Record<ErrorCategory, string> = {
  OFFLINE: 'Offline',
  TIMEOUT: 'Timed out',
  UNAVAILABLE: 'Unavailable',
  VALIDATION: 'Needs attention',
  NOT_FOUND: 'Not found',
  FORBIDDEN: 'Not allowed',
  CONFLICT: 'Already done',
  RATE_LIMITED: 'Too many attempts',
  UNKNOWN: 'Unknown error',
};

const CALL_LIMIT = 20;

const clock = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface LoggedCall {
  /** Order of arrival on this page, used as the list key. */
  seq: number;
  /** When this page heard about the call. */
  at: number;
  record: GatewayCallRecord;
}

/** The last few gateway calls, heard on the in-browser event bus while this page is open. */
function useRecentCalls(): [LoggedCall[], () => void] {
  const [calls, setCalls] = useState<LoggedCall[]>([]);
  useEffect(() => {
    return getGateway().platform.bus.subscribe(TOPICS.gatewayCall, (event) => {
      const record = event.payload as GatewayCallRecord;
      const at = Date.now();
      setCalls((current) =>
        [{ seq: (current[0]?.seq ?? 0) + 1, at, record }, ...current].slice(0, CALL_LIMIT),
      );
    });
  }, []);
  return [calls, () => setCalls([])];
}

function CallRow({ call }: { call: LoggedCall }) {
  const { record } = call;
  return (
    <li className={styles.call}>
      <span className={styles.callTime}>{clock.format(call.at)}</span>
      <span className={styles.callName}>
        {record.service}.{record.method}
      </span>
      <span className={styles.callFacts}>
        <Tag tone={record.kind === 'mutation' ? 'info' : 'neutral'}>
          {record.kind === 'mutation' ? 'Mutation' : 'Read'}
        </Tag>
        {record.outcome === 'ok' ? (
          <Tag tone="success" icon={<CircleCheck aria-hidden="true" />}>
            OK
          </Tag>
        ) : (
          <Tag tone="danger" icon={<CircleAlert aria-hidden="true" />}>
            {record.category ? ERROR_WORDS[record.category] : 'Error'}
          </Tag>
        )}
        {record.replayed ? <Tag tone="teal">Replayed</Tag> : null}
        <span>
          {record.attempts} {record.attempts === 1 ? 'attempt' : 'attempts'}
        </span>
        <span>{record.durationMs} ms</span>
      </span>
    </li>
  );
}

export function PrototypeScreen() {
  const { flags, setFlag, resetFlags } = useFlags();
  const [network, setNetwork] = useNetworkMode();
  const [calls, clearCalls] = useRecentCalls();
  const { session } = useSession();
  const signedIn = session?.role === 'citizen';
  const [confirmReset, setConfirmReset] = useState(false);
  const [flagsReset, setFlagsReset] = useState(false);

  const toggleFlag = (flag: FeatureFlag, on: boolean) => {
    setFlag(flag, on);
    setFlagsReset(false);
    announce(`${FEATURE_FLAG_INFO[flag].label} switched ${on ? 'on' : 'off'}.`);
  };

  const restoreFlags = () => {
    resetFlags();
    setFlagsReset(true);
    announce(`Feature flags reset to the ${FLAG_PROFILE_NAME} profile.`);
  };

  const chooseNetwork = (value: string) => {
    if (!isNetworkMode(value)) return;
    setNetwork(value);
    const label = NETWORK_OPTIONS.find((option) => option.value === value)?.label ?? value;
    announce(`Simulated connection set to ${label.toLowerCase()}.`);
  };

  const resetEverything = () => {
    // Flags live outside the mock store, so put them back as well. Accessibility
    // choices are the person's own needs, not sample data: they are kept.
    resetFlags();
    resetDemoData();
  };

  return (
    <Container width="narrow">
      <PageHeader
        eyebrow="Prototype controls"
        title="Tools for reviewers"
        lede="These switches are for people reviewing the concept. They are not part of the real service."
        back={signedIn ? { href: '/profile/', label: 'Profile' } : { href: '/more/', label: 'More' }}
      />

      <Stack gap={7}>
        <Section
          title="Feature flags"
          id="flags"
          intro="Capabilities that need approval before they could ever go live. Switching one on here only shows the labelled concept."
        >
          <Card>
            <div className={styles.settings}>
              {FEATURE_FLAGS.map((flag) => (
                <Switch
                  key={flag}
                  label={FEATURE_FLAG_INFO[flag].label}
                  hint={FEATURE_FLAG_INFO[flag].gate}
                  checked={flags[flag]}
                  onChange={(on) => toggleFlag(flag, on)}
                />
              ))}
            </div>
          </Card>
          <div className={styles.sectionActions}>
            <p className={styles.small}>
              Active profile: <strong>{FLAG_PROFILE_NAME}</strong>. The “pilot” profile starts with
              every flag off.
            </p>
            <Button
              variant="secondary"
              onClick={restoreFlags}
              iconStart={<RotateCcw aria-hidden="true" />}
            >
              Reset to profile defaults
            </Button>
          </div>
          {flagsReset ? (
            <Notice tone="success" role="status">
              <p>Feature flags are back to the {FLAG_PROFILE_NAME} profile defaults.</p>
            </Notice>
          ) : null}
        </Section>

        <Section
          title="Simulated connection"
          id="network"
          intro="Nothing leaves this device, so there is no real network to fail. This makes the mock services behave as if there were."
        >
          <Card>
            <RadioGroup
              legend="How should requests behave?"
              name="network-mode"
              value={network}
              onChange={chooseNetwork}
              options={NETWORK_OPTIONS}
            />
          </Card>
          {network === 'normal' ? null : (
            <Notice tone="attention" role="status" title="The simulated connection is not normal">
              <p>
                Every screen is affected until you change it. Remember to switch it back to
                Normal when you have finished.
              </p>
            </Notice>
          )}
        </Section>

        <Section
          title="Recent gateway calls"
          id="calls"
          intro="Every request a screen makes goes through one gateway. Records carry no arguments or results — only what was called and how it went."
        >
          {calls.length === 0 ? (
            <Notice tone="neutral" icon={<Info aria-hidden="true" />}>
              <p>
                No calls yet. They appear here as you use the app — change the simulated
                connection, or open another screen and come back.
              </p>
            </Notice>
          ) : (
            <>
              <ol className={styles.calls} aria-label="Recent gateway calls, newest first">
                {calls.map((call) => (
                  <CallRow key={call.seq} call={call} />
                ))}
              </ol>
              <div className={styles.sectionActions}>
                <p className={styles.small}>
                  Showing the last {calls.length} of at most {CALL_LIMIT}, newest first. “Replayed”
                  means an idempotency key matched, so the stored result was returned instead of
                  doing the work twice.
                </p>
                <Button variant="quiet" onClick={clearCalls}>
                  Clear list
                </Button>
              </div>
            </>
          )}
        </Section>

        <Section
          title="Reset sample data"
          id="reset"
          intro="Start again with the original demo people, applications and messages."
        >
          <div>
            <Button
              variant="danger"
              onClick={() => setConfirmReset(true)}
              iconStart={<Trash2 aria-hidden="true" />}
            >
              Reset sample data
            </Button>
          </div>
        </Section>

        <Section title="Other parts of the prototype" id="elsewhere">
          <Rows label="Other parts of the prototype">
            <Row
              href="/staff/"
              title="Staff console"
              lead={<BriefcaseBusiness />}
              text="The case queue as an official would see it. Separate sign-in."
            />
            {flags.partnerIntegrations ? (
              <Row
                href="/partner/"
                title="Partner sandbox"
                lead={<Handshake />}
                meta={<Tag tone="info">Future capability</Tag>}
                text="How an accredited institution could ask for a yes or no answer, with consent."
              />
            ) : null}
            <Row
              href="/about/"
              title="About this prototype"
              lead={<Info />}
              text="What it is, what it is not, and the photographs it uses."
            />
          </Rows>
        </Section>
      </Stack>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset sample data?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={resetEverything}>
              Reset sample data
            </Button>
          </>
        }
      >
        <p>
          Clears every draft, application, message and setting on this device and signs you out.
        </p>
        <p>
          Feature flags go back to the {FLAG_PROFILE_NAME} profile defaults. Your accessibility
          choices — text size, contrast, motion and data use — are kept.
        </p>
        <p className={styles.small}>
          The page reloads with fresh sample data. This cannot be undone.
        </p>
      </Dialog>
    </Container>
  );
}
