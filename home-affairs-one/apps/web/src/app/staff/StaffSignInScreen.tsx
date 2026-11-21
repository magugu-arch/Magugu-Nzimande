'use client';

import { announce } from '@hao/accessibility';
import type { StaffMember } from '@hao/api-contracts';
import {
  Avatar,
  Button,
  Card,
  Cluster,
  Container,
  LinkButton,
  LoadingState,
  Notice,
  PageHeader,
  Section,
  Stack,
} from '@hao/design-system';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useSession } from '@/lib/session';
import { useConsoleQuery } from './console-data';
import styles from './console.module.css';
import { STAFF_ROLE_WORDS } from './words';

export function StaffSignInScreen() {
  const router = useRouter();
  const { session, ready, signInStaff, signOut } = useSession();
  const staff = useConsoleQuery(['staff-members'], (g) => g.identity.listDemoStaff());

  const signIn = (member: StaffMember) => {
    signInStaff(member);
    announce(`Signed in as ${member.displayName}, ${STAFF_ROLE_WORDS[member.role]}.`);
    router.push('/staff/queue/');
  };

  const current =
    session?.role === 'staff'
      ? (staff.data?.find((member) => member.staffRef === session.subjectRef) ?? null)
      : null;

  return (
    <Container width="narrow">
      <PageHeader
        eyebrow="Staff console"
        title="Staff sign-in"
        lede="For officials who work case queues, answer support requests and review the audit trail."
      />
      {!ready ? (
        <LoadingState label="Checking your sign-in" rows={2} />
      ) : session?.role === 'staff' ? (
        <Card>
          <Stack gap={4}>
            <Cluster gap={3}>
              <Avatar initials={session.initials} size="lg" tone="gold" />
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>
                  You are signed in as {session.displayName}
                </h2>
                <p className={styles.note}>
                  {current ? `${STAFF_ROLE_WORDS[current.role]} · ` : ''}
                  <span className={styles.mono}>{session.subjectRef}</span>
                </p>
              </div>
            </Cluster>
            <p>Everything you open or change in the console is recorded against this identity.</p>
            <Cluster gap={3}>
              <LinkButton href="/staff/queue/">Go to the work queue</LinkButton>
              <Button
                variant="quiet"
                onClick={() => {
                  signOut();
                  announce('You are signed out. Choose a staff identity to continue.');
                }}
              >
                Use a different staff identity
              </Button>
            </Cluster>
          </Stack>
        </Card>
      ) : (
        <Stack gap={5}>
          <Notice tone="neutral" title="This is a mock sign-in">
            <p>
              This is a mock sign-in. A real console would use workforce identity with
              hardware-bound multi-factor authentication, on a separate protected network.
            </p>
          </Notice>
          {session ? (
            <Notice tone="attention" title="This tab is signed in to another identity">
              <p>
                {session.role === 'citizen'
                  ? 'A member of the public is signed in on this tab.'
                  : 'A partner is signed in on this tab.'}{' '}
                Continuing will switch this tab to the staff identity you choose. To go back you
                will need to sign in again.
              </p>
            </Notice>
          ) : null}
          <Section title="Choose a demo official" id="demo-staff">
            <QueryBoundary query={staff} loadingLabel="Loading demo officials" loadingRows={2}>
              {(members) => (
                <ul className={styles.plainList}>
                  {members.map((member) => (
                    <li key={member.staffRef}>
                      <button type="button" className={styles.choice} onClick={() => signIn(member)}>
                        <Avatar initials={member.initials} size="lg" tone="gold" />
                        <span>
                          <span className={styles.choiceName}>{member.displayName}</span>
                          <span className={styles.choiceRole}>{STAFF_ROLE_WORDS[member.role]}</span>
                          <span className={styles.choiceDetail}>
                            Works these queues: {member.queues.join(', ')}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoundary>
          </Section>
          <p className={styles.note}>
            Both officials are invented. Signing in here records a staff session on this device
            only.
          </p>
        </Stack>
      )}
    </Container>
  );
}
