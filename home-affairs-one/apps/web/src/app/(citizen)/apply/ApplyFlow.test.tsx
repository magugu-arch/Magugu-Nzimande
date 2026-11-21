import { DEMO } from '@hao/api-contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findService } from '@/lib/catalogue';
import { getGateway } from '@/lib/gateway';
import { SessionProvider, useSession } from '@/lib/session';
import { ApplyFlow } from './ApplyFlow';

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams('service=SMART_ID_REPLACEMENT'),
  usePathname: () => '/apply/',
}));

let sessionApi: ReturnType<typeof useSession> | null = null;

/** Stands in for the page: the guard has run and the service is known. */
function Harness({ code }: { code: string }) {
  const api = useSession();
  sessionApi = api;
  const service = findService(code);
  if (!api.session || !service) return null;
  return <ApplyFlow service={service} session={api.session} initialDraft={null} />;
}

/** Renders the flow for a demo person signed in the way the sign-in screen does it. */
async function renderFlow(
  code: string,
  personToken: string,
  method: 'passkey' | 'verified-contact',
) {
  const gateway = getGateway();
  gateway.platform.settings.set({ latencyMs: 0 });
  const account = await gateway.identity.getAccount(personToken);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Harness code={code} />
      </SessionProvider>
    </QueryClientProvider>,
  );
  act(() => {
    sessionApi?.signInCitizen(account, method);
  });
}

const stepHeading = (name: string) => screen.findByRole('heading', { level: 2, name });

describe('the guided application journey', () => {
  beforeEach(() => {
    router.replace.mockClear();
    router.push.mockClear();
    // jsdom has no layout, so it does not implement scrolling.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('takes a verified person from "Start" to "Application received", one step at a time', async () => {
    const user = userEvent.setup();
    await renderFlow('SMART_ID_REPLACEMENT', DEMO.persons.thandi, 'passkey');

    // Before you start: content first, nothing saved yet.
    await stepHeading('Before you start');
    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // Your details: pre-filled from the profile, read-only. The draft now exists and is in the URL.
    const details = await stepHeading('Your details');
    expect(details).toHaveFocus();
    expect(router.replace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/apply\/\?service=SMART_ID_REPLACEMENT&draft=DRAFT-DEMO-\d+$/),
      { scroll: false },
    );
    const fullName = await screen.findByRole('textbox', { name: /Full name/ });
    expect(fullName).toHaveValue('Thandi M.');
    expect(fullName).toHaveAttribute('readonly');
    expect(screen.getByText(/^Saved /)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // About your replacement: a specific error, linked to the field, with focus on the summary.
    await stepHeading('About your replacement');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const problem = await screen.findByRole('link', { name: 'Choose why you need a replacement' });
    expect(screen.getByRole('alert')).toHaveTextContent('There is a problem');
    await user.click(problem);
    expect(screen.getByRole('radio', { name: 'Lost' })).toHaveFocus();
    await user.click(screen.getByRole('radio', { name: 'Stolen' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Supporting evidence: no file input anywhere, only a synthetic placeholder.
    await stepHeading('Supporting evidence');
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('link', { name: /Attach a synthetic placeholder for/ });
    await user.click(screen.getByRole('button', { name: 'Attach a synthetic placeholder' }));
    await screen.findByText('Synthetic placeholder — no real file');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Review: the declaration is never pre-ticked, and Continue is refused without it.
    await stepHeading('Review and declaration');
    expect(screen.getByText('Stolen')).toBeInTheDocument();
    const declaration = screen.getByRole('checkbox', { name: /I confirm that the information/ });
    expect(declaration).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('link', { name: /Tick the declaration/ });
    await user.click(declaration);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Confirm it is you: an explicit step-up, never silent.
    await stepHeading('Confirm it is you');
    await user.click(screen.getByRole('button', { name: 'Confirm with passkey' }));

    // Payment sandbox: a declined attempt can be retried, then approved.
    await stepHeading('Payment (sandbox)');
    await user.click(screen.getByRole('radio', { name: /Decline/ }));
    await user.click(screen.getByRole('button', { name: 'Pay sample amount' }));
    await screen.findByText(/The sandbox declined this payment\. Nothing was charged\./);
    await user.click(screen.getByRole('radio', { name: /Time out/ }));
    await user.click(screen.getByRole('button', { name: 'Pay sample amount' }));
    await screen.findByText(/The payment did not complete in time\./);
    await user.click(screen.getByRole('radio', { name: /Approve/ }));
    await user.click(screen.getByRole('button', { name: 'Pay sample amount' }));
    await screen.findByText(/RCPT-DEMO-/);
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    // Submit: nothing has been sent until the person presses the button.
    await stepHeading('Submit');
    const person = DEMO.persons.thandi;
    const casesBefore = await getGateway().workflow.listCases(person);
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    const received = await stepHeading('Application received');
    expect(received).toHaveFocus();
    const casesAfter = await getGateway().workflow.listCases(person);
    expect(casesAfter).toHaveLength(casesBefore.length + 1);
    const opened = casesAfter.find(
      (item) => !casesBefore.some((before) => before.caseId === item.caseId),
    );
    expect(opened?.serviceCode).toBe('SMART_ID_REPLACEMENT');
    expect(screen.getByText(opened?.caseId ?? 'missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track this application' })).toHaveAttribute(
      'href',
      `/applications/case/?id=${opened?.caseId}`,
    );
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/home/');
    expect(screen.queryByText(/approved your application/i)).not.toBeInTheDocument();
  }, 30_000);

  it('does not dead-end a person who signed in with a one-time code', async () => {
    const user = userEvent.setup();
    await renderFlow('ADULT_PASSPORT', DEMO.persons.thandi, 'verified-contact');

    await stepHeading('Before you start');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await stepHeading('Your details');
    await screen.findByRole('textbox', { name: /Full name/ });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await stepHeading('About your passport');
    await user.selectOptions(screen.getByRole('combobox', { name: 'What do you need?' }), 'New');
    await user.click(screen.getByRole('radio', { name: 'Collect at a service point' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Back keeps the answers.
    await stepHeading('Supporting evidence');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await stepHeading('About your passport');
    expect(screen.getByRole('combobox', { name: 'What do you need?' })).toHaveValue('new');
    expect(screen.getByRole('radio', { name: 'Collect at a service point' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await stepHeading('Supporting evidence');
    await user.click(screen.getByRole('button', { name: 'Attach a synthetic placeholder' }));
    await screen.findByRole('button', { name: 'Remove' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await stepHeading('Review and declaration');
    await user.click(screen.getByRole('checkbox', { name: /I confirm that the information/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await stepHeading('Confirm it is you');
    await user.click(screen.getByRole('button', { name: 'Confirm with passkey' }));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('This account cannot confirm with a passkey yet');
    expect(notice).toHaveTextContent('Your draft is saved');
    expect(
      screen.getByRole('link', { name: 'See how to verify your account' }),
    ).toHaveAttribute('href', '/profile/security/');
    expect(screen.getByRole('link', { name: 'Find a service point' })).toHaveAttribute(
      'href',
      '/service-points/',
    );
    expect(screen.queryByRole('button', { name: 'Submit application' })).toBeNull();
  }, 30_000);
});
