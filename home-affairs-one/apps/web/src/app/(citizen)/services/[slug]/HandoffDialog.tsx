'use client';

import { Button, Dialog, LinkButton } from '@hao/design-system';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import styles from './service.module.css';

export interface Handoff {
  label: string;
  description: string;
  destination: string;
}

/**
 * Explains where a guidance-and-hand-off journey continues. The destination is
 * shown as plain text on purpose: the prototype is connected to nothing, so it
 * must never offer a working link that looks like an official service.
 */
export function HandoffDialog({ handoff, fullWidth }: { handoff: Handoff; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        fullWidth={fullWidth}
        iconEnd={<ArrowRight aria-hidden="true" />}
      >
        See where this continues
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Where this journey continues"
        actions={
          <>
            <LinkButton href="/help/" variant="secondary">
              Get help
            </LinkButton>
            <Button onClick={close}>Close</Button>
          </>
        }
      >
        <p>
          <strong>{handoff.label}.</strong> {handoff.description}
        </p>
        <p>
          This journey continues on the authoritative service, outside Home Affairs One. That
          service decides what is needed and what happens next.
        </p>
        <p>
          In this prototype the link is illustrative. Nothing is connected, nothing is sent, and the
          address below does not lead anywhere.
        </p>
        <p className={styles.destination}>
          <span className={styles.destinationLabel}>Illustrative address (not a link)</span>
          <span className={styles.destinationValue}>{handoff.destination}</span>
        </p>
      </Dialog>
    </>
  );
}
