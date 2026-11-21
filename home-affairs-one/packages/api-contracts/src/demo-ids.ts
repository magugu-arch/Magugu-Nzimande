/**
 * Identifiers shared by the mock services' seed data, so a case in the workflow
 * mock points at a service point the appointments mock actually has.
 *
 * All of it is invented. Tokens are opaque and deliberately look nothing like a
 * South African identity number, passport number or real case reference.
 */
export const DEMO = {
  persons: {
    /** Citizen in South Africa, verified (A2). The main demo persona. */
    thandi: 'PERSON-DEMO-7X3Q',
    /** Parent / guardian with a linked child profile, verified (A2). */
    sipho: 'PERSON-DEMO-4K9P',
    /** International visitor with a basic account (A1) and no applications yet. */
    aisha: 'PERSON-DEMO-2R8V',
    /** South African citizen living abroad, verified (A2). */
    lerato: 'PERSON-DEMO-6M1T',
  },
  staff: {
    caseOfficer: 'STAFF-DEMO-1001',
    supervisor: 'STAFF-DEMO-1002',
  },
  partners: {
    bank: 'PARTNER-DEMO-1001',
    college: 'PARTNER-DEMO-1002',
  },
  services: {
    smartIdReplacement: 'SMART_ID_REPLACEMENT',
    smartIdFirst: 'SMART_ID_FIRST',
    adultPassport: 'ADULT_PASSPORT',
    passportCollection: 'PASSPORT_COLLECTION',
    birthRegistration: 'BIRTH_REGISTRATION',
    birthCertificate: 'BIRTH_CERTIFICATE',
    marriageCertificate: 'MARRIAGE_CERTIFICATE',
    deathRegistration: 'DEATH_REGISTRATION',
    citizenshipGuidance: 'CITIZENSHIP_GUIDANCE',
    eta: 'ETA',
    visaInformation: 'VISA_INFORMATION',
    residentServices: 'RESIDENT_SERVICES',
    travelAlerts: 'TRAVEL_ALERTS',
  },
  cases: {
    /** Thandi — Smart ID replacement, ACTION_REQUIRED: choose a service point (brief, Appendix B). */
    smartIdActionRequired: 'CASE-DEMO-000041',
    /** Thandi — adult passport, FULFILMENT: in production (brief, concept screen 2). */
    passportInProduction: 'CASE-DEMO-002481',
    /** Thandi — birth certificate request, CLOSED: completed. */
    certificateCompleted: 'CASE-DEMO-000017',
    /** Sipho — birth registration for a linked child, IN_VALIDATION. */
    birthInValidation: 'CASE-DEMO-000063',
    /** Lerato — adult passport through a mission abroad, SCHEDULED. */
    passportAbroadScheduled: 'CASE-DEMO-000078',
  },
  drafts: {
    /** Sipho — a part-finished adult passport application to resume. */
    siphoPassport: 'DRAFT-DEMO-1001',
  },
  servicePoints: {
    officeCentral: 'SP-DEMO-1001',
    officeNorth: 'SP-DEMO-1002',
    officeCoast: 'SP-DEMO-1003',
    bankCentral: 'SP-DEMO-1004',
    bankEast: 'SP-DEMO-1005',
    mobileRural: 'SP-DEMO-1006',
    mobileValley: 'SP-DEMO-1007',
    kioskMall: 'SP-DEMO-1008',
    missionEurope: 'SP-DEMO-1009',
    missionAsiaPacific: 'SP-DEMO-1010',
  },
  appointments: {
    /** Lerato's booked slot at the Europe mission. */
    leratoMission: 'APPT-DEMO-1001',
  },
  consents: {
    /** Thandi's WhatsApp notification consent (brief, Appendix B). */
    thandiWhatsApp: 'CONSENT-DEMO-88',
    /** Thandi's consent for the demo bank to ask for a yes/no identity confirmation. */
    thandiBank: 'CONSENT-DEMO-91',
  },
  queues: ['Identity documents', 'Passports', 'Civic registration', 'Specialist review'],
  /** Version stamp shown wherever sample content appears. */
  contentVersion: 'sample-0.1',
  contentEffectiveDate: '2026-11-21',
} as const;
