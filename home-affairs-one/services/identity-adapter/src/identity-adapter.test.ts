import {
  ConceptCredentialSchema,
  ConsentRecordSchema,
  DEMO,
  FamilyLinkSchema,
  PartnerSchema,
  PersonAccountSchema,
  ProfileFieldSchema,
  StaffMemberSchema,
  VerificationRequestSchema,
  type ConsentRecord,
} from '@hao/api-contracts';
import { createCollection, createLocalPlatform, DAY } from '@hao/local-platform';
import { describe, expect, it } from 'vitest';
import { createIdentityService, DEMO_FAMILY_LINKS } from './index';

const START = new Date('2026-11-21T08:00:00Z');
const key = (name: string) => ({ idempotencyKey: `test-${name}` });

function setup() {
  let current = START;
  const platform = createLocalPlatform({ now: () => current });
  return {
    platform,
    identity: createIdentityService(platform),
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('identity adapter: seed data', () => {
  it('offers the four synthetic personas, each valid against the contract', async () => {
    const { identity } = setup();
    const personas = await identity.listDemoPersonas();
    for (const persona of personas) PersonAccountSchema.parse(persona);
    expect(personas.map((persona) => persona.personToken)).toEqual([
      DEMO.persons.thandi,
      DEMO.persons.sipho,
      DEMO.persons.aisha,
      DEMO.persons.lerato,
    ]);
    expect(personas.map((persona) => persona.displayName)).toEqual([
      'Thandi M.',
      'Sipho D.',
      'Aisha K.',
      'Lerato N.',
    ]);
  });

  it('gives each persona the verification state the journeys rely on', async () => {
    const { identity } = setup();
    const thandi = await identity.getAccount(DEMO.persons.thandi);
    expect(thandi).toMatchObject({
      personaKind: 'citizen',
      residency: 'IN_SOUTH_AFRICA',
      assuranceTier: 'A2',
      passkeyRegistered: true,
      recoveryState: 'READY',
    });
    expect(thandi.contacts.map((contact) => [contact.channel, contact.verified])).toEqual([
      ['EMAIL', true],
      ['SMS', true],
      ['WHATSAPP', true],
    ]);

    const sipho = await identity.getAccount(DEMO.persons.sipho);
    expect(sipho).toMatchObject({
      personaKind: 'guardian',
      assuranceTier: 'A2',
      passkeyRegistered: true,
    });

    const aisha = await identity.getAccount(DEMO.persons.aisha);
    expect(aisha).toMatchObject({
      personaKind: 'traveller',
      residency: 'VISITOR',
      assuranceTier: 'A1',
      passkeyRegistered: false,
      recoveryState: 'INCOMPLETE',
      verifiedAt: null,
    });
    expect(aisha.contacts.filter((contact) => contact.verified).map((c) => c.channel)).toEqual([
      'EMAIL',
    ]);

    const lerato = await identity.getAccount(DEMO.persons.lerato);
    expect(lerato).toMatchObject({
      personaKind: 'citizen-abroad',
      residency: 'ABROAD',
      assuranceTier: 'A2',
    });
  });

  it('only ever holds masked contact details', async () => {
    const { identity } = setup();
    for (const persona of await identity.listDemoPersonas()) {
      for (const contact of persona.contacts) {
        expect(contact.maskedValue).toContain('•');
        expect(contact.maskedValue).not.toMatch(/\d{5,}/);
      }
    }
  });

  it('throws NOT_FOUND for an unknown person', async () => {
    const { identity } = setup();
    await expect(identity.getAccount('PERSON-DEMO-ZZZZ')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(identity.getProfileFields('PERSON-DEMO-ZZZZ')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
  });

  it('returns profile fields for confirmation, labelled with their source', async () => {
    const { identity } = setup();
    for (const token of Object.values(DEMO.persons)) {
      const fields = await identity.getProfileFields(token);
      for (const field of fields) ProfileFieldSchema.parse(field);
      expect(fields.map((field) => field.key)).toEqual([
        'fullName',
        'preferredName',
        'email',
        'mobile',
        'homeArea',
        'language',
      ]);
      expect(new Set(fields.map((field) => field.source))).toEqual(
        new Set(['IDENTITY_ADAPTER_MOCK']),
      );
    }
    const thandi = await identity.getProfileFields(DEMO.persons.thandi);
    expect(thandi.find((field) => field.key === 'email')?.value).toBe('t•••••@example.org');
    expect(thandi.find((field) => field.key === 'mobile')?.value).toBe('••• ••• 4821');
  });

  it('links Sipho to a child profile and Thandi to a pending delegate', async () => {
    const { identity } = setup();
    const sipho = await identity.listFamilyLinks(DEMO.persons.sipho);
    const thandi = await identity.listFamilyLinks(DEMO.persons.thandi);
    for (const link of [...sipho, ...thandi]) FamilyLinkSchema.parse(link);

    expect(sipho).toHaveLength(1);
    expect(sipho[0]).toMatchObject({
      linkId: 'LINK-DEMO-1001',
      relatedDisplayName: 'Lwazi D.',
      relationship: 'CHILD',
      authority: 'GUARDIAN',
      verification: 'VERIFIED',
      expiresAt: null,
    });
    expect(sipho[0]?.linkId).toBe(DEMO_FAMILY_LINKS.siphoChild);
    expect(sipho[0]?.scope).toContain('Start and track applications for this child');

    expect(thandi).toHaveLength(1);
    expect(thandi[0]).toMatchObject({
      linkId: 'LINK-DEMO-1002',
      relatedDisplayName: 'Nomvula M.',
      relationship: 'DELEGATE',
      authority: 'DELEGATED',
      verification: 'PENDING',
    });
    expect(thandi[0]?.expiresAt).not.toBeNull();

    expect(await identity.listFamilyLinks(DEMO.persons.aisha)).toEqual([]);
    expect(await identity.listFamilyLinks(DEMO.persons.lerato)).toEqual([]);
  });

  it('shows wallet tiles as concepts only, with attribute names and no values', async () => {
    const { identity } = setup();
    for (const token of Object.values(DEMO.persons)) {
      const tiles = await identity.listConceptCredentials(token);
      for (const tile of tiles) ConceptCredentialSchema.parse(tile);
      expect(tiles.length).toBeGreaterThanOrEqual(3);
      expect(tiles.length).toBeLessThanOrEqual(4);
      expect(new Set(tiles.map((tile) => tile.credentialId)).size).toBe(tiles.length);
      for (const tile of tiles) {
        expect(tile.status).toBe('CONCEPT_ONLY');
        for (const claim of tile.claimNames) expect(claim).not.toMatch(/\d{3,}|@|:/);
      }
    }
  });

  it('lists the demo staff and accredited demo partners', async () => {
    const { identity } = setup();
    const staff = await identity.listDemoStaff();
    for (const member of staff) StaffMemberSchema.parse(member);
    expect(staff).toEqual([
      expect.objectContaining({
        staffRef: DEMO.staff.caseOfficer,
        displayName: 'Nomsa P.',
        role: 'CASE_OFFICER',
        queues: ['Identity documents', 'Passports', 'Civic registration'],
      }),
      expect.objectContaining({
        staffRef: DEMO.staff.supervisor,
        displayName: 'Ravi S.',
        role: 'SUPERVISOR',
        queues: [...DEMO.queues],
      }),
    ]);

    const partners = await identity.listDemoPartners();
    for (const partner of partners) PartnerSchema.parse(partner);
    expect(partners).toEqual([
      expect.objectContaining({
        partnerRef: DEMO.partners.bank,
        name: 'Sample Bank (demo)',
        sector: 'Financial services',
        scopes: ['IDENTITY_CONFIRMED', 'OVER_18'],
      }),
      expect.objectContaining({
        partnerRef: DEMO.partners.college,
        name: 'Sample College (demo)',
        sector: 'Education',
        scopes: ['DOCUMENT_STATUS'],
      }),
    ]);
  });
});

describe('identity adapter: consents', () => {
  it('seeds Thandi’s WhatsApp and bank consents', async () => {
    const { identity } = setup();
    const consents = await identity.listConsents(DEMO.persons.thandi);
    for (const consent of consents) ConsentRecordSchema.parse(consent);
    expect(consents.map((consent) => consent.consentRef)).toEqual([
      DEMO.consents.thandiWhatsApp,
      DEMO.consents.thandiBank,
    ]);
    expect(consents[0]).toMatchObject({
      recipient: 'Home Affairs One notifications (mock)',
      attributes: ['Masked application reference'],
      // 18 hours before the test clock: the same moment the WhatsApp mock records the opt-in.
      grantedAt: '2026-11-20T16:00:00+02:00',
      expiresAt: null,
      revokedAt: null,
    });
    expect(consents[1]).toMatchObject({
      recipient: 'Sample Bank (demo)',
      attributes: ['Identity confirmed (yes or no)'],
      revokedAt: null,
    });
    const expiresAt = Date.parse(consents[1]?.expiresAt ?? '');
    expect(Math.round((expiresAt - START.getTime()) / DAY)).toBe(90);
    expect(await identity.listConsents(DEMO.persons.sipho)).toEqual([]);
  });

  it('revokes a consent once, and refuses to revoke it twice', async () => {
    const { identity } = setup();
    const revoked = await identity.revokeConsent(DEMO.consents.thandiWhatsApp, key('revoke'));
    ConsentRecordSchema.parse(revoked);
    expect(revoked.revokedAt).toBe('2026-11-21T10:00:00+02:00');

    const stored = await identity.listConsents(DEMO.persons.thandi);
    expect(stored.find((c) => c.consentRef === DEMO.consents.thandiWhatsApp)?.revokedAt).toBe(
      revoked.revokedAt,
    );

    await expect(
      identity.revokeConsent(DEMO.consents.thandiWhatsApp, key('revoke-again')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
    await expect(
      identity.revokeConsent('CONSENT-DEMO-404', key('revoke-missing')),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
  });
});

describe('identity adapter: account changes', () => {
  it('records a passkey and keeps it for the next service instance', async () => {
    const { identity, platform } = setup();
    const updated = await identity.registerPasskey(DEMO.persons.aisha, key('passkey'));
    PersonAccountSchema.parse(updated);
    expect(updated.passkeyRegistered).toBe(true);
    // One verified contact is not enough for recovery yet.
    expect(updated.recoveryState).toBe('INCOMPLETE');

    const reopened = createIdentityService(platform);
    expect((await reopened.getAccount(DEMO.persons.aisha)).passkeyRegistered).toBe(true);
  });

  it('marks a contact verified and completes recovery once two contacts and a passkey exist', async () => {
    const { identity } = setup();
    await identity.registerPasskey(DEMO.persons.aisha, key('passkey'));
    const updated = await identity.verifyContact(DEMO.persons.aisha, 'SMS', key('verify-sms'));
    PersonAccountSchema.parse(updated);
    const sms = updated.contacts.find((contact) => contact.channel === 'SMS');
    expect(sms).toMatchObject({ verified: true, verifiedAt: '2026-11-21T10:00:00+02:00' });
    expect(updated.recoveryState).toBe('READY');
    expect((await identity.getAccount(DEMO.persons.aisha)).recoveryState).toBe('READY');
  });

  it('adds WhatsApp on the mobile number already held, and leaves verified contacts alone', async () => {
    const { identity } = setup();
    const aisha = await identity.verifyContact(DEMO.persons.aisha, 'WHATSAPP', key('verify-wa'));
    PersonAccountSchema.parse(aisha);
    expect(aisha.contacts.find((contact) => contact.channel === 'WHATSAPP')).toMatchObject({
      maskedValue: '••• ••• 7306',
      verified: true,
    });

    const before = await identity.getAccount(DEMO.persons.thandi);
    const after = await identity.verifyContact(DEMO.persons.thandi, 'EMAIL', key('verify-email'));
    expect(after).toEqual(before);
  });

  it('throws NOT_FOUND when changing an unknown account', async () => {
    const { identity } = setup();
    await expect(identity.registerPasskey('PERSON-DEMO-ZZZZ', key('x'))).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(
      identity.verifyContact('PERSON-DEMO-ZZZZ', 'EMAIL', key('y')),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
  });
});

describe('identity adapter: accredited partner checks', () => {
  const bankRequest = {
    partnerRef: DEMO.partners.bank,
    subjectToken: DEMO.persons.thandi,
    attribute: 'IDENTITY_CONFIRMED' as const,
    purpose: 'Opening an account (sample)',
    consentRef: DEMO.consents.thandiBank as string | null,
  };

  it('confirms with a yes/no result only when a live consent names the partner', async () => {
    const { identity } = setup();
    const result = await identity.requestVerification(bankRequest, key('verify'));
    // `.strict()` proves nothing beyond the contract fields is returned.
    VerificationRequestSchema.strict().parse(result);
    expect(result).toMatchObject({
      requestId: 'VERIFY-DEMO-1001',
      partnerRef: DEMO.partners.bank,
      subjectToken: DEMO.persons.thandi,
      consentRef: DEMO.consents.thandiBank,
      result: 'CONFIRMED',
    });
  });

  it('refuses an attribute outside the partner’s scope', async () => {
    const { identity } = setup();
    const result = await identity.requestVerification(
      { ...bankRequest, attribute: 'DOCUMENT_STATUS' },
      key('scope'),
    );
    expect(result.result).toBe('REFUSED_OUT_OF_SCOPE');

    const college = await identity.requestVerification(
      { ...bankRequest, partnerRef: DEMO.partners.college },
      key('scope-college'),
    );
    expect(college.result).toBe('REFUSED_OUT_OF_SCOPE');
  });

  it('refuses without a consent, with someone else’s consent, or with one for another recipient', async () => {
    const { identity } = setup();
    const none = await identity.requestVerification(
      { ...bankRequest, consentRef: null },
      key('none'),
    );
    expect(none.result).toBe('REFUSED_NO_CONSENT');

    const unknownRef = await identity.requestVerification(
      { ...bankRequest, consentRef: 'CONSENT-DEMO-404' },
      key('unknown-ref'),
    );
    expect(unknownRef.result).toBe('REFUSED_NO_CONSENT');

    const wrongRecipient = await identity.requestVerification(
      { ...bankRequest, consentRef: DEMO.consents.thandiWhatsApp },
      key('wrong-recipient'),
    );
    expect(wrongRecipient.result).toBe('REFUSED_NO_CONSENT');

    const wrongSubject = await identity.requestVerification(
      { ...bankRequest, subjectToken: DEMO.persons.sipho },
      key('wrong-subject'),
    );
    expect(wrongSubject.result).toBe('REFUSED_NO_CONSENT');
  });

  it('gives the same refusal for an unknown subject as for a known one without consent', async () => {
    const { identity } = setup();
    const unknown = await identity.requestVerification(
      { ...bankRequest, subjectToken: 'PERSON-DEMO-ZZZZ' },
      key('unknown-subject'),
    );
    expect(unknown.result).toBe('REFUSED_NO_CONSENT');
  });

  it('refuses once the consent is revoked or has expired', async () => {
    const revokedCase = setup();
    await revokedCase.identity.revokeConsent(DEMO.consents.thandiBank, key('revoke'));
    const revoked = await revokedCase.identity.requestVerification(bankRequest, key('revoked'));
    expect(revoked.result).toBe('REFUSED_NO_CONSENT');

    const expiredCase = setup();
    await expiredCase.identity.listConsents(DEMO.persons.thandi); // seed at the start date
    expiredCase.advance(91 * DAY);
    const expired = await expiredCase.identity.requestVerification(bankRequest, key('expired'));
    expect(expired.result).toBe('REFUSED_NO_CONSENT');
  });

  it('answers NOT_CONFIRMED when a consent is live but the subject is not a known account', async () => {
    const { identity, platform } = setup();
    await identity.listDemoPersonas(); // seed first
    const consents = createCollection<ConsentRecord>(
      platform,
      'identity.consents',
      (consent) => consent.consentRef,
    );
    consents.put({
      consentRef: 'CONSENT-DEMO-777',
      personToken: 'PERSON-DEMO-ZZZZ',
      purpose: 'Test consent',
      recipient: 'Sample Bank (demo)',
      attributes: ['Identity confirmed (yes or no)'],
      legalBasis: 'Test',
      grantedAt: platform.clock.iso(),
      expiresAt: null,
      revokedAt: null,
    });
    const result = await identity.requestVerification(
      { ...bankRequest, subjectToken: 'PERSON-DEMO-ZZZZ', consentRef: 'CONSENT-DEMO-777' },
      key('not-confirmed'),
    );
    expect(result.result).toBe('NOT_CONFIRMED');
  });

  it('stores every request, including refusals, newest first and per partner', async () => {
    const { identity } = setup();
    expect(await identity.listVerificationRequests(DEMO.partners.bank)).toEqual([]);

    await identity.requestVerification(bankRequest, key('one'));
    await identity.requestVerification({ ...bankRequest, consentRef: null }, key('two'));
    await identity.requestVerification(
      { ...bankRequest, partnerRef: DEMO.partners.college, attribute: 'DOCUMENT_STATUS' },
      key('three'),
    );

    const bank = await identity.listVerificationRequests(DEMO.partners.bank);
    for (const request of bank) VerificationRequestSchema.strict().parse(request);
    expect(bank.map((request) => [request.requestId, request.result])).toEqual([
      ['VERIFY-DEMO-1002', 'REFUSED_NO_CONSENT'],
      ['VERIFY-DEMO-1001', 'CONFIRMED'],
    ]);
    const college = await identity.listVerificationRequests(DEMO.partners.college);
    expect(college.map((request) => request.result)).toEqual(['REFUSED_NO_CONSENT']);
  });

  it('rejects an unknown partner or a request with no purpose', async () => {
    const { identity } = setup();
    await expect(
      identity.requestVerification({ ...bankRequest, partnerRef: 'PARTNER-DEMO-9999' }, key('p')),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
    await expect(
      identity.requestVerification({ ...bankRequest, purpose: '  ' }, key('q')),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
  });
});
