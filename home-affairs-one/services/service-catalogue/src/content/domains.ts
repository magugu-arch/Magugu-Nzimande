/**
 * Service domains shown on the services page.
 *
 * Sample content. Titles and summaries describe how the prototype groups
 * services; they are not an official taxonomy.
 */
import { type ServiceDomainInfo } from '@hao/api-contracts';

export const DOMAINS: ServiceDomainInfo[] = [
  {
    domain: 'IDENTITY',
    title: 'Identity',
    summary: 'Replace a Smart ID, apply for your first ID and get help with your identity record.',
    assetId: 'A23',
  },
  {
    domain: 'PASSPORTS',
    title: 'Passports',
    summary: 'Apply for an adult passport and find out how collection works.',
    assetId: 'A15',
  },
  {
    domain: 'BIRTH_FAMILY',
    title: 'Birth and family',
    summary: 'Register a birth, ask for a birth certificate and manage applications for a child.',
    assetId: 'A09',
  },
  {
    domain: 'MARRIAGE',
    title: 'Marriage and civil union',
    summary: 'Guidance on registering a marriage or civil union and asking for a certificate.',
    assetId: 'A20',
  },
  {
    domain: 'DEATH',
    title: 'Death and estate events',
    summary: 'Clear, step-by-step guidance for registering a death at a difficult time.',
    assetId: 'A13',
  },
  {
    domain: 'CITIZENSHIP',
    title: 'Citizenship',
    summary:
      'Plain-language guidance on citizenship matters, with a hand-off to the right service.',
    assetId: 'A18',
  },
  {
    domain: 'IMMIGRATION',
    title: 'Visas and immigration',
    summary: 'Electronic travel authorisation, visa information and services for residents.',
    assetId: 'A31',
  },
  {
    domain: 'TRAVEL',
    title: 'Travel and border',
    summary: 'Travel notices and border updates to check before you set off.',
    assetId: 'A35',
  },
  {
    domain: 'SUPPORT',
    title: 'Help and complaints',
    summary: 'Find answers, ask for a call back, make a complaint or give feedback.',
    assetId: 'A34',
  },
];
