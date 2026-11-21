/**
 * Mock identity adapter.
 *
 * Stands in for an identity and access platform. Everything here is synthetic:
 * people are opaque `PERSON-DEMO-…` tokens with a first name and initial,
 * contact details are always masked, and no identity number, document or
 * biometric is ever represented. No proofing, passkey ceremony or code check
 * actually runs — the adapter only records that one "happened".
 */
import {
  DEMO,
  type ConceptCredential,
  type ConsentRecord,
  type Contact,
  type FamilyLink,
  type IdentityPort,
  type Partner,
  type PersonAccount,
  type ProfileField,
  type StaffMember,
  type VerificationRequest,
} from '@hao/api-contracts';
import { createCollection, DAY, HOUR, type Platform } from '@hao/local-platform';
import { GatewayError, type MutationOptions } from '@hao/shared-types';

/** Seeded family links. The workflow mock's seeded cases point at these ids. */
export const DEMO_FAMILY_LINKS = {
  /** Sipho → his child's linked profile (verified guardian). */
  siphoChild: 'LINK-DEMO-1001',
  /** Thandi → an adult she has asked to help her (still pending). */
  thandiDelegate: 'LINK-DEMO-1002',
} as const;

const SAMPLE_LEGAL_BASIS =
  'Your consent (sample wording — the legal basis will be confirmed before any pilot)';

/**
 * When Thandi opted in to WhatsApp notices. The notifications and WhatsApp
 * mocks seed the same moment, so the consent receipt, the channel preference
 * and the chat history all tell one story.
 */
const WHATSAPP_OPT_IN_AGO = 18 * HOUR;

/* ------------------------------ seeds ------------------------------ */

function seedAccounts(platform: Platform): PersonAccount[] {
  const now = platform.clock.now().getTime();
  const ago = (ms: number) => platform.clock.iso(new Date(now - ms));
  const daysAgo = (days: number) => ago(days * DAY);
  /** `verifiedAgo` is in milliseconds; `null` means the contact is not verified yet. */
  const contact = (
    channel: Contact['channel'],
    maskedValue: string,
    verifiedAgo: number | null,
  ): Contact => ({
    channel,
    maskedValue,
    verified: verifiedAgo !== null,
    verifiedAt: verifiedAgo === null ? null : ago(verifiedAgo),
  });

  return [
    {
      personToken: DEMO.persons.thandi,
      displayName: 'Thandi M.',
      givenName: 'Thandi',
      initials: 'TM',
      personaKind: 'citizen',
      personaSummary:
        'Citizen in South Africa with two applications in progress: a Smart ID replacement that needs a next step, and a passport in production.',
      locale: 'en-ZA',
      residency: 'IN_SOUTH_AFRICA',
      assuranceTier: 'A2',
      verifiedAt: daysAgo(210),
      contacts: [
        contact('EMAIL', 't•••••@example.org', 210 * DAY),
        contact('SMS', '••• ••• 4821', 210 * DAY),
        contact('WHATSAPP', '••• ••• 4821', WHATSAPP_OPT_IN_AGO),
      ],
      passkeyRegistered: true,
      recoveryState: 'READY',
      synthetic: true,
    },
    {
      personToken: DEMO.persons.sipho,
      displayName: 'Sipho D.',
      givenName: 'Sipho',
      initials: 'SD',
      personaKind: 'guardian',
      personaSummary:
        'Parent with a linked child profile, one application being checked and a draft to resume.',
      locale: 'en-ZA',
      residency: 'IN_SOUTH_AFRICA',
      assuranceTier: 'A2',
      verifiedAt: daysAgo(120),
      contacts: [
        contact('EMAIL', 's•••••@example.org', 120 * DAY),
        contact('SMS', '••• ••• 3057', 120 * DAY),
        contact('WHATSAPP', '••• ••• 3057', null),
      ],
      passkeyRegistered: true,
      recoveryState: 'READY',
      synthetic: true,
    },
    {
      personToken: DEMO.persons.aisha,
      displayName: 'Aisha K.',
      givenName: 'Aisha',
      initials: 'AK',
      personaKind: 'traveller',
      personaSummary:
        'International visitor with a basic account, no passkey yet and no applications.',
      locale: 'en-GB',
      residency: 'VISITOR',
      assuranceTier: 'A1',
      verifiedAt: null,
      contacts: [
        contact('EMAIL', 'a•••••@example.org', 3 * DAY),
        contact('SMS', '••• ••• 7306', null),
      ],
      passkeyRegistered: false,
      recoveryState: 'INCOMPLETE',
      synthetic: true,
    },
    {
      personToken: DEMO.persons.lerato,
      displayName: 'Lerato N.',
      givenName: 'Lerato',
      initials: 'LN',
      personaKind: 'citizen-abroad',
      personaSummary:
        'South African living abroad with a passport appointment booked at a mission.',
      locale: 'en-ZA',
      residency: 'ABROAD',
      assuranceTier: 'A2',
      verifiedAt: daysAgo(300),
      contacts: [
        contact('EMAIL', 'l•••••@example.org', 300 * DAY),
        contact('SMS', '••• ••• 9164', null),
        contact('WHATSAPP', '••• ••• 9164', 45 * DAY),
      ],
      passkeyRegistered: true,
      recoveryState: 'READY',
      synthetic: true,
    },
  ];
}

function seedFamilyLinks(platform: Platform): FamilyLink[] {
  const now = platform.clock.now().getTime();
  return [
    {
      linkId: DEMO_FAMILY_LINKS.siphoChild,
      personToken: DEMO.persons.sipho,
      relatedDisplayName: 'Lwazi D.',
      relatedInitials: 'LD',
      relationship: 'CHILD',
      authority: 'GUARDIAN',
      verification: 'VERIFIED',
      scope: [
        'Start and track applications for this child',
        'Book and change appointments for this child',
        'Receive messages about this child’s applications',
      ],
      expiresAt: null,
    },
    {
      linkId: DEMO_FAMILY_LINKS.thandiDelegate,
      personToken: DEMO.persons.thandi,
      relatedDisplayName: 'Nomvula M.',
      relatedInitials: 'NM',
      relationship: 'DELEGATE',
      authority: 'DELEGATED',
      verification: 'PENDING',
      scope: ['See the status of your applications', 'Book and change appointments for you'],
      expiresAt: platform.clock.iso(new Date(now + 180 * DAY)),
    },
  ];
}

function seedConsents(platform: Platform): ConsentRecord[] {
  const now = platform.clock.now().getTime();
  return [
    {
      consentRef: DEMO.consents.thandiWhatsApp,
      personToken: DEMO.persons.thandi,
      purpose: 'Application update notices on WhatsApp',
      recipient: 'Home Affairs One notifications (mock)',
      attributes: ['Masked application reference'],
      legalBasis: SAMPLE_LEGAL_BASIS,
      grantedAt: platform.clock.iso(new Date(now - WHATSAPP_OPT_IN_AGO)),
      expiresAt: null,
      revokedAt: null,
    },
    {
      consentRef: DEMO.consents.thandiBank,
      personToken: DEMO.persons.thandi,
      purpose: 'A yes or no confirmation of your identity for a new account (sample)',
      recipient: 'Sample Bank (demo)',
      attributes: ['Identity confirmed (yes or no)'],
      legalBasis: SAMPLE_LEGAL_BASIS,
      grantedAt: platform.clock.iso(new Date(now - 5 * DAY)),
      expiresAt: platform.clock.iso(new Date(now + 90 * DAY)),
      revokedAt: null,
    },
  ];
}

const DEMO_STAFF: readonly StaffMember[] = [
  {
    staffRef: DEMO.staff.caseOfficer,
    displayName: 'Nomsa P.',
    initials: 'NP',
    role: 'CASE_OFFICER',
    queues: DEMO.queues.filter((queue) => queue !== 'Specialist review'),
    synthetic: true,
  },
  {
    staffRef: DEMO.staff.supervisor,
    displayName: 'Ravi S.',
    initials: 'RS',
    role: 'SUPERVISOR',
    queues: [...DEMO.queues],
    synthetic: true,
  },
];

const DEMO_PARTNERS: readonly Partner[] = [
  {
    partnerRef: DEMO.partners.bank,
    name: 'Sample Bank (demo)',
    sector: 'Financial services',
    scopes: ['IDENTITY_CONFIRMED', 'OVER_18'],
    synthetic: true,
  },
  {
    partnerRef: DEMO.partners.college,
    name: 'Sample College (demo)',
    sector: 'Education',
    scopes: ['DOCUMENT_STATUS'],
    synthetic: true,
  },
];

/** Profile values that are not part of the account record. All synthetic. */
const PROFILE_EXTRAS: Record<string, { homeArea: string; language: string }> = {
  [DEMO.persons.thandi]: { homeArea: 'Demo Central, Sample Province A', language: 'English' },
  [DEMO.persons.sipho]: { homeArea: 'Example Ridge, Sample Province B', language: 'English' },
  [DEMO.persons.aisha]: { homeArea: 'Sample country (outside South Africa)', language: 'English' },
  [DEMO.persons.lerato]: { homeArea: 'Sample country (Europe)', language: 'English' },
};

/** Wallet concept tiles. Attribute names only — never values. */
const CONCEPT_TILES: readonly Omit<ConceptCredential, 'credentialId'>[] = [
  {
    type: 'DIGITAL_ID',
    title: 'Digital ID (concept)',
    description:
      'A design concept for a digital version of an identity document. Not a valid credential. Subject to legal, security and operational approval.',
    claimNames: ['Name', 'Photograph', 'Date of birth', 'Over 18 (yes or no)', 'Document status'],
    status: 'CONCEPT_ONLY',
  },
  {
    type: 'BIRTH_CERTIFICATE',
    title: 'Birth certificate (concept)',
    description:
      'A design concept for holding a civil certificate on your device, alongside the paper one. Not a valid credential.',
    claimNames: ['Name', 'Date of birth', 'Place of birth', 'Certificate status'],
    status: 'CONCEPT_ONLY',
  },
  {
    type: 'MARRIAGE_CERTIFICATE',
    title: 'Marriage certificate (concept)',
    description:
      'A design concept for a digital marriage or civil union certificate. Not a valid credential.',
    claimNames: ['Names of the couple', 'Date of registration', 'Certificate status'],
    status: 'CONCEPT_ONLY',
  },
  {
    type: 'TRAVEL_AUTHORISATION',
    title: 'Travel authorisation (concept)',
    description:
      'A design concept for showing the outcome of a travel authorisation. Not a valid credential and not permission to travel.',
    claimNames: ['Name', 'Authorisation status', 'Valid from', 'Valid until'],
    status: 'CONCEPT_ONLY',
  },
];

/* ----------------------------- service ----------------------------- */

const CONTACT_LABEL: Record<Contact['channel'], string> = {
  EMAIL: 'email address',
  SMS: 'mobile number',
  WHATSAPP: 'WhatsApp number',
};

function notFound(safeMessage: string): GatewayError {
  return new GatewayError('NOT_FOUND', { safeMessage });
}

/** Recovery is ready once there is a passkey and at least two verified ways to reach the person. */
function withRecoveryState(account: PersonAccount): PersonAccount {
  const verifiedContacts = account.contacts.filter((contact) => contact.verified).length;
  const ready = account.passkeyRegistered && verifiedContacts >= 2;
  return ready ? { ...account, recoveryState: 'READY' } : account;
}

export function createIdentityService(platform: Platform): IdentityPort {
  const accounts = createCollection<PersonAccount>(
    platform,
    'identity.accounts',
    (account) => account.personToken,
  );
  const familyLinks = createCollection<FamilyLink>(
    platform,
    'identity.family-links',
    (link) => link.linkId,
  );
  const consents = createCollection<ConsentRecord>(
    platform,
    'identity.consents',
    (consent) => consent.consentRef,
  );
  const verificationRequests = createCollection<VerificationRequest>(
    platform,
    'identity.verification-requests',
    (request) => request.requestId,
  );

  function ensureSeeded(): void {
    if (!accounts.exists()) accounts.replaceAll(seedAccounts(platform));
    if (!familyLinks.exists()) familyLinks.replaceAll(seedFamilyLinks(platform));
    if (!consents.exists()) consents.replaceAll(seedConsents(platform));
    if (!verificationRequests.exists()) verificationRequests.replaceAll([]);
  }

  function requireAccount(personToken: string): PersonAccount {
    ensureSeeded();
    const account = accounts.get(personToken);
    if (!account) throw notFound('We could not find that account.');
    return account;
  }

  function nextRequestId(): string {
    let id = platform.ids.next('VERIFY-DEMO');
    while (verificationRequests.get(id)) id = platform.ids.next('VERIFY-DEMO');
    return id;
  }

  return {
    async listDemoPersonas() {
      ensureSeeded();
      return accounts.all();
    },

    async getAccount(personToken) {
      return requireAccount(personToken);
    },

    async getProfileFields(personToken) {
      const account = requireAccount(personToken);
      const extras = PROFILE_EXTRAS[personToken];
      const masked = (channel: Contact['channel']) =>
        account.contacts.find((contact) => contact.channel === channel)?.maskedValue;
      const candidates: { key: string; label: string; value: string | undefined }[] = [
        { key: 'fullName', label: 'Full name', value: account.displayName },
        { key: 'preferredName', label: 'Preferred name', value: account.givenName },
        { key: 'email', label: 'Email address', value: masked('EMAIL') },
        { key: 'mobile', label: 'Mobile number', value: masked('SMS') },
        { key: 'homeArea', label: 'Home area', value: extras?.homeArea },
        { key: 'language', label: 'Preferred language', value: extras?.language },
      ];
      const fields: ProfileField[] = [];
      for (const { key, label, value } of candidates) {
        if (value !== undefined)
          fields.push({ key, label, value, source: 'IDENTITY_ADAPTER_MOCK' });
      }
      return fields;
    },

    async listFamilyLinks(personToken) {
      ensureSeeded();
      return familyLinks.find((link) => link.personToken === personToken);
    },

    async listConsents(personToken) {
      ensureSeeded();
      return consents.find((consent) => consent.personToken === personToken);
    },

    async revokeConsent(consentRef, _options: MutationOptions) {
      ensureSeeded();
      const consent = consents.get(consentRef);
      if (!consent) throw notFound('We could not find that consent.');
      if (consent.revokedAt !== null) {
        throw new GatewayError('CONFLICT', {
          safeMessage: 'This consent has already been withdrawn.',
        });
      }
      return consents.put({ ...consent, revokedAt: platform.clock.iso() });
    },

    async listConceptCredentials(personToken) {
      requireAccount(personToken);
      const suffix = personToken.slice(-4);
      return CONCEPT_TILES.map((tile) => ({
        ...tile,
        claimNames: [...tile.claimNames],
        credentialId: `CONCEPT-${tile.type}-${suffix}`,
      }));
    },

    async registerPasskey(personToken, _options: MutationOptions) {
      const account = requireAccount(personToken);
      if (account.passkeyRegistered) return account;
      return accounts.put(withRecoveryState({ ...account, passkeyRegistered: true }));
    },

    async verifyContact(personToken, channel, _options: MutationOptions) {
      const account = requireAccount(personToken);
      const existing = account.contacts.find((contact) => contact.channel === channel);
      if (existing?.verified) return account;

      const verifiedAt = platform.clock.iso();
      let contacts: Contact[];
      if (existing) {
        contacts = account.contacts.map((contact) =>
          contact.channel === channel ? { ...contact, verified: true, verifiedAt } : contact,
        );
      } else {
        // WhatsApp uses the mobile number the account already holds; nothing new is collected.
        const mobile = account.contacts.find((contact) => contact.channel === 'SMS');
        if (channel !== 'WHATSAPP' || !mobile) {
          throw new GatewayError('VALIDATION', {
            safeMessage: `Add your ${CONTACT_LABEL[channel]} to your profile before you verify it.`,
          });
        }
        contacts = [
          ...account.contacts,
          { channel, maskedValue: mobile.maskedValue, verified: true, verifiedAt },
        ];
      }
      return accounts.put(withRecoveryState({ ...account, contacts }));
    },

    async listDemoStaff() {
      return DEMO_STAFF.map((member) => ({ ...member, queues: [...member.queues] }));
    },

    async listDemoPartners() {
      return DEMO_PARTNERS.map((partner) => ({ ...partner, scopes: [...partner.scopes] }));
    },

    async requestVerification(input, _options: MutationOptions) {
      ensureSeeded();
      const partner = DEMO_PARTNERS.find((candidate) => candidate.partnerRef === input.partnerRef);
      if (!partner) throw notFound('We could not find that partner.');
      const purpose = input.purpose.trim();
      if (purpose.length < 3) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'Say what this check is for. Every request needs a purpose.',
        });
      }

      const nowMs = platform.clock.now().getTime();
      // Scope and consent are checked before the subject is looked at, so a
      // refusal never reveals whether a token belongs to a real account.
      const consent = input.consentRef === null ? undefined : consents.get(input.consentRef);
      const consentIsLive =
        consent !== undefined &&
        consent.personToken === input.subjectToken &&
        consent.revokedAt === null &&
        (consent.expiresAt === null || Date.parse(consent.expiresAt) > nowMs) &&
        consent.recipient === partner.name;

      let result: VerificationRequest['result'];
      if (!partner.scopes.includes(input.attribute)) result = 'REFUSED_OUT_OF_SCOPE';
      else if (!consentIsLive) result = 'REFUSED_NO_CONSENT';
      else if (accounts.get(input.subjectToken)) result = 'CONFIRMED';
      else result = 'NOT_CONFIRMED';

      // Every request is stored, including refusals. Only a yes/no result is
      // ever recorded or returned — never the underlying data.
      return verificationRequests.put({
        requestId: nextRequestId(),
        partnerRef: partner.partnerRef,
        subjectToken: input.subjectToken,
        attribute: input.attribute,
        purpose,
        consentRef: input.consentRef,
        result,
        at: platform.clock.iso(),
      });
    },

    async listVerificationRequests(partnerRef) {
      ensureSeeded();
      // Stored oldest first; returned newest first.
      return verificationRequests.find((request) => request.partnerRef === partnerRef).reverse();
    },
  };
}
