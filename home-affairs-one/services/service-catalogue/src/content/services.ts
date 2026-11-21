/**
 * Sample service definitions.
 *
 * Nothing in this file is a real Department of Home Affairs fee, requirement,
 * eligibility rule or timeframe. Journeys describe how the prototype behaves;
 * requirements are labelled placeholders; the only amount is a sample value
 * for the payment sandbox. Real content must be supplied and verified by each
 * service owner before any pilot.
 */
import { DEMO, type Fee, type FormStep, type ServiceDefinition } from '@hao/api-contracts';
import { STATUS_INFO } from '@hao/shared-types';

const S = DEMO.services;

/** Version stamp carried by every piece of sample content. */
const STAMP = {
  contentVersion: DEMO.contentVersion,
  effectiveDate: DEMO.contentEffectiveDate,
  sample: true,
} as const;

/* ------------------------- shared wording -------------------------- */

const PLACEHOLDER_DETAIL =
  'Placeholder. The real list will be supplied and verified by the service owner.';

const CAUTION_NOT_APPROVED = 'Sending an application does not mean it is approved.';
const CAUTION_TIMEFRAMES = 'We only show timeframes when they come from live operational data.';
const CAUTION_SAMPLE_AMOUNT =
  'The amount shown is a sample for the payment sandbox. It is not a real fee.';
const CAUTION_GUIDANCE_ONLY = 'This page is guidance only. Nothing is submitted from it.';

const ALTERNATIVE_CALL_BACK = 'Ask for a call back from an adviser';
const ALTERNATIVE_SERVICE_POINT = 'Find a service point where someone can help you in person';
const ALTERNATIVE_NOT_ONLINE = 'Read “If something is not available online yet” in the help pages';

function requirement(id: string, what: string): ServiceDefinition['requirements'][number] {
  return { id, label: `Sample requirement: ${what}`, detail: PLACEHOLDER_DETAIL };
}

function sampleFee(): Fee {
  return {
    kind: 'SAMPLE',
    amountCents: 100,
    currency: 'ZAR',
    note: 'Sample amount for the payment sandbox. Not a real fee.',
  };
}

function feeToBeConfirmed(): Fee {
  return { kind: 'TO_BE_CONFIRMED', note: 'Shown here once the service owner confirms it.' };
}

/* --------------------------- form steps ---------------------------- */

/** Step 1 of every online form: details pre-filled from the profile, shown for confirmation. */
function yourDetailsStep(): FormStep {
  return {
    id: 'your-details',
    title: 'Your details',
    intro:
      'We have filled in what we already hold from your profile. Check each item and correct anything that is wrong.',
    fields: [
      {
        id: 'applicant-full-name',
        label: 'Full name',
        hint: 'Shown as a first name and initial in this prototype.',
        why: 'So the application is recorded against the right person.',
        type: 'text',
        required: true,
        profileKey: 'fullName',
      },
      {
        id: 'applicant-email',
        label: 'Email address',
        hint: 'Shown masked. We never display a full address in this prototype.',
        why: 'So we can send your receipt and tell you when something changes.',
        type: 'text',
        required: true,
        profileKey: 'email',
      },
      {
        id: 'applicant-mobile',
        label: 'Mobile number',
        hint: 'Optional. Shown masked.',
        why: 'So an adviser can reach you if there is a question about your application.',
        type: 'text',
        required: false,
        profileKey: 'mobile',
      },
    ],
  };
}

/** Final data step of every online form: one synthetic evidence placeholder. */
function evidenceStep(why: string): FormStep {
  return {
    id: 'supporting-evidence',
    title: 'Supporting evidence',
    intro:
      'A real service would ask for documents at this step. Here you attach a synthetic placeholder, so you can see how the step works without sharing anything real.',
    fields: [
      {
        id: 'supporting-document',
        label: 'Supporting document (sample placeholder)',
        hint: 'You cannot upload real documents in this prototype. Attach a synthetic placeholder instead.',
        why,
        type: 'evidence',
        required: true,
      },
    ],
  };
}

/* ----------------------------- services ---------------------------- */

export const SERVICES: ServiceDefinition[] = [
  /* ----------------------------- Identity ---------------------------- */
  {
    code: S.smartIdReplacement,
    slug: 'smart-id-replacement',
    domain: 'IDENTITY',
    title: 'Replace a Smart ID',
    summary:
      'Start a replacement online, then complete it in person at a service point you choose. This is a sample journey: the real requirements and fee will come from the service owner.',
    availability: 'APPLY_ONLINE',
    release: 'MVP',
    requiredTier: 'A3',
    audience: ['citizen', 'guardian'],
    journey: [
      {
        title: 'Find out what you need',
        detail:
          'Read what the service involves, the sample requirements and the ways you can complete it, before you start.',
      },
      {
        title: 'Sign in',
        detail:
          'Sign in with your passkey. Because this service changes an identity document, we ask for one extra check before you submit.',
      },
      {
        title: 'Confirm your details',
        detail:
          'We show the details we already hold so you can check them. If something is wrong, you can correct it instead of typing everything again.',
      },
      {
        title: 'Review, declare and pay',
        detail:
          'Check your answers, tick the declaration yourself and pay in the payment sandbox. Your receipt arrives in your secure inbox.',
      },
      {
        title: 'Choose where to complete it',
        detail:
          'Pick a service office, partner bank point or mobile unit that offers this service, and book a time that suits you.',
      },
      {
        title: 'Complete identity capture in person',
        detail:
          'An authorised official completes the identity capture step at the place you chose. This prototype never captures a photograph, fingerprint or any other biometric.',
      },
      {
        title: 'Track your application',
        detail:
          'Every update appears in your secure inbox and your applications. You can also opt in to WhatsApp or SMS notices, which carry a masked reference and a secure link only.',
      },
      {
        title: 'Receive your Smart ID',
        detail:
          'We tell you when and where to collect it. Your identity is checked when the document is handed over.',
      },
    ],
    requirements: [
      requirement('smart-id-replacement-identity', 'something that confirms who you are'),
      requirement('smart-id-replacement-reason', 'the reason you need a replacement'),
      requirement(
        'smart-id-replacement-visit',
        'a visit to a service point to complete identity capture',
      ),
    ],
    fee: sampleFee(),
    channels: ['ONLINE', 'SERVICE_OFFICE', 'PARTNER_BANK', 'MOBILE_UNIT'],
    form: {
      steps: [
        yourDetailsStep(),
        {
          id: 'replacement-details',
          title: 'About your replacement',
          intro:
            'Tell us why you need a new Smart ID. These are sample questions for the prototype.',
          fields: [
            {
              id: 'replacement-reason',
              label: 'Why do you need a replacement?',
              why: 'The reason can change which steps and evidence apply.',
              type: 'radio',
              required: true,
              options: [
                { value: 'lost', label: 'Lost' },
                { value: 'stolen', label: 'Stolen' },
                { value: 'damaged', label: 'Damaged' },
                { value: 'details-changed', label: 'My details changed' },
              ],
            },
            {
              id: 'replacement-notes',
              label: 'Anything else we should know?',
              hint: 'Optional. Do not include identity numbers or other personal details.',
              why: 'So the person checking your application has the full picture.',
              type: 'textarea',
              required: false,
            },
          ],
        },
        evidenceStep('So the person checking your application can confirm what you have told us.'),
      ],
    },
    needsServicePoint: true,
    cautions: [
      CAUTION_NOT_APPROVED,
      'In this sample journey, your application waits until you have chosen a service point and completed the in-person step.',
      CAUTION_TIMEFRAMES,
      CAUTION_SAMPLE_AMOUNT,
    ],
    assetId: 'A16',
    ...STAMP,
  },
  {
    code: S.smartIdFirst,
    slug: 'smart-id-first',
    domain: 'IDENTITY',
    title: 'Apply for your first ID',
    summary:
      'Guidance for someone applying for an identity document for the first time, with a hand-off to arrange the in-person visit.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'MVP',
    requiredTier: 'A2',
    audience: ['citizen', 'guardian'],
    journey: [
      {
        title: 'Read the sample guidance',
        detail:
          'See what a first application involves and a sample list of what would be needed. The real list will come from the service owner.',
      },
      {
        title: 'Sign in to carry your details forward',
        detail:
          'Signing in means the details you have already confirmed can travel with you to the next step, so you do not start again.',
      },
      {
        title: 'Find a service point',
        detail:
          'Use the service point finder to see which places list this service, and what access support each one offers.',
      },
      {
        title: 'Continue with the hand-off',
        detail:
          'We hand you over to the service that takes first-time applications. This prototype uses a placeholder link.',
      },
      {
        title: 'Complete the application in person',
        detail:
          'An authorised official completes the application and the identity capture step with you.',
      },
    ],
    requirements: [
      requirement('smart-id-first-identity', 'something that confirms who you are'),
      requirement('smart-id-first-birth', 'something that confirms your birth details'),
      requirement('smart-id-first-visit', 'a visit to a service point to complete the application'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['SERVICE_OFFICE', 'MOBILE_UNIT'],
    needsServicePoint: true,
    handoff: {
      label: 'Continue to the first ID service',
      description:
        'In this sample journey a first-time application is completed in person. This placeholder link stands in for the official booking service, which is not connected to the prototype.',
      destination: 'https://example.gov.za/services/first-id',
    },
    cautions: [
      CAUTION_GUIDANCE_ONLY,
      'A first-time application cannot be completed online in this prototype.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A23',
    ...STAMP,
  },

  /* ----------------------------- Passports --------------------------- */
  {
    code: S.adultPassport,
    slug: 'adult-passport',
    domain: 'PASSPORTS',
    title: 'Apply for an adult passport',
    summary:
      'Apply online for an adult passport, then complete identity capture at a service point or mission you choose. This is a sample journey only.',
    availability: 'APPLY_ONLINE',
    release: 'MVP',
    requiredTier: 'A3',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Find out what you need',
        detail:
          'Read what the service involves, the sample requirements and the ways you can complete it, before you start.',
      },
      {
        title: 'Sign in',
        detail:
          'Sign in with your passkey. We ask for one extra check before you submit an application for a travel document.',
      },
      {
        title: 'Confirm your details',
        detail:
          'We show the details we already hold so you can check them and correct anything that is wrong.',
      },
      {
        title: 'Tell us what you need',
        detail:
          'Say whether this is a new passport, a renewal or a replacement, and how you would like to collect it.',
      },
      {
        title: 'Review, declare and pay',
        detail:
          'Check your answers, tick the declaration yourself and pay in the payment sandbox. Your receipt arrives in your secure inbox.',
      },
      {
        title: 'Choose where to complete it',
        detail:
          'Pick a service office or partner bank point that offers passports and book a time. If you live abroad, pick a mission: times are shown in your local time and the mission’s.',
      },
      {
        title: 'Track your application',
        detail:
          'Follow each milestone in your applications. Updates are driven by events from the case system, not typed in by hand.',
      },
      {
        title: 'Collect your passport',
        detail:
          'We tell you when it is ready and where to collect it. Your identity is checked at the handover.',
      },
    ],
    requirements: [
      requirement('adult-passport-identity', 'something that confirms who you are'),
      requirement('adult-passport-previous', 'details of any passport you already hold'),
      requirement(
        'adult-passport-visit',
        'a visit to a service point or mission to complete identity capture',
      ),
    ],
    fee: sampleFee(),
    channels: ['ONLINE', 'SERVICE_OFFICE', 'PARTNER_BANK', 'MISSION_ABROAD'],
    form: {
      steps: [
        yourDetailsStep(),
        {
          id: 'passport-details',
          title: 'About your passport',
          intro:
            'Tell us what you need and how you would like to collect it. These are sample questions for the prototype.',
          fields: [
            {
              id: 'passport-need',
              label: 'What do you need?',
              why: 'So we show the right steps for your situation.',
              type: 'select',
              required: true,
              options: [
                { value: 'new', label: 'New' },
                { value: 'renewal', label: 'Renewal' },
                { value: 'replacement', label: 'Replacement' },
              ],
            },
            {
              id: 'collection-route',
              label: 'How would you like to collect your passport?',
              hint: 'You choose the exact place after you submit.',
              why: 'So we only offer you places that can hand over a passport.',
              type: 'radio',
              required: true,
              options: [
                { value: 'service-point', label: 'Collect at a service point' },
                { value: 'partner-bank', label: 'Collect at a partner bank (where offered)' },
              ],
            },
          ],
        },
        evidenceStep('So the person checking your application can confirm what you have told us.'),
      ],
    },
    needsServicePoint: true,
    cautions: [
      CAUTION_NOT_APPROVED,
      'A receipt or a status update is not a travel document. Wait until you have your passport before you rely on it.',
      'Collection at a partner bank is only possible at points that list it.',
      CAUTION_TIMEFRAMES,
      CAUTION_SAMPLE_AMOUNT,
    ],
    assetId: 'A19',
    ...STAMP,
  },
  {
    code: S.passportCollection,
    slug: 'passport-collection',
    domain: 'PASSPORTS',
    title: 'Collect or receive your passport',
    summary:
      'How you find out that your passport is ready and what happens at the handover. Sample information for the prototype.',
    availability: 'INFORMATION_ONLY',
    release: 'MVP',
    requiredTier: 'A0',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Wait for the “ready” update',
        detail: `Your application changes to “${STATUS_INFO.FULFILMENT.userLabel}” and then tells you when the passport is ready. The full notice is in your secure inbox.`,
      },
      {
        title: 'Check where to go',
        detail:
          'The notice names the service point, partner bank point or mission you chose, with its sample hours and access features.',
      },
      {
        title: 'Bring what the notice asks for',
        detail:
          'The notice lists what to bring. In this prototype that list is a sample placeholder.',
      },
      {
        title: 'Confirm who you are at the handover',
        detail:
          'An official checks your identity before handing over the passport, and the handover is recorded against your application.',
      },
      {
        title: 'See the application close',
        detail:
          'Once the handover is recorded, your application shows as closed and its history is kept.',
      },
    ],
    requirements: [
      requirement('passport-collection-notice', 'the notice telling you your passport is ready'),
      requirement('passport-collection-identity', 'something that confirms who you are'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['SERVICE_OFFICE', 'PARTNER_BANK', 'MISSION_ABROAD'],
    needsServicePoint: false,
    cautions: [
      'Only go to collect once your secure inbox says your passport is ready.',
      'A WhatsApp, SMS or email notice only points you back to the app. It never contains your documents or case details.',
      'Delivery options will be shown only where the service owner confirms them.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A17',
    ...STAMP,
  },

  /* -------------------------- Birth and family ----------------------- */
  {
    code: S.birthRegistration,
    slug: 'birth-registration',
    domain: 'BIRTH_FAMILY',
    title: 'Register a birth',
    summary:
      'A guided way for a parent or guardian to start a birth registration. The app prepares the application; a registrar validates it and creates the legal record.',
    availability: 'APPLY_ONLINE',
    release: 'PHASE_2',
    requiredTier: 'A3',
    audience: ['guardian', 'citizen', 'citizen-abroad'],
    journey: [
      {
        title: 'Read the guided overview',
        detail:
          'See what registration involves and a sample evidence list. The statutory timeframes and evidence rules will be shown here once the service owner supplies them.',
      },
      {
        title: 'Sign in and confirm who you are',
        detail:
          'We check your identity and your authority to act for the child before you can submit.',
      },
      {
        title: 'Tell us about the child',
        detail:
          'Answer a few questions. If an approved link with a health facility exists in future, verified details could be filled in for you to check.',
      },
      {
        title: 'Review, declare and submit',
        detail:
          'Check your answers and tick the declaration yourself. Nothing is submitted or declared on your behalf.',
      },
      {
        title: 'A registrar validates the application',
        detail:
          'The app never creates or changes the legal birth record. Only a registrar can do that, after validating the application.',
      },
      {
        title: 'Complete any in-person step',
        detail:
          'Choose a service office, mobile unit or mission for the step that has to be done in person, and book a time.',
      },
      {
        title: 'Track progress',
        detail:
          'Follow each update in your applications. If a registration is late, disputed or incomplete, it goes to a specialist team and we tell you the next step.',
      },
    ],
    requirements: [
      requirement('birth-registration-identity', 'something that confirms who you are'),
      requirement(
        'birth-registration-relationship',
        'something that shows your relationship to the child',
      ),
      requirement(
        'birth-registration-record',
        'a record of the birth from the place where it happened',
      ),
    ],
    fee: sampleFee(),
    channels: ['ONLINE', 'SERVICE_OFFICE', 'MOBILE_UNIT', 'MISSION_ABROAD'],
    form: {
      steps: [
        yourDetailsStep(),
        {
          id: 'child-details',
          title: 'About the child',
          intro:
            'Tell us how you are related to the child and a little about the birth. Use made-up details only: this prototype must not hold real information about a child.',
          fields: [
            {
              id: 'relationship-to-child',
              label: 'What is your relationship to the child?',
              why: 'So we can check that you have authority to act for the child.',
              type: 'select',
              required: true,
              options: [
                { value: 'parent', label: 'Parent' },
                { value: 'legal-guardian', label: 'Legal guardian' },
              ],
            },
            {
              id: 'child-given-name',
              label: 'Child’s given name (sample)',
              hint: 'Enter a made-up name.',
              why: 'So the registrar can see which name is being registered.',
              type: 'text',
              required: true,
            },
            {
              id: 'child-date-of-birth',
              label: 'Date of birth',
              hint: 'Enter a made-up date.',
              why: 'So the registrar can match the application to the record of the birth.',
              type: 'date',
              required: true,
            },
          ],
        },
        evidenceStep('So the registrar has what they need to validate the application.'),
      ],
    },
    needsServicePoint: true,
    cautions: [
      'Only a registrar can create or change the legal birth record.',
      'Sending an application does not register the birth.',
      'Use made-up details only. Do not enter real information about a child in this prototype.',
      CAUTION_TIMEFRAMES,
      CAUTION_SAMPLE_AMOUNT,
    ],
    assetId: 'A22',
    ...STAMP,
  },
  {
    code: S.birthCertificate,
    slug: 'birth-certificate',
    domain: 'BIRTH_FAMILY',
    title: 'Request a birth certificate',
    summary:
      'Guidance on asking for a birth certificate for yourself or for a child linked to your profile, with a hand-off to the service that handles requests.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'PHASE_2',
    requiredTier: 'A2',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Read the sample guidance',
        detail:
          'See what a certificate request involves and a sample list of what would be needed.',
      },
      {
        title: 'Check whose certificate it is',
        detail:
          'The guidance covers asking for your own certificate and asking for a child linked to your profile. The real rules about who may ask will come from the service owner.',
      },
      {
        title: 'Continue with the hand-off',
        detail:
          'We hand you over to the service that handles certificate requests. This prototype uses a placeholder link.',
      },
      {
        title: 'Keep your reference',
        detail:
          'Tracking a request inside this app is planned for a later phase. Until then, keep any reference you are given.',
      },
    ],
    requirements: [
      requirement('birth-certificate-identity', 'something that confirms who you are'),
      requirement('birth-certificate-record', 'details that identify the birth record'),
      requirement(
        'birth-certificate-relationship',
        'something that shows your relationship to the child, if you are asking for a child',
      ),
    ],
    fee: feeToBeConfirmed(),
    channels: ['ONLINE', 'SERVICE_OFFICE'],
    needsServicePoint: false,
    handoff: {
      label: 'Continue to the certificate request service',
      description:
        'Certificate requests are handled outside this prototype. This placeholder link stands in for the official service.',
      destination: 'https://example.gov.za/services/birth-certificate',
    },
    unavailable: {
      reason:
        'Certificate requests are planned for a later phase, so you cannot complete one inside this prototype.',
      whatNext:
        'Read the sample guidance, then continue with the hand-off link or ask for help at a service point.',
      alternatives: [ALTERNATIVE_SERVICE_POINT, ALTERNATIVE_CALL_BACK, ALTERNATIVE_NOT_ONLINE],
    },
    cautions: [
      CAUTION_GUIDANCE_ONLY,
      'Asking for a certificate does not change the birth record. Corrections follow a separate route.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A09',
    ...STAMP,
  },

  /* ------------------------ Marriage and civil union ----------------- */
  {
    code: S.marriageCertificate,
    slug: 'marriage-certificate',
    domain: 'MARRIAGE',
    title: 'Marriage and civil union services',
    summary:
      'Guidance on registering a marriage or civil union and on asking for a certificate, with a hand-off for the next step.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'PHASE_2',
    requiredTier: 'A2',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Choose what you need',
        detail:
          'The guidance is split in two: registering a marriage or civil union, and asking for a certificate.',
      },
      {
        title: 'Read the sample guidance',
        detail:
          'See the steps involved and a sample list of what would be needed. The real requirements will come from the service owner.',
      },
      {
        title: 'Continue with the hand-off',
        detail:
          'We hand you over to the service that deals with marriage and civil union matters. This prototype uses a placeholder link.',
      },
      {
        title: 'Keep your reference',
        detail:
          'Tracking inside this app is planned for a later phase. Until then, keep any reference you are given.',
      },
    ],
    requirements: [
      requirement('marriage-certificate-identity', 'something that confirms who each person is'),
      requirement(
        'marriage-certificate-record',
        'details that identify the marriage or civil union',
      ),
    ],
    fee: feeToBeConfirmed(),
    channels: ['SERVICE_OFFICE'],
    needsServicePoint: false,
    handoff: {
      label: 'Continue to marriage and civil union services',
      description:
        'These services are handled outside this prototype. This placeholder link stands in for the official service.',
      destination: 'https://example.gov.za/services/marriage-and-civil-union',
    },
    unavailable: {
      reason:
        'Online marriage and civil union services depend on the law and on how registrars work, and are planned for a later phase.',
      whatNext: 'Use the hand-off link for the next step, or speak to someone at a service point.',
      alternatives: [ALTERNATIVE_SERVICE_POINT, ALTERNATIVE_CALL_BACK, ALTERNATIVE_NOT_ONLINE],
    },
    cautions: [
      CAUTION_GUIDANCE_ONLY,
      'Who may register a marriage or civil union, and how, is set by law. This prototype does not describe those rules.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A20',
    ...STAMP,
  },

  /* ------------------------- Death and estate events ----------------- */
  {
    code: S.deathRegistration,
    slug: 'death-registration',
    domain: 'DEATH',
    title: 'Register a death',
    summary:
      'Step-by-step guidance for registering a death, written to be clear at a difficult time. You can ask a person to help you at any point.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'PHASE_2',
    requiredTier: 'A2',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Read what is involved',
        detail:
          'We are sorry for your loss. This page sets out the steps in plain language, so you know what to expect. It is sample guidance for now.',
      },
      {
        title: 'Find out who can help',
        detail:
          'Someone at a service point can help you in person, and an adviser can call you back at a time that suits you.',
      },
      {
        title: 'Continue with the hand-off',
        detail:
          'We hand you over to the service that registers a death. This prototype uses a placeholder link.',
      },
      {
        title: 'Ask for a certificate',
        detail:
          'The guidance explains how a certificate would be requested and how you would hear about progress.',
      },
      {
        title: 'Come back when you are ready',
        detail:
          'You can leave this guidance and return to it at any time. Nothing is submitted from this page.',
      },
    ],
    requirements: [
      requirement('death-registration-identity', 'something that confirms who you are'),
      requirement('death-registration-record', 'a record of the death from an authorised source'),
      requirement('death-registration-person', 'details of the person who has died'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['SERVICE_OFFICE'],
    needsServicePoint: false,
    handoff: {
      label: 'Continue to the death registration service',
      description:
        'Registration is handled outside this prototype. This placeholder link stands in for the official service.',
      destination: 'https://example.gov.za/services/register-a-death',
    },
    unavailable: {
      reason:
        'Registering a death online is planned for a later phase and is not available in this prototype.',
      whatNext:
        'Use the hand-off link, or ask a person to help you. You do not have to work this out alone.',
      alternatives: [ALTERNATIVE_CALL_BACK, ALTERNATIVE_SERVICE_POINT, ALTERNATIVE_NOT_ONLINE],
    },
    cautions: [
      CAUTION_GUIDANCE_ONLY,
      'Other organisations are not told automatically. Any future sharing would need a clear legal basis.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A13',
    ...STAMP,
  },

  /* ----------------------------- Citizenship ------------------------- */
  {
    code: S.citizenshipGuidance,
    slug: 'citizenship-guidance',
    domain: 'CITIZENSHIP',
    title: 'Citizenship guidance',
    summary:
      'Plain-language guidance on citizenship matters, with a hand-off to the service that handles applications. This app does not decide whether anyone qualifies.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'PHASE_2',
    requiredTier: 'A2',
    audience: ['citizen', 'guardian', 'citizen-abroad'],
    journey: [
      {
        title: 'Read the overview',
        detail:
          'See the kinds of citizenship matters the guidance covers. It is sample content and is not legal advice.',
      },
      {
        title: 'Find your starting point',
        detail:
          'Citizenship depends on personal circumstances. The guidance helps you find where to start; it does not tell you whether you qualify.',
      },
      {
        title: 'Continue with the hand-off',
        detail:
          'We hand you over to the service that handles citizenship applications. This prototype uses a placeholder link.',
      },
      {
        title: 'Keep your reference',
        detail:
          'Tracking inside this app is planned for a later phase. Until then, keep any reference you are given.',
      },
      {
        title: 'Ask a person',
        detail:
          'If your situation is not covered, ask for a call back or visit a service point or mission.',
      },
    ],
    requirements: [
      requirement('citizenship-guidance-identity', 'something that confirms who you are'),
      requirement(
        'citizenship-guidance-circumstances',
        'evidence of the circumstances your application relies on',
      ),
    ],
    fee: feeToBeConfirmed(),
    channels: ['ONLINE', 'SERVICE_OFFICE', 'MISSION_ABROAD'],
    needsServicePoint: false,
    handoff: {
      label: 'Continue to the citizenship service',
      description:
        'Citizenship applications are handled outside this prototype. This placeholder link stands in for the official service.',
      destination: 'https://example.gov.za/services/citizenship',
    },
    unavailable: {
      reason:
        'Citizenship matters depend on individual circumstances and are reviewed by authorised officials, so they are not handled inside this app.',
      whatNext:
        'Read the sample overview, then continue to the citizenship service with the hand-off link.',
      alternatives: [ALTERNATIVE_CALL_BACK, ALTERNATIVE_SERVICE_POINT, ALTERNATIVE_NOT_ONLINE],
    },
    cautions: [
      'This app does not decide citizenship matters. Decisions are made by authorised officials.',
      'This guidance is sample content. It is not legal advice.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A18',
    ...STAMP,
  },

  /* ------------------------- Visas and immigration ------------------- */
  {
    code: S.eta,
    slug: 'eta',
    domain: 'IMMIGRATION',
    title: 'Apply for an electronic travel authorisation (ETA)',
    summary:
      'Guidance for visitors on the electronic travel authorisation, with a hand-off to the official ETA system to apply. A receipt is not permission to travel.',
    availability: 'GUIDANCE_AND_HANDOFF',
    release: 'MVP',
    requiredTier: 'A1',
    audience: ['traveller'],
    journey: [
      {
        title: 'Read the travel guidance',
        detail:
          'See in plain language what an electronic travel authorisation is for. This is sample guidance: the official rules come from the immigration authority.',
      },
      {
        title: 'Continue to the official ETA system',
        detail:
          'We hand you over to the authoritative ETA system to complete the application. This prototype uses a placeholder link.',
      },
      {
        title: 'Tell the official system about your trip',
        detail:
          'There you choose your nationality, the purpose of your visit and how you will arrive, and see the official guidance for your trip. This app does not decide whether you qualify.',
      },
      {
        title: 'Provide evidence and pay, if required',
        detail:
          'Evidence is uploaded or captured only through the official system’s secure controls. If a payment is required, you make it there.',
      },
      {
        title: 'Check your status',
        detail:
          'A receipt confirms that your application was received. It is not travel authorisation.',
      },
      {
        title: 'Present the outcome',
        detail:
          'If your application is granted, you can show the valid outcome to the relevant authorities when you are asked for it.',
      },
    ],
    requirements: [
      requirement('eta-travel-document', 'details of your travel document'),
      requirement('eta-trip', 'the purpose of your visit and how you will arrive'),
      requirement('eta-evidence', 'supporting evidence, if the official guidance asks for it'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['ONLINE'],
    needsServicePoint: false,
    handoff: {
      label: 'Continue to the official ETA system',
      description:
        'You apply, provide evidence and pay, if required, in the authoritative ETA system. This placeholder link stands in for it.',
      destination: 'https://example.gov.za/eta',
    },
    cautions: [
      'An application receipt is not travel authorisation.',
      'This app does not decide applications. The authorised immigration officials do.',
      'Check the outcome in the official system before you rely on it to travel.',
      'Never send travel documents or payment details by chat, email or SMS.',
    ],
    assetId: 'A31',
    ...STAMP,
  },
  {
    code: S.visaInformation,
    slug: 'visa-information',
    domain: 'IMMIGRATION',
    title: 'Visa information',
    summary:
      'General, sample information for people planning to visit, work or study in South Africa. Applying for a visa online is planned for a later phase.',
    availability: 'INFORMATION_ONLY',
    release: 'PHASE_2',
    requiredTier: 'A0',
    audience: ['traveller'],
    journey: [
      {
        title: 'Start with why you are travelling',
        detail:
          'Information is grouped by the reason for your visit, so you can find the part that applies to you.',
      },
      {
        title: 'Read the sample information',
        detail:
          'Each topic explains the kind of steps involved in plain language. The real requirements will come from the immigration authority.',
      },
      {
        title: 'Read about the electronic travel authorisation',
        detail:
          'If you are planning a short visit, also read the electronic travel authorisation page, which explains the hand-off to the official system.',
      },
      {
        title: 'Ask for help if you are unsure',
        detail:
          'An adviser can point you to the right service. They cannot decide an application or tell you whether you qualify.',
      },
    ],
    requirements: [
      requirement('visa-information-travel-document', 'details of your travel document'),
      requirement('visa-information-reason', 'the reason for your visit'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['ONLINE'],
    needsServicePoint: false,
    unavailable: {
      reason:
        'Applying for a visa online is planned for a later phase. For now, this page gives general sample information only.',
      whatNext:
        'Read the sample information here. If you are planning a short visit, read the electronic travel authorisation page too.',
      alternatives: [
        'Read about the electronic travel authorisation (ETA)',
        'Check travel and border updates',
        ALTERNATIVE_CALL_BACK,
      ],
    },
    cautions: [
      'This page gives general information only. It does not tell you whether you qualify for a visa.',
      'Visa decisions are made by authorised officials, never by this app.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A36',
    ...STAMP,
  },
  {
    code: S.residentServices,
    slug: 'resident-services',
    domain: 'IMMIGRATION',
    title: 'Permits and resident services',
    summary:
      'Information for people who live in South Africa on a permit. Online permit services are planned for a later phase, so this page explains how to get help from a person.',
    availability: 'INFORMATION_ONLY',
    release: 'PHASE_3',
    requiredTier: 'A0',
    audience: ['traveller'],
    journey: [
      {
        title: 'See what is planned',
        detail:
          'Permit applications, renewals and appointments are planned for a later phase of Home Affairs One.',
      },
      {
        title: 'Understand why it is not online yet',
        detail:
          'The rules differ from one legal category to another, and each case needs to be reviewed by a person.',
      },
      {
        title: 'Talk to an adviser',
        detail:
          'Ask for a call back or visit a service point. Tell the adviser if you need an interpreter.',
      },
      {
        title: 'Check back later',
        detail: 'This page will be updated when a service becomes available.',
      },
    ],
    requirements: [
      requirement('resident-services-identity', 'something that confirms who you are'),
      requirement('resident-services-permit', 'details of the permit you hold now'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['SERVICE_OFFICE'],
    needsServicePoint: false,
    unavailable: {
      reason:
        'Permits and resident services are planned for a later phase. The rules differ by legal category and each case needs review by a person, so they are not offered online here.',
      whatNext:
        'Speak to an adviser, who can point you to the route that applies to you. You can ask for a call back or visit a service point.',
      alternatives: [
        ALTERNATIVE_CALL_BACK,
        ALTERNATIVE_SERVICE_POINT,
        'Read the general visa information',
      ],
    },
    cautions: [
      'Nothing on this page changes or confirms anyone’s status.',
      'This app cannot give advice about an individual permit or case.',
      CAUTION_TIMEFRAMES,
    ],
    assetId: 'A28',
    ...STAMP,
  },

  /* --------------------------- Travel and border --------------------- */
  {
    code: S.travelAlerts,
    slug: 'travel-alerts',
    domain: 'TRAVEL',
    title: 'Travel and border updates',
    summary:
      'Sample notices about travel and border services, so you can check for changes before you set off.',
    availability: 'INFORMATION_ONLY',
    release: 'MVP',
    requiredTier: 'A0',
    audience: ['citizen', 'guardian', 'traveller', 'citizen-abroad'],
    journey: [
      {
        title: 'Check the current notices',
        detail: 'Notices are listed with the newest first, each with the date it was published.',
      },
      {
        title: 'See whether a notice affects you',
        detail: 'Each notice says in plain language which services or places it covers.',
      },
      {
        title: 'Follow the guidance in the notice',
        detail:
          'A notice points to the guidance or service it relates to, so you know what to do next.',
      },
      {
        title: 'Check again before you travel',
        detail: 'Notices change. You can read them at any time without signing in.',
      },
    ],
    requirements: [
      requirement('travel-alerts-none', 'nothing is needed to read these notices'),
      requirement('travel-alerts-account', 'an account, if you want notices sent to you'),
    ],
    fee: feeToBeConfirmed(),
    channels: ['ONLINE'],
    needsServicePoint: false,
    cautions: [
      'Every notice in this prototype is a sample. Do not use one to plan real travel.',
      'A notice is general information. It says nothing about your own application or travel authorisation.',
    ],
    assetId: 'A35',
    ...STAMP,
  },
];
