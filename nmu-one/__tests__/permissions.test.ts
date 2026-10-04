import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_GRANTS,
  ROUTE_CAPABILITIES,
  can,
  capabilityForPath,
  decide,
  type Subject,
} from '@/core/permissions/policy';

const student: Subject = { role: 'student', lifecycle: 'student' };
const staff: Subject = { role: 'staff', lifecycle: 'staff' };
const alumni: Subject = { role: 'alumni', lifecycle: 'alumni' };
const parent = (consents: Subject['consents'] = []): Subject => ({
  role: 'parent',
  lifecycle: 'guardian',
  consents,
});

describe('role-based access (brief §24)', () => {
  it('gives students their academic and financial services', () => {
    expect(can(student, 'academics.timetable')).toBe(true);
    expect(can(student, 'finance.view')).toBe(true);
    expect(can(student, 'finance.pay')).toBe(true);
  });

  it('keeps student records away from staff and alumni', () => {
    for (const s of [staff, alumni]) {
      expect(can(s, 'finance.view')).toBe(false);
      expect(can(s, 'academics.results')).toBe(false);
    }
    expect(decide(staff, 'finance.view')).toEqual({ allowed: false, reason: 'role' });
  });

  it('shows a parent nothing about the student without the student’s grant (brief §3)', () => {
    const none = parent();
    expect(can(none, 'guardian.linked-student')).toBe(true);
    expect(decide(none, 'guardian.fees')).toEqual({
      allowed: false,
      reason: 'consent',
      scope: 'fees',
    });
    expect(decide(none, 'guardian.results')).toEqual({
      allowed: false,
      reason: 'consent',
      scope: 'results',
    });
    const fees = parent(['fees']);
    expect(can(fees, 'guardian.fees')).toBe(true);
    expect(can(fees, 'guardian.results')).toBe(false);
  });

  it('never gives a parent the student’s own finance or academic capabilities', () => {
    const all = parent(['key-dates', 'fees', 'results', 'residence', 'wellbeing-alerts']);
    expect(can(all, 'finance.view')).toBe(false);
    expect(can(all, 'academics.results')).toBe(false);
    expect(can(all, 'academics.timetable')).toBe(false);
  });

  it('offers graduation only at the student lifecycle stage', () => {
    expect(can(student, 'lifecycle.graduate')).toBe(true);
    expect(decide({ role: 'student', lifecycle: 'graduate' }, 'lifecycle.graduate')).toEqual({
      allowed: false,
      reason: 'lifecycle',
    });
  });

  it('holds digital ID back for everyone until NMU approves it (brief §15)', () => {
    for (const s of [student, staff, alumni, parent(['fees'])]) {
      expect(decide(s, 'id.digital')).toEqual({ allowed: false, reason: 'pending-approval' });
    }
  });

  it('lets everyone reach safety, wellbeing and search', () => {
    for (const s of [student, staff, alumni, parent()]) {
      expect(can(s, 'safety.view')).toBe(true);
      expect(can(s, 'wellbeing.view')).toBe(true);
      expect(can(s, 'search.assistant')).toBe(true);
    }
  });

  it('labels every capability and grants only known ones', () => {
    for (const c of CAPABILITIES) expect(CAPABILITY_LABELS[c]).toBeTruthy();
    for (const grants of Object.values(ROLE_GRANTS)) {
      for (const c of Object.keys(grants)) expect(CAPABILITIES).toContain(c);
    }
  });
});

describe('route guards', () => {
  it('maps every guarded route to a real capability', () => {
    for (const c of Object.values(ROUTE_CAPABILITIES)) expect(CAPABILITIES).toContain(c);
  });

  it('uses the longest matching prefix', () => {
    expect(capabilityForPath('/money')).toBe('finance.view');
    expect(capabilityForPath('/money/pay')).toBe('finance.pay');
    expect(capabilityForPath('/money/funding')).toBe('funding.view');
    expect(capabilityForPath('/guardian/fees')).toBe('guardian.fees');
    expect(capabilityForPath('/alumni/give/alumni-bursary')).toBe('alumni.giving');
    expect(capabilityForPath('/academics/class/[id]')).toBe('academics.timetable');
  });

  it('does not match a prefix inside a longer word', () => {
    expect(capabilityForPath('/moneybox')).toBeNull();
    expect(capabilityForPath('/home')).toBeNull();
  });
});
