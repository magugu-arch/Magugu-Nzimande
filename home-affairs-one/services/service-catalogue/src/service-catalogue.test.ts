import {
  DEMO,
  GuidanceArticleSchema,
  SearchResultSchema,
  ServiceDefinitionSchema,
  ServiceDomainInfoSchema,
  type ServiceDefinition,
} from '@hao/api-contracts';
import { STATUS_FAMILIES, STATUS_INFO } from '@hao/shared-types';
import { describe, expect, it } from 'vitest';
import { createCatalogueService, SAMPLE_CATALOGUE, searchTerms } from './index';

const S = DEMO.services;
const catalogue = createCatalogueService();

const byCode = (code: string): ServiceDefinition => {
  const service = SAMPLE_CATALOGUE.services.find((candidate) => candidate.code === code);
  if (!service) throw new Error(`missing service ${code}`);
  return service;
};

/** Every string anywhere in a value, however deeply nested. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

const applyOnline = SAMPLE_CATALOGUE.services.filter((s) => s.availability === 'APPLY_ONLINE');
const handoffs = SAMPLE_CATALOGUE.services.filter((s) => s.availability === 'GUIDANCE_AND_HANDOFF');
const informationOnly = SAMPLE_CATALOGUE.services.filter(
  (s) => s.availability === 'INFORMATION_ONLY',
);

describe('sample catalogue: version and domains', () => {
  it('carries the shared content version, effective date and a sample notice', async () => {
    expect(SAMPLE_CATALOGUE.version).toBe(DEMO.contentVersion);
    expect(SAMPLE_CATALOGUE.effectiveDate).toBe(DEMO.contentEffectiveDate);
    expect(SAMPLE_CATALOGUE.notice).toMatch(/sample content/i);
    expect(SAMPLE_CATALOGUE.notice).toMatch(/prototype/i);
    expect(SAMPLE_CATALOGUE.notice).toMatch(/requirements, fees and timeframes/);
    // One sentence.
    expect(SAMPLE_CATALOGUE.notice.match(/[.!?]/g)).toHaveLength(1);
    expect(await catalogue.getContentVersion()).toEqual({
      version: DEMO.contentVersion,
      effectiveDate: DEMO.contentEffectiveDate,
      notice: SAMPLE_CATALOGUE.notice,
    });
  });

  it('lists the nine domains with plain titles and their photographs', async () => {
    const domains = await catalogue.listDomains();
    for (const domain of domains) ServiceDomainInfoSchema.parse(domain);
    expect(domains.map((d) => [d.domain, d.title, d.assetId])).toEqual([
      ['IDENTITY', 'Identity', 'A23'],
      ['PASSPORTS', 'Passports', 'A15'],
      ['BIRTH_FAMILY', 'Birth and family', 'A09'],
      ['MARRIAGE', 'Marriage and civil union', 'A20'],
      ['DEATH', 'Death and estate events', 'A13'],
      ['CITIZENSHIP', 'Citizenship', 'A18'],
      ['IMMIGRATION', 'Visas and immigration', 'A31'],
      ['TRAVEL', 'Travel and border', 'A35'],
      ['SUPPORT', 'Help and complaints', 'A34'],
    ]);
    for (const domain of domains) {
      // A single sentence.
      expect(domain.summary.match(/[.!?]/g)).toHaveLength(1);
    }
  });
});

describe('sample catalogue: services', () => {
  it('defines every shared service code exactly once, valid against the contract', () => {
    for (const service of SAMPLE_CATALOGUE.services) ServiceDefinitionSchema.parse(service);
    const codes = SAMPLE_CATALOGUE.services.map((service) => service.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...Object.values(S)].sort());
  });

  it('has unique kebab-case slugs derived from the codes', () => {
    const slugs = SAMPLE_CATALOGUE.services.map((service) => service.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const service of SAMPLE_CATALOGUE.services) {
      expect(service.slug).toBe(service.code.toLowerCase().replaceAll('_', '-'));
    }
  });

  it('matches the agreed scope for each service', () => {
    const expected: [
      string,
      ServiceDefinition['domain'],
      string,
      ServiceDefinition['availability'],
      ServiceDefinition['release'],
      ServiceDefinition['requiredTier'],
      boolean,
      string,
    ][] = [
      [
        S.smartIdReplacement,
        'IDENTITY',
        'Replace a Smart ID',
        'APPLY_ONLINE',
        'MVP',
        'A3',
        true,
        'A16',
      ],
      [
        S.smartIdFirst,
        'IDENTITY',
        'Apply for your first ID',
        'GUIDANCE_AND_HANDOFF',
        'MVP',
        'A2',
        true,
        'A23',
      ],
      [
        S.adultPassport,
        'PASSPORTS',
        'Apply for an adult passport',
        'APPLY_ONLINE',
        'MVP',
        'A3',
        true,
        'A19',
      ],
      [
        S.passportCollection,
        'PASSPORTS',
        'Collect or receive your passport',
        'INFORMATION_ONLY',
        'MVP',
        'A0',
        false,
        'A17',
      ],
      [
        S.birthRegistration,
        'BIRTH_FAMILY',
        'Register a birth',
        'APPLY_ONLINE',
        'PHASE_2',
        'A3',
        true,
        'A22',
      ],
      [
        S.birthCertificate,
        'BIRTH_FAMILY',
        'Request a birth certificate',
        'GUIDANCE_AND_HANDOFF',
        'PHASE_2',
        'A2',
        false,
        'A09',
      ],
      [
        S.marriageCertificate,
        'MARRIAGE',
        'Marriage and civil union services',
        'GUIDANCE_AND_HANDOFF',
        'PHASE_2',
        'A2',
        false,
        'A20',
      ],
      [
        S.deathRegistration,
        'DEATH',
        'Register a death',
        'GUIDANCE_AND_HANDOFF',
        'PHASE_2',
        'A2',
        false,
        'A13',
      ],
      [
        S.citizenshipGuidance,
        'CITIZENSHIP',
        'Citizenship guidance',
        'GUIDANCE_AND_HANDOFF',
        'PHASE_2',
        'A2',
        false,
        'A18',
      ],
      [
        S.eta,
        'IMMIGRATION',
        'Apply for an electronic travel authorisation (ETA)',
        'GUIDANCE_AND_HANDOFF',
        'MVP',
        'A1',
        false,
        'A31',
      ],
      [
        S.visaInformation,
        'IMMIGRATION',
        'Visa information',
        'INFORMATION_ONLY',
        'PHASE_2',
        'A0',
        false,
        'A36',
      ],
      [
        S.residentServices,
        'IMMIGRATION',
        'Permits and resident services',
        'INFORMATION_ONLY',
        'PHASE_3',
        'A0',
        false,
        'A28',
      ],
      [
        S.travelAlerts,
        'TRAVEL',
        'Travel and border updates',
        'INFORMATION_ONLY',
        'MVP',
        'A0',
        false,
        'A35',
      ],
    ];
    expect(SAMPLE_CATALOGUE.services.map((service) => service.code)).toEqual(
      expected.map(([code]) => code),
    );
    for (const [
      code,
      domain,
      title,
      availability,
      release,
      requiredTier,
      needsPoint,
      assetId,
    ] of expected) {
      expect(byCode(code)).toMatchObject({
        domain,
        title,
        availability,
        release,
        requiredTier,
        needsServicePoint: needsPoint,
        assetId,
      });
    }
  });

  it('stamps every service as sample content with the current version', () => {
    const domains = new Set(SAMPLE_CATALOGUE.domains.map((domain) => domain.domain));
    for (const service of SAMPLE_CATALOGUE.services) {
      expect(service.sample).toBe(true);
      expect(service.contentVersion).toBe(DEMO.contentVersion);
      expect(service.effectiveDate).toBe(DEMO.contentEffectiveDate);
      expect(domains.has(service.domain)).toBe(true);
    }
  });

  it('gives every service a plain-language journey, placeholders, channels and cautions', () => {
    for (const service of SAMPLE_CATALOGUE.services) {
      expect(service.summary.length).toBeGreaterThan(40);
      expect(service.audience.length).toBeGreaterThan(0);
      expect(service.journey.length).toBeGreaterThanOrEqual(4);
      expect(service.journey.length).toBeLessThanOrEqual(8);
      for (const step of service.journey) {
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.detail.length).toBeGreaterThan(20);
      }
      expect(service.requirements.length).toBeGreaterThanOrEqual(2);
      expect(service.requirements.length).toBeLessThanOrEqual(4);
      for (const item of service.requirements) {
        expect(item.label).toMatch(/^Sample requirement: /);
        expect(item.detail).toBe(
          'Placeholder. The real list will be supplied and verified by the service owner.',
        );
      }
      const requirementIds = service.requirements.map((item) => item.id);
      expect(new Set(requirementIds).size).toBe(requirementIds.length);
      expect(service.channels.length).toBeGreaterThan(0);
      expect(new Set(service.channels).size).toBe(service.channels.length);
      expect(service.cautions.length).toBeGreaterThan(0);
    }
  });

  it('gives every apply-online service a form with one evidence field and a sample fee', () => {
    expect(applyOnline.map((service) => service.code)).toEqual([
      S.smartIdReplacement,
      S.adultPassport,
      S.birthRegistration,
    ]);
    for (const service of applyOnline) {
      expect(service.fee).toEqual({
        kind: 'SAMPLE',
        amountCents: 100,
        currency: 'ZAR',
        note: 'Sample amount for the payment sandbox. Not a real fee.',
      });
      const steps = service.form?.steps ?? [];
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps.length).toBeLessThanOrEqual(3);
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);

      const fields = steps.flatMap((step) => step.fields);
      expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
      const evidence = fields.filter((field) => field.type === 'evidence');
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({
        required: true,
        hint: 'You cannot upload real documents in this prototype. Attach a synthetic placeholder instead.',
      });
      expect(evidence[0]?.label).toMatch(/sample placeholder/);
      expect(steps.at(-1)).toMatchObject({ title: 'Supporting evidence' });
      expect(steps.at(-1)?.fields).toHaveLength(1);
    }
  });

  it('starts every form with profile details to confirm, each with a reason', () => {
    for (const service of applyOnline) {
      const first = service.form?.steps[0];
      expect(first?.title).toBe('Your details');
      expect(first?.fields.map((field) => field.profileKey)).toEqual([
        'fullName',
        'email',
        'mobile',
      ]);
      for (const field of first?.fields ?? []) expect(field.why?.length).toBeGreaterThan(10);
    }
  });

  it('builds well-formed form fields', () => {
    for (const service of applyOnline) {
      const fields = (service.form?.steps ?? []).flatMap((step) => step.fields);
      for (const field of fields) {
        expect(field.id).toMatch(/^[a-z][a-z0-9-]+$/);
        if (field.type === 'select' || field.type === 'radio') {
          expect(field.options?.length).toBeGreaterThanOrEqual(2);
          const values = (field.options ?? []).map((option) => option.value);
          expect(new Set(values).size).toBe(values.length);
        } else {
          expect(field.options).toBeUndefined();
        }
      }
      // Most fields say why they are asked.
      const explained = fields.filter((field) => field.why !== undefined).length;
      expect(explained / fields.length).toBeGreaterThan(0.5);
    }
    const reason = byCode(S.smartIdReplacement)
      .form?.steps.flatMap((step) => step.fields)
      .find((field) => field.id === 'replacement-reason');
    expect(reason?.options?.map((option) => option.label)).toEqual([
      'Lost',
      'Stolen',
      'Damaged',
      'My details changed',
    ]);
  });

  it('never states a fee for a service that is not applied for online', () => {
    for (const service of [...handoffs, ...informationOnly]) {
      expect(service.fee).toEqual({
        kind: 'TO_BE_CONFIRMED',
        note: 'Shown here once the service owner confirms it.',
      });
      expect(service.form).toBeUndefined();
    }
  });

  it('hands every guidance service off to a placeholder example.gov.za address', () => {
    expect(handoffs.length).toBeGreaterThan(0);
    for (const service of handoffs) {
      expect(service.handoff).toBeDefined();
      const url = new URL(service.handoff?.destination ?? '');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('example.gov.za');
      expect(service.handoff?.label.length).toBeGreaterThan(5);
      expect(service.handoff?.description.length).toBeGreaterThan(20);
    }
    for (const service of applyOnline) expect(service.handoff).toBeUndefined();
  });

  it('leaves no dead ends: later-phase services say why, what next and how to get help', () => {
    const later = SAMPLE_CATALOGUE.services.filter(
      (service) => service.release !== 'MVP' && service.availability !== 'APPLY_ONLINE',
    );
    expect(later.map((service) => service.code)).toContain(S.residentServices);
    for (const service of later) {
      expect(service.unavailable?.reason.length).toBeGreaterThan(20);
      expect(service.unavailable?.whatNext.length).toBeGreaterThan(20);
      expect(service.unavailable?.alternatives.length).toBeGreaterThanOrEqual(2);
    }
    expect(byCode(S.residentServices).unavailable?.reason).toMatch(/legal category/);
    expect(byCode(S.residentServices).unavailable?.reason).toMatch(/review by a person/);
  });

  it('states the limits that matter, plainly', () => {
    expect(byCode(S.eta).cautions).toContain('An application receipt is not travel authorisation.');
    expect(byCode(S.birthRegistration).cautions).toContain(
      'Only a registrar can create or change the legal birth record.',
    );
    for (const service of applyOnline) {
      expect(service.cautions).toContain(
        'We only show timeframes when they come from live operational data.',
      );
    }
    const birthJourney = byCode(S.birthRegistration)
      .journey.map((step) => step.detail)
      .join(' ');
    expect(birthJourney).toMatch(/never creates or changes the legal birth record/);
    expect(birthJourney).toMatch(/registrar/);
    expect(byCode(S.smartIdReplacement).journey).toHaveLength(8);
  });

  it('only uses photographs from the 60-image register', () => {
    const assetIds = [
      ...SAMPLE_CATALOGUE.services.map((service) => service.assetId),
      ...SAMPLE_CATALOGUE.domains.map((domain) => domain.assetId),
    ];
    for (const assetId of assetIds) {
      expect(assetId).toMatch(/^A\d{2}$/);
      const number = Number(assetId.slice(1));
      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(60);
    }
  });
});

describe('sample catalogue: guidance', () => {
  it('offers 12 to 16 short sample articles, valid against the contract', async () => {
    const guidance = await catalogue.listGuidance();
    expect(guidance).toEqual(SAMPLE_CATALOGUE.guidance);
    expect(guidance.length).toBeGreaterThanOrEqual(12);
    expect(guidance.length).toBeLessThanOrEqual(16);
    const codes = new Set<string>(Object.values(S));
    for (const article of guidance) {
      GuidanceArticleSchema.parse(article);
      expect(article.sample).toBe(true);
      expect(article.contentVersion).toBe(DEMO.contentVersion);
      expect(article.effectiveDate).toBe(DEMO.contentEffectiveDate);
      expect(article.id).toMatch(/^[a-z][a-z0-9-]+$/);
      expect(article.body.length).toBeGreaterThanOrEqual(2);
      expect(article.body.length).toBeLessThanOrEqual(4);
      expect(article.tags.length).toBeGreaterThan(0);
      for (const code of article.serviceCodes) expect(codes.has(code)).toBe(true);
    }
    expect(new Set(guidance.map((article) => article.id)).size).toBe(guidance.length);
    expect(new Set(guidance.map((article) => article.title)).size).toBe(guidance.length);
  });

  it('covers the topics the product design depends on', () => {
    const titles = SAMPLE_CATALOGUE.guidance.map((article) => article.title);
    for (const title of [
      'How sign-in and verification levels work',
      'What each application status means',
      'How we contact you, and what we will never ask for',
      'Using WhatsApp safely',
      'Saving and resuming an application',
      'What happens at an in-person capture appointment (sample)',
      'Getting help in person, or for someone else',
      'Applying from outside South Africa (sample)',
      'Your privacy and consent receipts',
      'If something is not available online yet',
      'Accessibility support',
      'About the digital wallet concept',
    ]) {
      expect(titles).toContain(title);
    }
  });

  it('explains every status in the words of the shared taxonomy', () => {
    const article = SAMPLE_CATALOGUE.guidance.find((a) => a.id === 'application-status-meanings');
    const text = article?.body.join(' ') ?? '';
    for (const family of STATUS_FAMILIES) {
      expect(text).toContain(STATUS_INFO[family].userLabel);
      expect(text).toContain(STATUS_INFO[family].rule);
    }
  });

  it('says what we will never ask for, and that the wallet is a future concept', () => {
    const contact = SAMPLE_CATALOGUE.guidance.find((a) => a.id === 'how-we-contact-you');
    const contactText = contact?.body.join(' ') ?? '';
    expect(contactText).toMatch(/never ask you for a password, a one-time PIN/);
    expect(contactText).toMatch(/payment into a personal account/);

    const wallet = SAMPLE_CATALOGUE.guidance.find((a) => a.id === 'digital-wallet-concept');
    const walletText = wallet?.body.join(' ') ?? '';
    expect(walletText).toMatch(/future idea/);
    expect(walletText).toMatch(/subject to legal, security and operational approval/);
    expect(walletText).toMatch(
      /Nothing in the wallet section of this prototype is a valid credential/,
    );
  });
});

describe('sample catalogue: content guardrails', () => {
  const strings = allStrings(SAMPLE_CATALOGUE);

  it('contains no currency amount other than the structured sample fee', () => {
    expect(strings.length).toBeGreaterThan(500);
    for (const text of strings) {
      expect(text).not.toMatch(/R\s?\d/);
      expect(text).not.toMatch(/\bZAR\s?\d/);
      expect(text).not.toMatch(/\brand\b/i);
    }
    const amounts = SAMPLE_CATALOGUE.services.flatMap((service) =>
      service.fee.kind === 'SAMPLE' ? [service.fee.amountCents] : [],
    );
    expect(new Set(amounts)).toEqual(new Set([100]));
  });

  it('contains nothing that looks like an identity number or a long reference', () => {
    for (const text of strings) {
      expect(text).not.toMatch(/\d{13}/);
      expect(text).not.toMatch(/\d{6,}/);
    }
  });

  it('states no durations, ages or deadlines that could be read as real rules', () => {
    for (const text of strings) {
      expect(text).not.toMatch(
        /\b\d+\s*(?:working\s+|business\s+)?(?:minute|hour|day|week|month|year)s?\b/i,
      );
      expect(text).not.toMatch(/\b(?:aged?|over|under)\s+\d+\b/i);
    }
  });

  it('links only to placeholder example.gov.za addresses and holds no contact details', () => {
    for (const text of strings) {
      for (const link of text.match(/https?:\/\/\S+/g) ?? []) {
        expect(link).toMatch(/^https:\/\/example\.gov\.za\//);
      }
      expect(text).not.toMatch(/www\./);
      expect(text).not.toContain('@');
    }
  });

  it('never claims to be official', () => {
    for (const text of strings) {
      expect(text).not.toMatch(/\bofficial (?:fee|requirement|price|cost)s?\b/i);
    }
  });
});

describe('catalogue service', () => {
  it('lists all services, or the services in one domain', async () => {
    expect(await catalogue.listServices()).toEqual(SAMPLE_CATALOGUE.services);
    expect(await catalogue.listServices({})).toHaveLength(13);
    const immigration = await catalogue.listServices({ domain: 'IMMIGRATION' });
    expect(immigration.map((service) => service.code)).toEqual([
      S.eta,
      S.visaInformation,
      S.residentServices,
    ]);
    // Help and complaints is a domain with no catalogue services of its own.
    expect(await catalogue.listServices({ domain: 'SUPPORT' })).toEqual([]);
  });

  it('finds a service by code or by slug', async () => {
    const service = await catalogue.getService(S.adultPassport);
    ServiceDefinitionSchema.parse(service);
    expect(service.code).toBe(S.adultPassport);
    expect((await catalogue.getService('adult-passport')).code).toBe(S.adultPassport);
    expect((await catalogue.getService('eta')).code).toBe(S.eta);
    expect((await catalogue.getService(' Smart-ID-Replacement ')).code).toBe(S.smartIdReplacement);
    for (const each of SAMPLE_CATALOGUE.services) {
      expect((await catalogue.getService(each.code)).slug).toBe(each.slug);
      expect((await catalogue.getService(each.slug)).code).toBe(each.code);
    }
  });

  it('throws NOT_FOUND for an unknown service', async () => {
    await expect(catalogue.getService('NOT_A_SERVICE')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(catalogue.getService('')).rejects.toMatchObject({ category: 'NOT_FOUND' });
  });

  it('hands out copies, so callers cannot edit the shared content', async () => {
    const service = await catalogue.getService(S.eta);
    service.title = 'Changed';
    service.cautions.push('Changed');
    expect((await catalogue.getService(S.eta)).title).not.toBe('Changed');
    expect(byCode(S.eta).cautions).not.toContain('Changed');

    const listed = await catalogue.listServices();
    listed.pop();
    expect(await catalogue.listServices()).toHaveLength(13);
  });
});

describe('catalogue search', () => {
  it('returns nothing for an empty, blank or filler-only query', async () => {
    expect(await catalogue.search('')).toEqual([]);
    expect(await catalogue.search('   ')).toEqual([]);
    expect(await catalogue.search('how do I')).toEqual([]);
    expect(await catalogue.search('?!')).toEqual([]);
    expect(await catalogue.search('zzzzqqqq')).toEqual([]);
    expect(searchTerms('How do I replace my Smart ID?')).toEqual(['replace', 'smart', 'id']);
  });

  it('ranks title matches ahead of matches in summaries and bodies', async () => {
    const results = await catalogue.search('passport');
    for (const result of results) SearchResultSchema.parse(result);
    const inTitle = results.map((result) => /passport/i.test(result.title));
    expect(inTitle[0]).toBe(true);
    // Once a non-title match appears, no title match follows it.
    const firstOther = inTitle.indexOf(false);
    expect(firstOther).toBeGreaterThan(0);
    expect(inTitle.slice(firstOther).every((value) => !value)).toBe(true);
    expect(results.slice(0, 2).map((result) => result.id)).toEqual([
      S.adultPassport,
      S.passportCollection,
    ]);
    expect(results.some((result) => result.kind === 'GUIDANCE')).toBe(true);
  });

  it('describes a service result with a link to its page', async () => {
    const [first] = await catalogue.search('How do I replace my Smart ID?');
    expect(first).toEqual({
      kind: 'SERVICE',
      id: S.smartIdReplacement,
      title: 'Replace a Smart ID',
      snippet: byCode(S.smartIdReplacement).summary,
      href: '/services/smart-id-replacement/',
    });
  });

  it('describes a guidance result with a link and the citation the guide must show', async () => {
    const results = await catalogue.search('whatsapp');
    const first = results[0];
    expect(first).toMatchObject({
      kind: 'GUIDANCE',
      id: 'using-whatsapp-safely',
      title: 'Using WhatsApp safely',
      href: '/help/guidance/?id=using-whatsapp-safely',
      citation: `Using WhatsApp safely — sample guidance ${DEMO.contentVersion}, effective ${DEMO.contentEffectiveDate}`,
    });
    expect(first?.snippet).toMatch(/whatsapp/i);
    expect(first?.snippet.length).toBeLessThanOrEqual(181);
    for (const result of results) {
      SearchResultSchema.parse(result);
      if (result.kind === 'GUIDANCE') {
        expect(result.citation).toBe(
          `${result.title} — sample guidance ${DEMO.contentVersion}, effective ${DEMO.contentEffectiveDate}`,
        );
      } else {
        expect(result.citation).toBeUndefined();
      }
    }
  });

  it('ignores case and matches the start of words', async () => {
    const lower = await catalogue.search('whatsapp');
    expect(await catalogue.search('WhatsApp')).toEqual(lower);
    expect(await catalogue.search('WHATSAPP')).toEqual(lower);
    const prefix = await catalogue.search('citizen');
    expect(prefix.map((result) => result.id)).toContain(S.citizenshipGuidance);
  });

  it('matches a short term as a whole word only', async () => {
    const results = await catalogue.search('id');
    expect(results.slice(0, 2).map((result) => result.id)).toEqual([
      S.smartIdReplacement,
      S.smartIdFirst,
    ]);
    // "id" must not match "identity", "guidance" or "provide".
    expect(results.map((result) => result.id)).not.toContain(S.travelAlerts);
  });

  it('finds guidance through its tags and its body', async () => {
    const byTag = await catalogue.search('scam');
    expect(byTag.map((result) => result.id)).toEqual(['how-we-contact-you']);
    const byBody = await catalogue.search('registrar');
    expect(byBody.map((result) => result.id)).toContain(S.birthRegistration);
    const byBodyOnly = await catalogue.search('fictional');
    expect(byBodyOnly.length).toBeGreaterThan(0);
    expect(byBodyOnly.every((result) => result.kind === 'GUIDANCE')).toBe(true);
  });

  it('finds every service by its own title', async () => {
    for (const service of SAMPLE_CATALOGUE.services) {
      const results = await catalogue.search(service.title);
      expect(results[0]?.id).toBe(service.code);
    }
  });
});
