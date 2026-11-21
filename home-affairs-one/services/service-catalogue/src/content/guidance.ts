/**
 * Sample guidance articles.
 *
 * These describe how the prototype and the proposed product design behave —
 * sign-in levels, statuses, channels, consent, the sandbox. They deliberately
 * say nothing about Department of Home Affairs law, fees, requirements or
 * timeframes. The service guide may only quote these, with a citation.
 */
import { DEMO, type GuidanceArticle } from '@hao/api-contracts';
import { STATUS_INFO, type StatusFamily } from '@hao/shared-types';

const S = DEMO.services;

const STAMP = {
  contentVersion: DEMO.contentVersion,
  effectiveDate: DEMO.contentEffectiveDate,
  sample: true,
} as const;

const APPLY_ONLINE_CODES = [S.smartIdReplacement, S.adultPassport, S.birthRegistration];

/** The label and rule for each status come from the shared taxonomy, so they cannot drift. */
function statusMeanings(families: StatusFamily[]): string {
  return families
    .map((family) => `“${STATUS_INFO[family].userLabel}”: ${STATUS_INFO[family].rule}`)
    .join(' ');
}

export const GUIDANCE: GuidanceArticle[] = [
  {
    id: 'sign-in-and-verification-levels',
    title: 'How sign-in and verification levels work',
    body: [
      'Home Affairs One uses levels of verification, so that everyday tasks stay easy and sensitive ones are better protected. The more an action matters, the more certain we need to be that you are who you say you are.',
      'Anyone can read guidance, find a service point and read travel updates without signing in. A basic account has verified contact details and a passkey or second step, and lets you save your preferences and drafts. A verified account has had its identity checked, and lets you see your applications, book appointments and manage how we contact you.',
      'Some actions need high assurance, such as sending an application that changes an identity document or agreeing to a legal declaration. For those we ask for an extra check at the moment you act, even if you are already signed in.',
      'In this prototype the checks are simulated. No real identity proofing, biometric check or passkey set-up takes place, and the levels are a design proposal, not an official scheme.',
    ],
    serviceCodes: [...APPLY_ONLINE_CODES],
    tags: ['sign-in', 'verification', 'passkey', 'account', 'security', 'identity'],
    ...STAMP,
  },
  {
    id: 'application-status-meanings',
    title: 'What each application status means',
    body: [
      'Every application shows one status at a time, in the same words wherever you see it: on your home screen, in your applications and in your secure inbox. A status only changes when the case system records an event.',
      statusMeanings(['DRAFT', 'SUBMITTED', 'IN_VALIDATION']),
      statusMeanings(['ACTION_REQUIRED', 'SCHEDULED', 'PROCESSING']),
      `${statusMeanings(['DECISION', 'FULFILMENT', 'CLOSED'])} We only show a timeframe next to a status when it comes from live operational data.`,
    ],
    serviceCodes: [...APPLY_ONLINE_CODES, S.passportCollection],
    tags: ['status', 'tracking', 'application', 'timeline', 'progress', 'received'],
    ...STAMP,
  },
  {
    id: 'how-we-contact-you',
    title: 'How we contact you, and what we will never ask for',
    body: [
      'Official notices, requests for information and receipts are always in your secure inbox inside Home Affairs One. If you are ever unsure whether a message is genuine, that is the place to check.',
      'If you switch them on, we can also send short notices by app notification, WhatsApp, email or SMS. Those messages carry a masked reference, such as the last four characters of your application reference, and a secure link back to the app. They never carry case details or documents.',
      'We will never ask you for a password, a one-time PIN or a payment into a personal account, and we will never ask you to send identity documents by chat, email or SMS. If a message asks for any of these, do not reply and do not follow its link. Open the app yourself and check your secure inbox.',
      'You can change your channels at any time in your message preferences. The secure inbox cannot be switched off, so you always have a complete record.',
    ],
    serviceCodes: [],
    tags: ['messages', 'inbox', 'scam', 'fraud', 'security', 'password', 'pin', 'contact'],
    ...STAMP,
  },
  {
    id: 'using-whatsapp-safely',
    title: 'Using WhatsApp safely',
    body: [
      'WhatsApp is optional. If you opt in, we use it for short reminders and simple guided help, using approved message templates.',
      'A WhatsApp message from us carries a masked reference and a secure link back to the app, and nothing else about your application. Anything personal is answered inside the app, after you sign in.',
      'Do not send documents, photographs of documents, one-time PINs or identity details in a chat, even if someone asks you to. If you try, we will not accept them, and we will point you to the secure step in the app instead.',
      'You can opt out whenever you like in your message preferences. Opting out withdraws your consent for this channel, and we keep a record of that for you.',
    ],
    serviceCodes: [],
    tags: ['whatsapp', 'messages', 'opt-in', 'consent', 'security', 'reminders'],
    ...STAMP,
  },
  {
    id: 'saving-and-resuming',
    title: 'Saving and resuming an application',
    body: [
      `Your answers are saved as you go, so you can stop at any step and come back later. An unfinished application appears on your home screen and in your applications as “${STATUS_INFO.DRAFT.userLabel}”.`,
      'A draft is kept for a limited time and then removed. The app shows the date a draft will expire, so nothing disappears without warning. In this prototype, drafts are stored only on the device you are using.',
      'Nothing is sent until you have reviewed your answers, ticked the declaration yourself and chosen to submit. We never submit an application or accept a declaration for you.',
      'If you lose your connection, your work stays on the device and you can carry on when you are back online.',
    ],
    serviceCodes: [...APPLY_ONLINE_CODES],
    tags: ['draft', 'save', 'resume', 'offline', 'declaration', 'application'],
    ...STAMP,
  },
  {
    id: 'in-person-capture-appointment',
    title: 'What happens at an in-person capture appointment (sample)',
    body: [
      'Some services include a step that can only be done in person, such as confirming your identity with an authorised official. You choose where to do this and book a time that suits you.',
      'On the day, the official checks your booking, confirms who you are and completes the capture step using approved equipment. This prototype describes the step but never captures a photograph, fingerprint or any other biometric.',
      'What to bring is shown as a sample list for now. The real list will be supplied and verified by the service owner before any pilot.',
      'If you cannot make it, you can reschedule or cancel from your application. If you need step-free access, a hearing loop, a sign language interpreter or a quieter time, choose a service point that offers it before you book.',
    ],
    serviceCodes: [S.smartIdReplacement, S.smartIdFirst, S.adultPassport, S.birthRegistration],
    tags: [
      'appointment',
      'booking',
      'in person',
      'capture',
      'biometric',
      'reschedule',
      'cancel',
      'smart id',
      'passport',
    ],
    ...STAMP,
  },
  {
    id: 'help-in-person-or-for-someone-else',
    title: 'Getting help in person, or for someone else',
    body: [
      'You do not need a smartphone or your own device to use these services. Service offices, mobile units and some other points offer assisted digital help, where a member of staff helps you use the service.',
      'If you would rather talk to someone, you can ask for a call back. With your agreement, we pass the adviser a masked application reference and a one-line summary, so you do not have to explain everything again. The words you type in your request are not copied into that summary.',
      'A parent or guardian can act for a child once the link between them has been verified. You can also give another adult limited permission to help you for a set period. Each link shows exactly what it allows and when it ends.',
      'Who may act for someone else is set by law and by the service owner. This prototype shows how the experience could work; it does not define those rules.',
    ],
    serviceCodes: [S.birthRegistration, S.birthCertificate, S.deathRegistration],
    tags: ['help', 'call back', 'assisted', 'guardian', 'delegate', 'family', 'child', 'adviser'],
    ...STAMP,
  },
  {
    id: 'applying-from-abroad',
    title: 'Applying from outside South Africa (sample)',
    body: [
      'If you are a South African living abroad, the design lets you choose a mission and see which sample services it lists. Appointment times are shown in your local time and in the mission’s local time, so there is no guessing.',
      'If you are visiting South Africa, travel services such as the electronic travel authorisation are shown as guidance with a hand-off to the official system. An application receipt is not travel authorisation.',
      'Which services can be completed from abroad depends on regulations, identity capture and delivery arrangements. Until the service owner confirms them, everything shown for missions is sample content, and the missions themselves are fictional.',
    ],
    serviceCodes: [
      S.adultPassport,
      S.birthRegistration,
      S.citizenshipGuidance,
      S.eta,
      S.visaInformation,
    ],
    tags: ['abroad', 'mission', 'overseas', 'time zone', 'traveller', 'visitor', 'passport', 'eta'],
    ...STAMP,
  },
  {
    id: 'privacy-and-consent-receipts',
    title: 'Your privacy and consent receipts',
    body: [
      'We ask only for the information a service needs, and each question explains why it is asked. Where we already hold a detail, we show it for you to confirm instead of asking again.',
      'When you agree to something, such as update notices on WhatsApp or a yes-or-no identity confirmation for an organisation, you get a consent receipt. It records the purpose, who receives the information, exactly which attributes are covered and when the consent ends.',
      'You can withdraw a consent at any time from your profile. Withdrawing stops future sharing; it does not undo what was shared before.',
      'An organisation that checks something about you receives a yes or no answer only, never the underlying record. Every check is logged using opaque references, with no names or contact details in the log.',
    ],
    serviceCodes: [],
    tags: ['privacy', 'consent', 'data', 'sharing', 'receipt', 'withdraw', 'audit'],
    ...STAMP,
  },
  {
    id: 'not-available-online-yet',
    title: 'If something is not available online yet',
    body: [
      'Not every service can be completed online, and some are planned for later phases. When that is the case we say so plainly, explain why and tell you what you can do next.',
      'You will always be offered another way forward: a hand-off to the service that deals with it, a service point where someone can help you in person, or a call back from an adviser.',
      'Services marked as guidance in this prototype link to placeholder addresses. In a real service, those links would go to the official system for that service.',
    ],
    serviceCodes: [
      S.smartIdFirst,
      S.birthCertificate,
      S.marriageCertificate,
      S.deathRegistration,
      S.citizenshipGuidance,
      S.visaInformation,
      S.residentServices,
    ],
    tags: ['unavailable', 'hand-off', 'guidance', 'later phase', 'help', 'alternatives'],
    ...STAMP,
  },
  {
    id: 'accessibility-support',
    title: 'Accessibility support',
    body: [
      'Home Affairs One is designed to work with screen readers, keyboard-only use, larger text and reduced motion. Nothing important is shown by colour alone, and every status is written out in words.',
      'The service point finder lets you filter for step-free access, accessible parking, a hearing loop, sign language interpreting by booking, quiet hours and assisted digital help.',
      'If the service does not work for you, ask for a call back or visit a service point, and a member of staff will help you complete it another way. Tell us what got in your way, so that we can fix it.',
    ],
    serviceCodes: [],
    tags: ['accessibility', 'screen reader', 'hearing loop', 'sign language', 'step-free', 'help'],
    ...STAMP,
  },
  {
    id: 'digital-wallet-concept',
    title: 'About the digital wallet concept',
    body: [
      'The wallet is a future idea, shown here so that people can react to it. It would let you hold digital versions of documents issued to you, alongside the physical ones, and choose what to share.',
      'Nothing in the wallet section of this prototype is a valid credential. The tiles are design concepts: they show the names of the attributes a credential could contain, never real values.',
      'A real wallet would let you share only what is needed, such as confirming that you are an adult without showing your date of birth, and would show you who is asking and why before you agree.',
      'Whether and when a wallet is offered is subject to legal, security and operational approval. Physical documents and in-person service would remain available.',
    ],
    serviceCodes: [],
    tags: ['wallet', 'digital id', 'credential', 'future', 'concept', 'sharing'],
    ...STAMP,
  },
  {
    id: 'payment-sandbox',
    title: 'Paying in this prototype',
    body: [
      'Payments in this prototype run in a sandbox. No money moves, no card or bank details are asked for and none are stored.',
      'The amount shown for a service is a sample used to demonstrate the payment step. It is not a real fee. Real fees will be shown only once the service owner confirms them.',
      'You can try an approved payment, a declined payment and one that times out, to see how the service explains each. If a payment does not go through, your application is kept and you can try again without paying twice.',
      'After an approved sandbox payment, a sample receipt is placed in your secure inbox.',
    ],
    serviceCodes: [...APPLY_ONLINE_CODES],
    tags: ['payment', 'pay', 'fee', 'receipt', 'sandbox', 'declined'],
    ...STAMP,
  },
  {
    id: 'sample-content',
    title: 'Why everything here is marked as sample',
    body: [
      'This is a concept prototype. It is not an official Department of Home Affairs service, and nothing you do here is sent to any government system.',
      'The requirements, fees, timeframes, service points and people shown in the prototype are placeholders. They are labelled as sample content and carry a version and an effective date, so that a reviewer can see exactly which wording they are looking at.',
      'Before any pilot, each piece of content would be supplied, checked and approved by the service owner responsible for it. Until then, do not rely on anything here to plan a real application or a trip.',
    ],
    serviceCodes: [],
    tags: ['sample', 'prototype', 'placeholder', 'version', 'requirements', 'fees'],
    ...STAMP,
  },
  {
    id: 'finding-a-service-point',
    title: 'Finding a service point',
    body: [
      'The service point finder shows the kinds of places where a service could be completed: service offices, partner bank points, mobile units, self-service kiosks and missions abroad.',
      'You can filter by the service you need, by accessibility features and by whether a point reports that it is open. If a point has not reported its status, we say so instead of guessing.',
      'The map is a simple diagram, not a real map, and every service point in this prototype is fictional. Opening hours and status notices are sample content.',
    ],
    serviceCodes: [
      S.smartIdReplacement,
      S.smartIdFirst,
      S.adultPassport,
      S.passportCollection,
      S.birthRegistration,
    ],
    tags: ['service point', 'office', 'bank', 'mobile unit', 'kiosk', 'mission', 'map', 'hours'],
    ...STAMP,
  },
  {
    id: 'service-guide-limits',
    title: 'What the service guide can and cannot do',
    body: [
      'The service guide helps you find things. It searches the versioned sample guidance in this app and shows you the passage it found, with a citation, so that you can read it for yourself.',
      'It does not make decisions, tell you whether you qualify, fill in or submit an application, or accept a declaration for you. Those steps are always yours, and decisions are always made by authorised officials.',
      'If the guide cannot find an answer in the approved guidance, it says so and points you to other ways of getting help.',
    ],
    serviceCodes: [],
    tags: ['service guide', 'assistant', 'search', 'citation', 'decisions', 'help'],
    ...STAMP,
  },
];
