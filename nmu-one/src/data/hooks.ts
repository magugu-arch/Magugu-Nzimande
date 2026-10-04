import { providers } from '@/core/adapters/registry';
import { clock } from '@/core/time/clock';
import { addDays, startOfSastDay } from '@/core/time/sast';
import { useSession } from '@/state/session';
import { useDomainQuery } from './useDomainQuery';

/**
 * One hook per thing a screen shows. Keys always carry the user id so two
 * people on one device never share a cache entry, and the first element is
 * the offline-policy name (core/offline/policy.ts).
 */
const useUserId = () => useSession((s) => s.user?.id ?? 'anon');
const useRole = () => useSession((s) => s.role);

const todayRange = () => {
  const start = startOfSastDay(clock.now());
  return { from: start.toISOString(), to: addDays(start, 1).toISOString() };
};
const weekRange = () => {
  const start = startOfSastDay(clock.now());
  return { from: start.toISOString(), to: addDays(start, 7).toISOString() };
};
const dayKey = () => startOfSastDay(clock.now()).toISOString().slice(0, 10);

// ── Identity ────────────────────────────────────────────────────────────────

export const useStudentProfile = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('auth', ['student-profile', uid], () => providers.auth.getStudentProfile(uid), { enabled });
};

export const useStaffProfile = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('auth', ['staff-profile', uid], () => providers.auth.getStaffProfile(uid), { enabled });
};

// ── Academics ───────────────────────────────────────────────────────────────

export const useTimetableToday = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('academic', ['timetable', uid, 'today', dayKey()], () => providers.academic.getTimetable(todayRange()), { enabled });
};

export const useTimetableWeek = () => {
  const uid = useUserId();
  return useDomainQuery('academic', ['timetable', uid, 'week', dayKey()], () => providers.academic.getTimetable(weekRange()));
};

export const useTeachingWeek = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('academic', ['teaching', uid, dayKey()], () => providers.academic.getTeachingTimetable(weekRange()), { enabled });
};

export const useExams = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('academic', ['exams', uid], () => providers.academic.getExams(), { enabled });
};

export const useResults = () => {
  const uid = useUserId();
  return useDomainQuery('academic', ['results', uid], () => providers.academic.getResults());
};

export const useProgress = () => {
  const uid = useUserId();
  return useDomainQuery('academic', ['progress', uid], () => providers.academic.getProgress());
};

export const useModules = () => {
  const uid = useUserId();
  return useDomainQuery('academic', ['modules', uid], () => providers.academic.getModules());
};

export const useAcademicCalendar = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('academic', ['calendar', uid], () => providers.academic.getAcademicCalendar(), { enabled });
};

export const useLmsLinks = (moduleCode: string) =>
  useDomainQuery('learning', ['lms-links', moduleCode], () => providers.learning.getLinks(moduleCode));

// ── Money ───────────────────────────────────────────────────────────────────

export const useAccount = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('finance', ['account', uid], () => providers.finance.getAccount(), { enabled });
};

export const useTransactions = () => {
  const uid = useUserId();
  return useDomainQuery('finance', ['transactions', uid], () => providers.finance.getTransactions());
};

export const useFunding = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('finance', ['funding', uid], () => providers.finance.getFunding(), { enabled });
};

export const useReceipt = (id: string) => {
  const uid = useUserId();
  return useDomainQuery('finance', ['receipt', uid, id], () => providers.finance.getReceipt(id));
};

// ── Campus ──────────────────────────────────────────────────────────────────

export const useCampusMap = () => useDomainQuery('campus', ['campus-map'], () => providers.campus.getMap());

export const useDirectory = () => {
  const uid = useUserId();
  return useDomainQuery('campus', ['directory', uid], () => providers.campus.getDirectory());
};

export const useStudySpaces = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery(
    'library',
    ['study-spaces', uid, dayKey()],
    () => providers.library.getStudySpaces(startOfSastDay(clock.now()).toISOString()),
    { enabled },
  );
};

export const useBookings = () => {
  const uid = useUserId();
  return useDomainQuery('library', ['bookings', uid], () => providers.library.getBookings());
};

export const useLibrarySearch = (query: string) =>
  useDomainQuery('library', ['library-search', query], () => providers.library.search(query));

export const useShuttleRoutes = (enabled = true) =>
  useDomainQuery('transport', ['shuttle-routes'], () => providers.transport.getRoutes(), {
    enabled,
    refetchInterval: 60_000,
  });

/** Polls every 30 s: an ETA is only useful while it is current. */
export const useArrivals = (enabled = true) =>
  useDomainQuery('transport', ['arrivals'], () => providers.transport.getArrivals(), {
    enabled,
    refetchInterval: 30_000,
  });

export const useDisruptions = () =>
  useDomainQuery('transport', ['disruptions'], () => providers.transport.getDisruptions());

export const useResidence = () => {
  const uid = useUserId();
  return useDomainQuery('residence', ['residence', uid], () => providers.residence.getResidence());
};

// ── Commerce ────────────────────────────────────────────────────────────────

export const useVendors = (enabled = true) =>
  useDomainQuery('commerce', ['vendors'], () => providers.commerce.getVendors(), { enabled });

export const useMenu = (vendorId: string) =>
  useDomainQuery('commerce', ['menu', vendorId], () => providers.commerce.getMenu(vendorId));

/** Polls while the kitchen is working on it; stops once it is ready. */
export const useOrder = (id: string) => {
  const uid = useUserId();
  return useDomainQuery('commerce', ['order', uid, id], () => providers.commerce.getOrder(id), {
    refetchInterval: (order) =>
      order && (order.status === 'ready' || order.status === 'collected' || order.status === 'cancelled')
        ? false
        : 2_000,
  });
};

export const useOrders = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('commerce', ['orders', uid], () => providers.commerce.getOrders(), { enabled });
};

// ── Community ───────────────────────────────────────────────────────────────

export const useEvents = () => {
  const uid = useUserId();
  const role = useRole();
  return useDomainQuery('community', ['events', uid, role], () => providers.community.getEvents());
};

export const useEvent = (id: string) =>
  useDomainQuery('community', ['event', id], () => providers.community.getEvent(id));

export const useTickets = () => {
  const uid = useUserId();
  return useDomainQuery('community', ['tickets', uid], () => providers.community.getTickets());
};

export const useSocieties = () =>
  useDomainQuery('community', ['societies'], () => providers.community.getSocieties());

export const useNotificationsQuery = () => {
  const uid = useUserId();
  return useDomainQuery('notifications', ['notifications', uid], () => providers.notifications.list());
};

// ── Support ─────────────────────────────────────────────────────────────────

export const useSafetyContacts = () =>
  useDomainQuery('support', ['safety-contacts'], () => providers.support.getSafetyContacts());

export const useWellbeingServices = () =>
  useDomainQuery('support', ['wellbeing'], () => providers.support.getWellbeingServices());

export const useSupportRoutes = () =>
  useDomainQuery('support', ['support-routes'], () => providers.support.getSupportRoutes());

// ── Guardian ────────────────────────────────────────────────────────────────

export const useGuardianProfile = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('guardian', ['guardian-profile', uid], () => providers.guardian.getProfile(), { enabled });
};

export const useGuardianUpdates = (studentId: string | undefined) => {
  const uid = useUserId();
  return useDomainQuery(
    'guardian',
    ['guardian-updates', uid, studentId],
    () => providers.guardian.getUpdates(studentId!),
    { enabled: !!studentId },
  );
};

export const useGuardianAccount = (studentId: string | undefined, enabled = true) => {
  const uid = useUserId();
  return useDomainQuery(
    'guardian',
    ['guardian-fees', uid, studentId],
    () => providers.guardian.getStudentAccount(studentId!),
    { enabled: enabled && !!studentId },
  );
};

export const useMyGuardians = () => {
  const uid = useUserId();
  return useDomainQuery('guardian', ['my-guardians', uid], () => providers.guardian.getMyGuardians());
};

// ── Alumni ──────────────────────────────────────────────────────────────────

export const useAlumniProfile = (enabled = true) => {
  const uid = useUserId();
  const role = useRole();
  return useDomainQuery('alumni', ['alumni-profile', uid, role], () => providers.alumni.getProfile(), { enabled });
};

export const useMentoring = (enabled = true) => {
  const uid = useUserId();
  const role = useRole();
  return useDomainQuery('alumni', ['mentoring', uid, role], () => providers.alumni.getMentoring(), { enabled });
};

export const useJobs = (enabled = true) => {
  const uid = useUserId();
  return useDomainQuery('alumni', ['jobs', uid], () => providers.alumni.getJobs(), { enabled });
};

export const useCampaigns = (enabled = true) =>
  useDomainQuery('alumni', ['campaigns'], () => providers.alumni.getCampaigns(), { enabled });

export const useStories = () => useDomainQuery('alumni', ['stories'], () => providers.alumni.getStories());

export const useChapters = () => useDomainQuery('alumni', ['chapters'], () => providers.alumni.getChapters());
