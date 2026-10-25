import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSystem } from './helpers.ts';
import { Database, UniqueViolation } from '../src/domain/db.ts';
import { MAX_ATTEMPTS } from '../src/domain/outbox.ts';
import { hmacSha256Hex, sha256Hex } from '../src/domain/util/sha256.ts';
import { formatZar, maskEmail, maskPhone, normalisePhone } from '../src/domain/util/core.ts';
import { redact } from '../src/domain/context.ts';
import { content } from '../src/content/index.ts';
import { brandAssets } from '../src/content/assets.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('database', () => {
  test('enforces unique keys and rolls a transaction back as a unit', () => {
    const db = new Database();
    db.insert('refunds', { id: 'r1', paymentId: 'p', amountMinor: 1, reason: 'x', status: 'pending', approvedBy: 'a', providerReference: null, idempotencyKey: 'k', createdAt: 0, updatedAt: 0 });
    assert.throws(
      () => db.insert('refunds', { id: 'r2', paymentId: 'p', amountMinor: 1, reason: 'x', status: 'pending', approvedBy: 'a', providerReference: null, idempotencyKey: 'k', createdAt: 0, updatedAt: 0 }),
      UniqueViolation,
    );
    assert.throws(() =>
      db.transaction(() => {
        db.update('refunds', 'r1', { amountMinor: 999 });
        db.insert('guests', { id: 'g', name: 'n', email: null, phone: null, contactHash: 'h', birthday: null, homeBranchId: null, pushToken: null, pushTokenValid: false, utcOffsetMinutes: 120, createdAt: 0, isDemoPopulation: false, erasedAt: null });
        throw new Error('boom');
      }),
    );
    assert.equal(db.require('refunds', 'r1').amountMinor, 1);
    assert.equal(db.get('guests', 'g'), undefined);
    assert.equal(db.byUnique('refunds', 'idempotencyKey', 'k')?.id, 'r1');
  });

  test('round-trips through a JSON snapshot', () => {
    const { sys } = makeSystem();
    sys.guests.create({ name: 'Snap', email: 's@example.com', phone: null });
    const copy = new Database();
    copy.load(JSON.parse(JSON.stringify(sys.db.toJSON())));
    assert.equal(copy.all('guests').length, 1);
    assert.equal(copy.all('guestPreferences').length, 5);
  });
});

describe('outbox', () => {
  test('an event rolled back with its transaction is never published', () => {
    const { sys } = makeSystem();
    assert.throws(() =>
      sys.db.transaction(() => {
        sys.outbox.publish({ type: 'booking.started', attemptId: 'a', branchId: 'rosebank' }, 'c');
        throw new Error('rollback');
      }),
    );
    assert.equal(sys.db.all('outbox').length, 0);
  });

  test('a failing consumer is retried with backoff, then dead-lettered with an alert, and can be replayed', () => {
    const { sys, clock } = makeSystem();
    let calls = 0;
    let fail = true;
    sys.outbox.register({
      name: 'flaky',
      handle: () => {
        calls++;
        if (fail) throw new Error('downstream unavailable');
      },
    });
    const row = sys.outbox.publish({ type: 'booking.started', attemptId: 'a', branchId: 'rosebank' }, 'c');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      sys.outbox.dispatch(1);
      clock.advance(2 * 60 * 60_000);
    }
    const parked = sys.db.require('outbox', row.id);
    assert.equal(parked.status, 'dead-letter');
    assert.equal(calls, MAX_ATTEMPTS);
    assert.ok(parked.deliveredTo.includes('notifications'), 'healthy consumers were not re-run');
    assert.equal(sys.db.where('alerts', (a) => a.entityId === row.id).length, 1);

    fail = false;
    sys.outbox.replay(row.id);
    sys.outbox.dispatch();
    assert.equal(sys.db.require('outbox', row.id).status, 'published');
  });
});

describe('primitives', () => {
  test('SHA-256 and HMAC match published test vectors', () => {
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // RFC 4231 test case 2
    assert.equal(hmacSha256Hex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    const big = 'x'.repeat(1000);
    assert.equal(sha256Hex(big), createHash('sha256').update(big).digest('hex'));
  });

  test('money is formatted in rands from integer cents', () => {
    assert.equal(formatZar(60000), 'R600');
    assert.equal(formatZar(4250), 'R42,50');
    assert.equal(formatZar(1234500).replace(/\s/g, ' '), 'R12 345');
  });

  test('phones normalise to E.164 and contact details mask in logs', () => {
    assert.equal(normalisePhone('082 123 4567'), '+27821234567');
    assert.equal(normalisePhone('+44 7700 900123'), '+447700900123');
    assert.equal(normalisePhone('12345'), null);
    assert.equal(maskEmail('thandi@example.com'), 't•••••@example.com');
    assert.equal(maskPhone('+27821234567'), '+27 ••• ••67');
    assert.deepEqual(redact({ guestEmail: 'a@b.co', phone: '+2782', amountMinor: 5 }), {
      guestEmail: '[redacted]',
      phone: '[redacted]',
      amountMinor: 5,
    });
  });
});

describe('supplied assets', () => {
  test('all 28 originals are present and match the manifest byte for byte', () => {
    const manifest = JSON.parse(readFileSync(path.join(root, 'assets/Tashas_28_Image_Asset_Metadata.json'), 'utf8')) as {
      total_assets: number;
      assets: { filename: string; sha256: string; file_size_bytes: number }[];
    };
    assert.equal(manifest.total_assets, 28);
    assert.equal(manifest.assets.length, 28);
    for (const a of manifest.assets) {
      const file = path.join(root, 'assets/originals', a.filename);
      assert.equal(statSync(file).size, a.file_size_bytes, a.filename);
      assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), a.sha256, a.filename);
    }
    assert.equal(readdirSync(path.join(root, 'assets/originals')).length, 28);
  });

  test('every asset has alt text and a role, and the manifest discloses missing camera data', () => {
    assert.equal(brandAssets.length, 28);
    for (const a of brandAssets) {
      assert.ok(a.altText.length > 20, `${a.id} alt text`);
      assert.ok(a.role);
      assert.equal(a.publicUrl, undefined, 'no public URL until an approved CDN upload');
    }
  });
});

describe('content honesty', () => {
  const ids = new Set(brandAssets.map((a) => a.id));

  test('every image reference resolves to a supplied asset', () => {
    const refs = [
      ...content.branches.flatMap((b) => [b.heroImageId, ...b.galleryImageIds]),
      ...content.menuItems.map((m) => m.imageId),
      ...content.events.map((e) => e.imageId),
      ...content.campaignPages.map((c) => c.heroImageId),
      ...content.rewardRules.catalogue.map((r) => r.imageId),
    ];
    for (const r of refs) assert.ok(ids.has(r), r);
  });

  test('unapproved content is marked as sample and invents no contact details or dietary claims', () => {
    for (const b of content.branches) {
      assert.equal(b.contentStatus, 'sample');
      assert.equal(b.address, null, `${b.id} address`);
      assert.equal(b.phone, null, `${b.id} phone`);
      assert.equal(b.googleBusinessProfileUrl, null);
      assert.equal(b.ordering, false, 'order-ahead is off until confirmed per branch');
    }
    for (const m of content.menuItems) {
      assert.equal(m.contentStatus, 'sample');
      assert.deepEqual(m.dietary, []);
      assert.equal(m.allergensVerified, false);
      assert.ok(Number.isInteger(m.priceMinor));
    }
    assert.equal(content.rewardRules.contentStatus, 'sample');
  });
});

describe('secrets', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    });
  }

  test('no production-looking keys are shipped in source', () => {
    const pattern = /(sk|rk|pk)_live_[0-9a-z]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[0-9a-z-]{10,}/i;
    for (const file of walk(path.join(root, 'src'))) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), pattern, file);
    }
  });

  test('sandbox signing keys say what they are', () => {
    const src = readFileSync(path.join(root, 'src/domain/sandbox/webhooks.ts'), 'utf8');
    assert.match(src, /'sandbox-payments-public-test-key'/);
    assert.match(src, /not secrets/);
  });
});
