'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useId,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { ActionResult } from '@/actions/shared';
import { useAnnounce } from './notice';

export type FormAction = (formData: FormData) => Promise<ActionResult>;

const PendingContext = createContext(false);

interface ActionFormProps extends Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> {
  action: FormAction;
  children: ReactNode;
  /** Clear the fields after a success (compose forms). Edit forms keep what was typed. */
  resetOnSuccess?: boolean;
}

/**
 * A form that calls a Server Action and reports what the server said.
 *
 * The result goes to the page's live region, and a refusal or validation
 * error is also shown under the form it belongs to. Nothing typed is lost
 * when the server says no.
 */
export function ActionForm({ action, children, resetOnSuccess = false, ...rest }: ActionFormProps) {
  const announce = useAnnounce();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const problemId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    // Include the button that was pressed: several forms decide by it.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form, submitter);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action(data);
      } catch {
        result = { ok: false, message: 'Something went wrong and nothing was saved. Try again.' };
      }
      announce(result);
      setProblem(result.ok ? null : result.message);
      if (result.ok && resetOnSuccess) form.reset();
      if (result.ok && result.redirectTo) router.push(result.redirectTo);
    });
  }

  return (
    <form
      {...rest}
      onSubmit={onSubmit}
      aria-busy={pending}
      aria-describedby={problem ? problemId : undefined}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {problem ? (
        <p id={problemId} className="form-problem">
          {problem}
        </p>
      ) : null}
    </form>
  );
}

interface SubmitButtonProps extends Omit<ComponentProps<'button'>, 'type'> {
  variant?: 'primary' | 'secondary' | 'quiet';
}

/** A submit button that stays focusable while its form is working. */
export function SubmitButton({
  variant = 'secondary',
  className,
  children,
  ...rest
}: SubmitButtonProps) {
  const pending = useContext(PendingContext);
  return (
    <button
      {...rest}
      type="submit"
      className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')}
      aria-disabled={pending || undefined}
    >
      {children}
    </button>
  );
}
