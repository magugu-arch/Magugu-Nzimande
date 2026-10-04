import { create } from 'zustand';
import type { AuditEvent, AuditType, ConsentPurpose, ConsentRecord } from '@/core/domain/models';
import { clock } from '@/core/time/clock';

/**
 * Consent and audit trail — brief §13 ("consent rules", "auditability") and
 * §24 ("audit logs", "consent recording", "purpose controls").
 *
 * Kept in memory for the session and shown to the person under Profile →
 * Privacy. In live mode each entry is also sent to the BFF's audit endpoint,
 * which is the record of truth; the device copy is a convenience.
 */

/** Bump when consent wording changes, so earlier agreements can be re-asked. */
export const NOTICE_VERSION = '2026-10';
const MAX_AUDIT = 200;

let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

interface GovernanceState {
  consents: ConsentRecord[];
  audit: AuditEvent[];
  recordConsent(purpose: ConsentPurpose, granted: boolean): ConsentRecord;
  hasConsent(purpose: ConsentPurpose): boolean;
  audit_(type: AuditType, actorId: string, detail: string): void;
  reset(): void;
}

export const useGovernance = create<GovernanceState>((set, get) => ({
  consents: [],
  audit: [],

  recordConsent(purpose, granted) {
    const record: ConsentRecord = {
      id: id('consent'),
      purpose,
      granted,
      at: clock.now().toISOString(),
      noticeVersion: NOTICE_VERSION,
    };
    set((s) => ({ consents: [record, ...s.consents] }));
    return record;
  },

  hasConsent(purpose) {
    // The latest decision for a purpose wins.
    return get().consents.find((c) => c.purpose === purpose)?.granted ?? false;
  },

  audit_(type, actorId, detail) {
    const event: AuditEvent = {
      id: id('audit'),
      type,
      at: clock.now().toISOString(),
      actorId,
      detail,
    };
    set((s) => ({ audit: [event, ...s.audit].slice(0, MAX_AUDIT) }));
  },

  reset() {
    set({ consents: [], audit: [] });
  },
}));

/** Records an audit event from outside React. */
export const recordAudit = (type: AuditType, actorId: string, detail: string) =>
  useGovernance.getState().audit_(type, actorId, detail);
