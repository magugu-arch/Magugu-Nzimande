/**
 * SYNTHETIC DEMO DATA — brief §24 "no PII in demo fixtures".
 * Every person, number and address here is invented. Email addresses use the
 * reserved `.test` domain so none can ever be delivered.
 */
import type { PersonaId } from '../adapters/contracts';
import type {
  AlumniProfile,
  ParentProfile,
  SharingScope,
  StaffProfile,
  StudentProfile,
  User,
} from '../domain/models';

export const personas: Record<PersonaId, User> = {
  student: {
    id: 'u-demo-student',
    givenName: 'Thandi',
    familyName: 'Mokoena',
    roles: ['student'],
    lifecycle: 'student',
    homeCampus: 'south',
    email: 'thandi.mokoena@students.nmu-one.test',
  },
  staff: {
    id: 'u-demo-staff',
    givenName: 'Sipho',
    familyName: 'Ndlovu',
    // Staff and an NMU graduate: one identity, two roles (brief §4 role switch).
    roles: ['staff', 'alumni'],
    lifecycle: 'staff',
    homeCampus: 'south',
    email: 'sipho.ndlovu@staff.nmu-one.test',
  },
  parent: {
    id: 'u-demo-parent',
    givenName: 'Nomsa',
    familyName: 'Mokoena',
    roles: ['parent'],
    lifecycle: 'guardian',
    homeCampus: 'south',
    email: 'nomsa.mokoena@family.nmu-one.test',
  },
  alumni: {
    id: 'u-demo-alumni',
    givenName: 'Lwazi',
    familyName: 'Dube',
    roles: ['alumni'],
    lifecycle: 'alumni',
    homeCampus: 'south',
    email: 'lwazi.dube@alumni.nmu-one.test',
  },
};

export const personaDescriptions: Record<PersonaId, string> = {
  student: 'Final-year BCom Marketing student',
  staff: 'Senior Lecturer and NMU alumnus',
  parent: 'Parent of a final-year student',
  alumni: 'BSc Computer Science, class of 2014',
};

export const studentProfile = (ceremony: string): StudentProfile => ({
  userId: personas.student.id,
  studentNumber: '224 000 417',
  faculty: 'Business and Economic Sciences',
  qualification: 'BCom Marketing Management',
  yearOfStudy: 3,
  finalYear: true,
  graduation: { eligible: true, ceremony, venue: 'Main Hall, South Campus' },
});

export const staffProfile: StaffProfile = {
  userId: personas.staff.id,
  staffNumber: '110 2',
  title: 'Senior Lecturer',
  department: 'Marketing Management',
  office: { code: 'EB318', buildingId: 'eb', floor: 3 },
};

export const parentProfile = (
  sharingUpdatedAt: string,
  sharing: SharingScope[] = ['key-dates', 'fees'],
): ParentProfile => ({
  userId: personas.parent.id,
  linkedStudents: [
    {
      studentId: personas.student.id,
      givenName: 'Thandi',
      relationship: 'parent',
      qualification: 'BCom Marketing Management',
      // By default Thandi shares key dates and fees — not results (brief §3:
      // nothing without explicit permission). She can change it in Privacy.
      sharing,
      sharingUpdatedAt,
    },
  ],
});

export const alumniProfiles: Record<string, AlumniProfile> = {
  [personas.alumni.id]: {
    userId: personas.alumni.id,
    graduationYear: 2014,
    qualification: 'BSc Computer Science',
    industry: 'Financial technology',
    expertise: ['Product management', 'Software engineering', 'Start-ups'],
    mentorStatus: 'active',
    chapter: 'Gauteng Chapter',
    profileCompleteness: 0.8,
  },
  [personas.staff.id]: {
    userId: personas.staff.id,
    graduationYear: 2009,
    qualification: 'MCom Marketing',
    industry: 'Higher education',
    expertise: ['Marketing strategy', 'Research supervision'],
    mentorStatus: 'active',
    chapter: 'Nelson Mandela Bay Chapter',
    profileCompleteness: 0.9,
  },
  [personas.student.id]: {
    userId: personas.student.id,
    graduationYear: 2026,
    qualification: 'BCom Marketing Management',
    industry: null,
    expertise: ['Digital marketing', 'Brand strategy'],
    mentorStatus: 'not-mentor',
    chapter: 'Nelson Mandela Bay Chapter',
    profileCompleteness: 0.45,
  },
};
