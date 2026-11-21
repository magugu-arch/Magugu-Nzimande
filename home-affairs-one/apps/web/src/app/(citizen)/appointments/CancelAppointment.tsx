'use client';

import { announce } from '@hao/accessibility';
import type { Appointment } from '@hao/api-contracts';
import { Button, Dialog, Notice } from '@hao/design-system';
import { useState } from 'react';
import { formatTime, formatTimeInZone } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation } from '@/lib/queries';
import { formatAppointmentDay, SAST } from '../applications/case-helpers';
import styles from './appointments.module.css';

const CANCELLED_MESSAGE = 'Appointment cancelled. Book a new time when you are ready.';

/** "Cancel appointment" with its confirmation dialog. The booking is only released after a yes. */
export function CancelAppointment({
  appointment,
  consequence,
  onCancelled,
}: {
  appointment: Appointment;
  /** What cancelling means for the application, in one sentence. */
  consequence: string;
  onCancelled?: () => void;
}) {
  // A key exists while the dialog is open: one key for this decision to cancel.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const cancel = useGatewayMutation((g, key: string) =>
    g.appointments.cancel(appointment.appointmentId, { idempotencyKey: key }),
  );
  const close = () => setIdempotencyKey(null);

  const time =
    appointment.timeZone === SAST
      ? formatTime(appointment.startsAt)
      : formatTimeInZone(appointment.startsAt, appointment.timeZone);

  return (
    <>
      <Button
        variant="quiet"
        className={styles.dangerQuiet}
        onClick={() => {
          cancel.reset();
          setIdempotencyKey(newIdempotencyKey('cancel-appointment'));
        }}
      >
        Cancel appointment
      </Button>

      <Dialog
        open={idempotencyKey !== null}
        onClose={close}
        title="Cancel this appointment?"
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Keep appointment
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => {
                if (!idempotencyKey) return;
                cancel.mutate(idempotencyKey, {
                  onSuccess: () => {
                    close();
                    announce(CANCELLED_MESSAGE);
                    onCancelled?.();
                  },
                });
              }}
            >
              Cancel appointment
            </Button>
          </>
        }
      >
        <p>
          Your time on {formatAppointmentDay(appointment.startsAt, appointment.timeZone)} at {time}{' '}
          at {appointment.servicePointName} will be released.
        </p>
        <p>{consequence}</p>
        {cancel.error ? (
          <Notice tone="danger" role="alert" title="We could not cancel the appointment">
            <p>{cancel.error.safeMessage}</p>
            <p>Reference for support: {cancel.error.traceRef}</p>
          </Notice>
        ) : null}
      </Dialog>
    </>
  );
}
