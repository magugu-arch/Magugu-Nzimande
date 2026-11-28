/**
 * Crew names and roles, carried over exactly from the current
 * sowetotowers.co.za About page (28 Nov 2026).
 *
 * CONFIRM before launch: each person's consent to have their name published
 * on the new site (POPIA), and any changes to the line-up since then.
 */

export type CrewGroup = 'Leadership' | 'Jump masters' | 'Operators' | 'Multimedia' | 'Admin';

export type CrewMember = { name: string; role: string; group: CrewGroup };

export const crew: CrewMember[] = [
  { name: 'Sizwe Mathebula', role: 'Director and Snr Bungee Jump Master', group: 'Leadership' },
  { name: 'Lawrence Sithole', role: 'Site Manager', group: 'Leadership' },
  { name: 'Nhlanhla Zitha', role: 'Bungee Jump Master', group: 'Jump masters' },
  { name: 'Mighty Moyo', role: 'Bungee Jump Master', group: 'Jump masters' },
  { name: 'Ayanda Kweza', role: 'SCAD Jump Master', group: 'Jump masters' },
  { name: 'Bongikosi Mndaweni', role: 'SCAD Jump Master', group: 'Jump masters' },
  { name: 'Eric Khethelo', role: 'Ground Master', group: 'Jump masters' },
  { name: 'Victor Mnhele', role: 'SCAD Operator', group: 'Operators' },
  { name: 'Retumetsi Ntshangase', role: 'Operator', group: 'Operators' },
  { name: 'Nhlakanipho Mabanga', role: 'Operator', group: 'Operators' },
  { name: 'Mazola Zolisa', role: 'Operator', group: 'Operators' },
  { name: 'Karabo Lekunya', role: 'Operator', group: 'Operators' },
  { name: 'David Phaladi', role: 'Operator', group: 'Operators' },
  // The old About page lists this crew member without a role.
  { name: 'Kagiso Ngwenya', role: 'Crew', group: 'Operators' },
  { name: 'Lunga Khumalo', role: 'Multimedia Manager', group: 'Multimedia' },
  { name: 'Sinenhlanhla Ludidi', role: 'Multimedia', group: 'Multimedia' },
  { name: 'Kedibone Ntsaba', role: 'Admin', group: 'Admin' },
  { name: 'Nobantu Nhlapo', role: 'Admin', group: 'Admin' },
  { name: 'Mana', role: 'Admin', group: 'Admin' },
];

export const mentor = { name: 'Nico Myburg', role: 'Mentoring and consultancy' };

export const crewGroups: CrewGroup[] = ['Leadership', 'Jump masters', 'Operators', 'Multimedia', 'Admin'];

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}
