import '@testing-library/jest-dom/vitest';
import { DEMO, type PersonAccount } from '@hao/api-contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGateway } from '@/lib/gateway';
import { SessionProvider, useSession } from '@/lib/session';
import { AboutScreen } from '../about/AboutScreen';
import { MoreScreen } from '../more/MoreScreen';
import { WalletFlagGate } from '../wallet/WalletFlagGate';
import { WalletScreen } from '../wallet/WalletScreen';
import { AccessibilityScreen } from './accessibility/AccessibilityScreen';
import { FamilyScreen } from './family/FamilyScreen';
import { PrivacyScreen } from './privacy/PrivacyScreen';
import { ProfileScreen } from './ProfileScreen';
import { PrototypeScreen } from './prototype/PrototypeScreen';
import { SecurityScreen } from './security/SecurityScreen';

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/profile/',
}));

type Method = 'passkey' | 'verified-contact';

function SignIn({ account, method }: { account: PersonAccount; method: Method }) {
  const { signInCitizen } = useSession();
  return (
    <button type="button" onClick={() => signInCitizen(account, method)}>
      Sign in for the test
    </button>
  );
}

async function show(ui: ReactNode, personToken: string | null, method: Method = 'passkey') {
  const gateway = getGateway();
  gateway.platform.store.clear();
  gateway.platform.settings.set({ latencyMs: 0, network: 'normal' });
  if (personToken) {
    const account = await gateway.identity.getAccount(personToken);
    const signIn = render(
      <SessionProvider>
        <SignIn account={account} method={method} />
      </SessionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign in for the test' }));
    signIn.unmount();
  }
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>{ui}</SessionProvider>
    </QueryClientProvider>,
  );
}

describe('profile, wallet, more and about screens (smoke)', () => {
  beforeEach(() => {
    router.push.mockClear();
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
      };
    }
  });

  it('profile hub', async () => {
    await show(<ProfileScreen />, DEMO.persons.thandi);
    expect(await screen.findByRole('heading', { level: 1, name: 'Thandi M.' })).toBeInTheDocument();
    expect(await screen.findByText('t•••••@example.org')).toBeInTheDocument();
    expect(screen.getAllByText('Verified account').length).toBeGreaterThan(0);
    expect(screen.getByText(/Signed in just now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prototype controls' })).toHaveAttribute(
      'href',
      '/profile/prototype/',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('security as a basic account', async () => {
    await show(<SecurityScreen />, DEMO.persons.aisha, 'verified-contact');
    const here = await screen.findByText('You are here');
    expect(here.closest('li')).toHaveTextContent('Basic account');
    expect(await screen.findByText('Recovery is not fully set up')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a passkey (demo)' }));
    expect(await screen.findByText('A passkey is set up on this account.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Verify \(demo\)/ }));
    expect(await screen.findByText('SMS marked as verified')).toBeInTheDocument();
    expect(await screen.findByText('Recovery is set up')).toBeInTheDocument();
    expect(screen.getByText('No stronger check is active')).toBeInTheDocument();
  });

  it('family', async () => {
    const first = await show(<FamilyScreen />, DEMO.persons.sipho);
    expect(await screen.findByRole('heading', { level: 3, name: 'Lwazi D.' })).toBeInTheDocument();
    expect(screen.getByText('Guardian')).toBeInTheDocument();
    first.unmount();
    await show(<FamilyScreen />, DEMO.persons.lerato);
    expect(await screen.findByText('Nobody is linked to your account')).toBeInTheDocument();
  });

  it('privacy: withdraw a consent', async () => {
    await show(<PrivacyScreen />, DEMO.persons.thandi);
    const buttons = await screen.findAllByRole('button', { name: /Withdraw consent/ });
    expect(buttons).toHaveLength(2);
    expect(screen.getAllByText('Active')).toHaveLength(2);
    await userEvent.click(buttons[1]!);
    const dialog = screen.getByRole('dialog', { hidden: true });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw consent', hidden: true }));
    expect(await screen.findByText('Consent withdrawn')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Withdrawn').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Active')).toHaveLength(1);
  });

  it('accessibility', async () => {
    await show(<AccessibilityScreen />, null);
    await userEvent.click(screen.getByRole('radio', { name: /Larger/ }));
    expect(document.documentElement).toHaveAttribute('data-text-size', 'larger');
    await userEvent.click(screen.getByRole('switch', { name: 'Higher contrast' }));
    expect(document.documentElement).toHaveAttribute('data-contrast', 'more');
    await userEvent.click(screen.getByRole('switch', { name: 'Use less data' }));
    expect(document.documentElement).toHaveAttribute('data-saver', 'on');
    await userEvent.click(screen.getByRole('radio', { name: /Standard/ }));
    await userEvent.click(screen.getByRole('switch', { name: 'Higher contrast' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Use less data' }));
  });

  it('prototype controls', async () => {
    await show(<PrototypeScreen />, null);
    expect(screen.getByText(/No calls yet/)).toBeInTheDocument();
    const wallet = screen.getByRole('switch', { name: 'Digital wallet' });
    expect(wallet).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(wallet);
    expect(wallet).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Reset to profile defaults' }));
    expect(wallet).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: /Offline/ }));
    expect(await screen.findByText('The simulated connection is not normal')).toBeInTheDocument();
    await getGateway()
      .identity.listDemoPartners()
      .catch(() => undefined);
    expect(await screen.findByText('identity.listDemoPartners')).toBeInTheDocument();
    expect(screen.getByText('Offline', { selector: 'span' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Normal/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset sample data' }));
    expect(screen.getByText(/Clears every draft/)).toBeInTheDocument();
  });

  it('wallet', async () => {
    await show(
      <WalletFlagGate>
        <WalletScreen />
      </WalletFlagGate>,
      DEMO.persons.thandi,
    );
    expect(await screen.findByRole('heading', { level: 3, name: 'Digital ID (concept)' })).toBeInTheDocument();
    expect(screen.getAllByText('Concept only').length).toBeGreaterThanOrEqual(4);
    await userEvent.click(await screen.findByRole('button', { name: 'See what would be shared' }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(within(dialog).getByText(/A yes or no answer/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Allow (concept)', hidden: true }));
    expect(await within(dialog).findByText('Concept only — nothing was shared.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Who is asking/), 'PARTNER-DEMO-1002');
    expect(within(dialog).getByText('This request would be refused')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Allow (concept)', hidden: true })).toBeNull();
    expect(await getGateway().identity.listConsents(DEMO.persons.thandi)).toHaveLength(2);
  });

  it('more, signed out and signed in', async () => {
    const out = await show(<MoreScreen />, null);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wallet' })).toBeInTheDocument();
    out.unmount();
    await show(<MoreScreen />, DEMO.persons.thandi);
    expect(await screen.findByRole('link', { name: 'Thandi M.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('about', async () => {
    await show(<AboutScreen />, null);
    expect(screen.getByText('60 photographs, 2 flagged for review.')).toBeInTheDocument();
    expect(screen.queryByText('A35')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show all photographs' }));
    expect(screen.getAllByText('Concept use')).toHaveLength(58);
    expect(screen.getAllByText('Needs review')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hide all photographs' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
