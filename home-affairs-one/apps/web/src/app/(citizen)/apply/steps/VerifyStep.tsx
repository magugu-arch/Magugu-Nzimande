'use client';

import { STEP_UP_MINUTES } from '@hao/auth-client';
import { Button, LinkButton, Notice, Stack } from '@hao/design-system';
import { ASSURANCE_TIER_INFO, meetsTier } from '@hao/shared-types';
import { ArrowRight, Fingerprint } from 'lucide-react';
import styles from '../apply.module.css';
import type { ApplicationFlow } from '../useApplication';
import { BackButton, SaveProblem, StepActions } from './parts';

/**
 * Progressive assurance: the fresh check is asked for here, in words, before
 * anything is sent. It is never taken silently, and a person who cannot pass it
 * is told what to do next with their draft still saved.
 */
export function VerifyStep({ flow }: { flow: ApplicationFlow }) {
  const { service, session } = flow;
  const changesDocument = service.domain === 'IDENTITY' || service.domain === 'PASSPORTS';
  const accountVerified = meetsTier(session.accountTier, 'A2');

  return (
    <Stack gap={5}>
      <p className={styles.intro}>
        {changesDocument
          ? 'Submitting this application changes an identity document, so we ask for a fresh check.'
          : 'Submitting this application is a sensitive step, so we ask for a fresh check that it is you.'}{' '}
        It lasts {STEP_UP_MINUTES} minutes.
      </p>

      {flow.verified ? (
        <>
          <Notice tone="success" title="You have confirmed it is you">
            <p>
              The check lasts {STEP_UP_MINUTES} minutes from when you confirmed. If it runs out
              before you submit, we ask again.
            </p>
          </Notice>
          <SaveProblem flow={flow} />
          <StepActions>
            <Button
              size="lg"
              iconEnd={<ArrowRight aria-hidden="true" />}
              loading={flow.saving}
              onClick={() => void flow.next()}
            >
              Continue
            </Button>
            <BackButton flow={flow} />
          </StepActions>
        </>
      ) : flow.verifyFailed ? (
        <>
          <Notice
            tone="attention"
            role="alert"
            title="This account cannot confirm with a passkey yet"
          >
            <p>
              To submit this application the account must be verified, and you must be signed in
              with a passkey.{' '}
              {accountVerified
                ? 'You signed in with a one-time code, which gives basic access only. Sign out, then sign in again with your passkey.'
                : 'This is a basic account: its identity has not been verified yet.'}
            </p>
            <p>
              Your draft is saved, so you can finish it later. An adviser at a service point can
              also help you verify your account.
            </p>
          </Notice>
          <StepActions>
            <LinkButton href="/profile/security/" size="lg">
              See how to verify your account
            </LinkButton>
            <LinkButton href="/service-points/" variant="secondary" size="lg">
              Find a service point
            </LinkButton>
            <BackButton flow={flow} />
          </StepActions>
        </>
      ) : (
        <>
          <Notice tone="neutral" title="What happens when you confirm">
            <p>
              Your device asks for your fingerprint, face or screen lock. You are signed in at “
              {ASSURANCE_TIER_INFO[session.tier].label}”; this service needs “
              {ASSURANCE_TIER_INFO[service.requiredTier].label}” to submit.
            </p>
            <p>
              In this prototype no real passkey or biometric is checked, and nobody’s identity is
              verified.
            </p>
          </Notice>
          <SaveProblem flow={flow} />
          <StepActions>
            <Button
              size="lg"
              iconStart={<Fingerprint aria-hidden="true" />}
              loading={flow.saving}
              onClick={() => void flow.confirmIdentity()}
            >
              Confirm with passkey
            </Button>
            <BackButton flow={flow} />
          </StepActions>
        </>
      )}
    </Stack>
  );
}
