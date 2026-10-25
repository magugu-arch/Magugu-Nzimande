import { useEffect, useRef, useState } from 'preact/hooks';
import { getDevice, sys, track } from '../app.ts';
import { openBook } from '../nav.ts';
import { Banner, Button, Disclosure, Empty, NavBar, Photo, Row, SampleTag, SectionHead, copyText, errorMessage, toast } from '../components/ui.tsx';
import { InboxButton } from './Today.tsx';
import { SPRING, SpringValue, tick } from '../motion/spring.ts';
import { ago, idempotencyKey } from '../format.ts';
import { formatDateLong, dateKeyAt } from '../../domain/util/time.ts';
import type { RewardLedgerEntry } from '../../domain/types.ts';

/** Counts toward a new balance on a spring, from whatever it shows now. */
function SpringNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const spring = useRef<SpringValue | null>(null);
  useEffect(() => {
    if (!spring.current) {
      spring.current = new SpringValue(value, (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      });
      return;
    }
    spring.current.to(value, { params: SPRING.default });
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

const TYPE_LABEL: Record<RewardLedgerEntry['type'], string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  expire: 'Expired',
  reverse: 'Reversed',
  adjust: 'Adjusted',
};

export function RewardsScreen() {
  const guestId = getDevice().guestId;
  const summary = sys.rewards.summary(guestId);
  const rules = sys.ctx.content.rewardRules;
  const vouchers = sys.db.where('vouchers', (v) => v.guestId === guestId).sort((a, b) => b.issuedAt - a.issuedAt);
  const active = vouchers.filter((v) => v.status === 'active');
  const history = [...sys.rewards.entries(guestId)].reverse();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    track('rewards_view', {});
  }, []);

  const tiers = [...rules.tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  const current = tiers.find((t) => t.id === summary.tier.id)!;
  const next = summary.nextTier ? tiers.find((t) => t.id === summary.nextTier!.id)! : null;
  const progress = next ? Math.min(1, (summary.lifetime - current.minLifetimePoints) / (next.minLifetimePoints - current.minLifetimePoints)) : 1;

  const redeem = async (offerId: string) => {
    setBusy(offerId);
    try {
      const v = sys.rewards.redeem(guestId, offerId, idempotencyKey(`redeem-${offerId}`));
      await sys.settle();
      tick([8, 30, 10]);
      track('reward_redeemed', { offerId });
      toast(`${v.title} is in your wallet`, 'ticket');
    } catch (err) {
      toast(errorMessage(err), 'alert');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <NavBar title="Rewards" trailing={<InboxButton />} />
      <div class="page-body">
        <section class="points-card" aria-label="Your points">
          <div class="row between">
            <span class="caption" style={{ color: 'rgba(251,248,242,.8)' }}>{summary.tier.label} member</span>
            <span class="tag" style={{ background: 'rgba(255,255,255,.16)', color: '#fbf8f2', boxShadow: 'none' }}>Sample rules</span>
          </div>
          <div class="stack-sm">
            <span class="points num" aria-live="polite">
              <SpringNumber value={summary.balance} />
            </span>
            <span style={{ color: 'rgba(251,248,242,.86)' }}>points to spend</span>
          </div>
          <div class="stack-sm">
            <div class="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={next ? `Progress to ${next.label}` : 'Top tier'}>
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
            <span class="footnote" style={{ color: 'rgba(251,248,242,.82)' }}>
              {summary.nextTier ? `${summary.nextTier.pointsToGo} lifetime points to ${summary.nextTier.label}` : 'You are in the top tier'}
            </span>
          </div>
        </section>

        {summary.expiringSoon ? (
          <Banner icon="clock">
            <p>
              {summary.expiringSoon.points} points expire on {formatDateLong(dateKeyAt(summary.expiringSoon.expiresAt, 120))}. Redeem them before then.
            </p>
          </Banner>
        ) : null}

        <section class="section">
          <SectionHead title="Your wallet" eyebrow="Vouchers" />
          {active.length === 0 ? (
            <p class="callout">Vouchers you redeem appear here. Show the code at the till.</p>
          ) : (
            <div class="stack">
              {active.map((v) => (
                <div class="voucher" key={v.id}>
                  <div class="stack-sm">
                    <span class="title-3">{v.title}</span>
                    <button type="button" class="code" style={{ textAlign: 'left' }} onClick={async () => toast((await copyText(v.code)) ? 'Code copied' : 'Select the code to copy it')}>
                      {v.code}
                    </button>
                    <span class="footnote">Use by {formatDateLong(dateKeyAt(v.expiresAt, 120))}. Staff mark it used at the till.</span>
                  </div>
                  <span class="tag good">Ready</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section class="section">
          <SectionHead title="Rewards" eyebrow="Spend your points" />
          <div class="grid-cards">
            {rules.catalogue.map((o) => {
              const short = o.pointsCost - summary.balance;
              return (
                <article class="card pad-0" key={o.id}>
                  <Photo id={o.imageId} ratio="3 / 2" rounded="0" />
                  <div class="stack" style={{ padding: '16px' }}>
                    <div class="row between">
                      <h3 class="title-3">{o.title}</h3>
                      <span class="tag">{o.pointsCost} pts</span>
                    </div>
                    <p class="footnote">{o.description}</p>
                    <Button small variant={short <= 0 ? 'primary' : 'default'} disabled={short > 0} busy={busy === o.id} onClick={() => redeem(o.id)}>
                      {short > 0 ? `${short} more points` : 'Redeem'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section class="section">
          <SectionHead title="Earn points" />
          <div class="card stack">
            <p class="callout" style={{ color: 'var(--ink)' }}>
              Earn {rules.pointsPerCompletedVisit} points for each visit, once the café confirms you came. Points last {rules.pointExpiryDays} days.
            </p>
            <Button variant="primary" icon="calendar" onClick={() => openBook({ source: 'rewards' })}>
              Book your next visit
            </Button>
          </div>
        </section>

        <section class="section">
          <SectionHead title="History" />
          {history.length === 0 ? (
            <Empty icon="rewards" title="No points yet" />
          ) : (
            <div class="group">
              {history.slice(0, 12).map((e) => (
                <Row
                  key={e.id}
                  icon={e.points >= 0 ? 'plus' : 'minus'}
                  title={`${TYPE_LABEL[e.type]} ${Math.abs(e.points)} points`}
                  sub={`${e.note ?? e.referenceType} · ${ago(Date.parse(e.createdAt))}`}
                  meta={<span class="num" style={{ color: e.points >= 0 ? 'var(--sage)' : 'var(--ink-3)', fontWeight: 650 }}>{e.points >= 0 ? `+${e.points}` : e.points}</span>}
                  chevron={false}
                />
              ))}
            </div>
          )}
        </section>

        <Disclosure summary="How rewards work">
          <p class="callout">
            Points are earned only from visits the café confirms through its booking system, so a booking alone, or the same visit reported twice, never earns twice. Every earn, redemption, expiry and correction is kept in a ledger you can see above.
          </p>
          <p class="callout">
            Tiers: {tiers.map((t) => `${t.label} from ${t.minLifetimePoints} lifetime points`).join(', ')}.
          </p>
          <span class="row" style={{ gap: '8px' }}>
            <SampleTag label="Sample rules" />
            <span class="footnote">Tashas will supply the real earning rules, rewards and tier names.</span>
          </span>
        </Disclosure>
      </div>
    </>
  );
}
