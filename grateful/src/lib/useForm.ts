import { useState } from 'react';
import type { z } from 'zod';
import { fieldErrors } from '../../shared/validation';
import { RequestError } from './api';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Small form state machine shared by contact, newsletter and booking details:
 * validate with the shared schema, submit, and surface server field errors
 * in the same place as client ones. Adds the anti-spam timing field.
 */
export function useForm<S extends z.ZodType>(schema: S, initial: Record<string, unknown>) {
  const [values, setValues] = useState<Record<string, unknown>>({ ...initial, company: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  const set = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  async function submit(send: (data: z.output<S>) => Promise<unknown>) {
    const parsed = schema.safeParse({ ...values, elapsedMs: Date.now() - openedAt });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus('error');
      setMessage('Please check the highlighted fields.');
      return false;
    }
    setStatus('submitting');
    setErrors({});
    try {
      await send(parsed.data);
      setStatus('success');
      setMessage('');
      return true;
    } catch (e) {
      const err = e instanceof RequestError ? e : new RequestError('Something went wrong. Please try again.', 0);
      setErrors(err.fields);
      setMessage(err.message);
      setStatus('error');
      return false;
    }
  }

  const reset = () => {
    setValues({ ...initial, company: '' });
    setStatus('idle');
    setOpenedAt(Date.now());
  };

  return { values, errors, status, message, set, submit, reset, setStatus };
}
