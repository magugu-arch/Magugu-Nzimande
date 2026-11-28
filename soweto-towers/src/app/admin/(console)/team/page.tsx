import QRCode from 'qrcode';
import { Suspense } from 'react';
import { removeStaffAction } from '@/app/admin/actions';
import { PlainActionButton } from '@/components/admin/forms';
import { AddStaffForm, ChangePasswordForm, DisableTotpForm, EnableTotpForm } from '@/components/admin/TeamForms';
import styles from '@/components/admin/admin.module.css';
import { requireStaff, type StaffSession } from '@/lib/auth/session';
import { newTotpSecret, totpUri } from '@/lib/auth/totp';
import { adminCount, listStaff, staffRow } from '@/lib/data/admin';
import { formatDayShort, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Team' };

async function TwoStep({ me, enabled }: { me: StaffSession; enabled: boolean }) {
  if (enabled) {
    return (
      <>
        <p>
          <span className={`${styles.st} ${styles.stGo}`}>On</span> You enter a code from your authenticator app each time you sign in.
        </p>
        <p className={`${styles.small} ${styles.muted}`}>Changing phones? Turn it off with a current code, then set it up again on the new phone.</p>
        <DisableTotpForm />
      </>
    );
  }
  // A fresh secret each visit. It is only saved once a code from it has been checked.
  const secret = newTotpSecret();
  const svg = await QRCode.toString(totpUri(secret, me.email), {
    type: 'svg',
    margin: 1,
    width: 184,
    errorCorrectionLevel: 'M',
    color: { dark: '#1F1F21', light: '#FFFFFF' },
  });
  return (
    <div className={styles.totpSetup}>
      <div className={styles.qr} role="img" aria-label="QR code to add Soweto Towers to your authenticator app" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={styles.form}>
        <p>
          <span className={`${styles.st} ${styles.stWarn}`}>Off</span> Add a code from your phone, so a leaked password alone can’t open the console.
        </p>
        <ol className={styles.steps}>
          <li>Open Google Authenticator, Microsoft Authenticator or 1Password on your phone.</li>
          <li>Add an account and scan this code.</li>
          <li>Type the 6-digit code it shows below.</li>
        </ol>
        <p className={`${styles.small} ${styles.muted}`}>
          Can’t scan? Enter this key instead: <span className={styles.secretKey}>{secret.match(/.{1,4}/g)?.join(' ')}</span>
        </p>
        <EnableTotpForm secret={secret} />
      </div>
    </div>
  );
}

async function TeamList({ me }: { me: StaffSession }) {
  const [team, admins] = await Promise.all([listStaff(), adminCount()]);
  return (
    <section className={styles.panel} aria-labelledby="team-title">
      <div className={styles.panelHead}>
        <h2 id="team-title" className={styles.panelTitle}>
          Team
        </h2>
        <span className={`${styles.small} ${styles.muted}`}>
          {team.length} {team.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      <ul className={styles.rows} role="list">
        {team.map((t) => {
          const lastAdmin = t.role === 'admin' && admins <= 1;
          return (
            <li key={t.id} className={`${styles.row} ${styles.rowSplit}`}>
              <span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{t.name}</span>
                  <span className={`${styles.st} ${t.role === 'admin' ? styles.stDark : ''}`}>{t.role === 'admin' ? 'Admin' : 'Crew'}</span>
                  {t.totp ? (
                    <span className={`${styles.st} ${styles.stGo}`}>Two-step on</span>
                  ) : (
                    <span className={`${styles.st} ${styles.stWarn}`}>Two-step off</span>
                  )}
                </span>
                <span className={styles.rowMeta}>
                  <span style={{ overflowWrap: 'anywhere' }}>{t.email}</span>
                  <span>
                    {t.lastLoginAt ? `Last signed in ${formatDayShort(ymdInSast(t.lastLoginAt))} ${hmInSast(t.lastLoginAt)}` : 'Hasn’t signed in yet'}
                  </span>
                </span>
              </span>
              {t.id === me.id ? (
                <span className={`${styles.small} ${styles.muted}`}>You</span>
              ) : lastAdmin ? (
                <span className={`${styles.small} ${styles.muted}`}>Only admin</span>
              ) : (
                <PlainActionButton
                  action={removeStaffAction}
                  fields={{ id: t.id }}
                  className={styles.linkBtn}
                  confirmText={`Remove ${t.name}? They’ll be signed out straight away.`}
                >
                  Remove
                </PlainActionButton>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function TeamContent() {
  const me = await requireStaff();
  const row = await staffRow(me.id);
  const isAdmin = me.role === 'admin';
  return (
    <>
      {isAdmin && <TeamList me={me} />}

      {isAdmin && (
        <section className={styles.panel} aria-labelledby="add-title">
          <h2 id="add-title" className={styles.panelTitle}>
            Add someone
          </h2>
          <AddStaffForm />
        </section>
      )}

      <section className={styles.panel} aria-labelledby="two-step-title" id="two-step">
        <h2 id="two-step-title" className={styles.panelTitle}>
          Your two-step sign-in
        </h2>
        <TwoStep me={me} enabled={!!row?.totpSecret} />
      </section>

      <section className={styles.panel} aria-labelledby="password-title" id="password">
        <h2 id="password-title" className={styles.panelTitle}>
          Your password
        </h2>
        <ChangePasswordForm email={me.email} />
      </section>
    </>
  );
}

export default function TeamPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Team</p>
          <h1 className={styles.pageTitle}>Team and sign-in</h1>
          <p className={styles.pageSub}>Your password and two-step sign-in. Admins also add and remove crew here.</p>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <TeamContent />
      </Suspense>
    </>
  );
}
