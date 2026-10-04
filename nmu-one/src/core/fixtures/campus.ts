/**
 * SYNTHETIC DEMO DATA.
 *
 * A *schematic* South Campus for demonstrating wayfinding. Building names,
 * codes and positions are invented and do not describe NMU's real layout;
 * the live CampusProvider replaces this with NMU's own building register and
 * map tiles. Coordinates are in a 1000 × 1300 view box; one unit ≈ 0.6 m.
 */
import type { Building, CampusMap, DirectoryPerson } from '../domain/models';

const b = (
  id: string,
  code: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  entrance: string,
  kind: Building['kind'],
  floors: number,
  facilities: string[],
  accessibility = 'Step-free entrance and lift to all floors.',
): Building => ({
  id,
  code,
  name,
  campus: 'south',
  position: { x, y },
  size: { w, h },
  entrance,
  floors,
  facilities,
  accessibility,
  kind,
});

export const southCampus: CampusMap = {
  campus: 'south',
  name: 'South Campus',
  defaultOrigin: 'gate',
  waypoints: [
    { id: 'gate', point: { x: 500, y: 1230 }, label: 'Main Gate' },
    { id: 'w1', point: { x: 500, y: 1050 }, label: 'Gate Avenue' },
    { id: 'w2', point: { x: 500, y: 850 }, label: 'Central Plaza' },
    { id: 'w3', point: { x: 500, y: 620 }, label: 'Lecture Walk' },
    { id: 'w4', point: { x: 500, y: 400 }, label: 'Library Square' },
    { id: 'w5', point: { x: 500, y: 200 }, label: 'North Lawn' },
    { id: 'e1', point: { x: 760, y: 850 }, label: 'East Walk' },
    { id: 'e2', point: { x: 760, y: 620 }, label: 'EB Courtyard' },
    { id: 'e3', point: { x: 760, y: 400 }, label: 'Admin Court' },
    { id: 'west1', point: { x: 240, y: 850 }, label: 'West Walk' },
    { id: 'west2', point: { x: 240, y: 620 }, label: 'GB Courtyard' },
    { id: 'west3', point: { x: 240, y: 400 }, label: 'Wellness Garden' },
    { id: 'res', point: { x: 240, y: 1050 }, label: 'Residence Lane' },
    { id: 'shuttle', point: { x: 760, y: 1050 }, label: 'Shuttle Interchange' },
  ],
  paths: [
    ['gate', 'w1'],
    ['w1', 'w2'],
    ['w2', 'w3'],
    ['w3', 'w4'],
    ['w4', 'w5'],
    ['w2', 'e1'],
    ['e1', 'e2'],
    ['e2', 'e3'],
    ['e3', 'w4'],
    ['w2', 'west1'],
    ['west1', 'west2'],
    ['west2', 'west3'],
    ['west3', 'w4'],
    ['w1', 'res'],
    ['res', 'west1'],
    ['w1', 'shuttle'],
    ['shuttle', 'e1'],
    ['w3', 'e2'],
    ['w3', 'west2'],
  ],
  buildings: [
    b('eb', 'EB', 'Business & Economics Building', 885, 620, 170, 150, 'e2', 'academic', 4, [
      'Lecture venues',
      'Faculty office',
      'Computer lab (level 1)',
    ]),
    b('gb', 'GB', 'General Lecture Building', 115, 620, 170, 150, 'west2', 'academic', 3, [
      'Lecture venues',
      'Tutorial rooms',
    ]),
    b('lib', 'LIB', 'Library & Learning Commons', 365, 290, 190, 120, 'w4', 'library', 4, [
      'Group study rooms',
      'Silent pods',
      'Printing',
      'Commons Coffee',
    ]),
    b('ih', 'IH', 'Innovation Hub', 640, 290, 170, 120, 'w4', 'academic', 2, [
      'Project studios',
      'Maker space',
    ]),
    b('sc', 'SC', 'Student Centre', 635, 735, 190, 110, 'w2', 'food', 2, [
      'Campus Kitchen',
      'Bay Grill',
      'Student Help Desk',
    ]),
    b('mh', 'MH', 'Main Hall', 365, 735, 190, 110, 'w2', 'hall', 1, [
      'Ceremonies',
      'Examinations',
    ]),
    b('hw', 'HW', 'Health & Wellness Centre', 110, 395, 150, 120, 'west3', 'support', 2, [
      'Student Counselling',
      'Campus clinic',
    ]),
    b('ad', 'AD', 'Administration & Student Finance', 885, 395, 170, 120, 'e3', 'support', 3, [
      'Student Finance',
      'Student Funding',
      'Registrar',
    ]),
    b('rv', 'RV', 'Residence Village', 110, 1055, 170, 150, 'res', 'residence', 4, [
      'Residence office',
      'Laundry',
      'Common rooms',
    ]),
    b('si', 'SI', 'Shuttle Interchange', 885, 1055, 150, 90, 'shuttle', 'transport', 1, [
      'Shuttle bays A, B and N',
    ]),
    b('cp', 'CP', 'Campus Protection Office', 660, 1195, 130, 70, 'gate', 'support', 1, [
      'Campus Protection Services',
    ]),
  ],
};

/** Rooms the demo timetable and directory refer to. */
export const knownRooms: Record<string, string> = {
  EB212: 'Lecture venue, level 2',
  EB318: 'Staff office, level 3',
  GB101: 'Lecture venue, ground floor',
  GB204: 'Lecture venue, level 2',
  IHS2: 'Project studio 2',
  MH001: 'Main Hall',
};

export const directory: DirectoryPerson[] = [
  {
    id: 'p-ndlovu',
    name: 'Dr Sipho Ndlovu',
    title: 'Senior Lecturer',
    department: 'Marketing Management',
    office: { code: 'EB318', buildingId: 'eb', floor: 3 },
    consultation: 'Tuesdays 11:00–12:00',
  },
  {
    id: 'p-pillay',
    name: 'Dr Anita Pillay',
    title: 'Lecturer',
    department: 'Marketing Management',
    office: { code: 'EB305', buildingId: 'eb', floor: 3 },
    consultation: 'Wednesdays 14:00–15:00',
  },
  {
    id: 'p-vanwyk',
    name: 'Ms Lerato van Wyk',
    title: 'Lecturer, Digital Media',
    department: 'Marketing Management',
    office: { code: 'EB311', buildingId: 'eb', floor: 3 },
    consultation: 'Thursdays 10:00–11:00',
  },
  {
    id: 'p-jacobs',
    name: 'Prof. Naledi Jacobs',
    title: 'Head of Department',
    department: 'Marketing Management',
    office: { code: 'EB401', buildingId: 'eb', floor: 4 },
    consultation: 'By appointment',
  },
  {
    id: 'p-botha',
    name: 'Mr Johan Botha',
    title: 'Residence Life Officer',
    department: 'Residence Life',
    office: { code: 'RV001', buildingId: 'rv', floor: 0 },
    consultation: 'Weekdays 08:00–16:00',
  },
  {
    id: 'p-khumalo',
    name: 'Ms Ayanda Khumalo',
    title: 'Student Funding Officer',
    department: 'Student Funding',
    office: { code: 'AD104', buildingId: 'ad', floor: 1 },
    consultation: 'Weekdays 08:30–15:30',
  },
];
