import {
  canTransition,
  customerStatus,
  IllegalTransitionError,
  isTerminal,
  lifecycleFor,
  LIFECYCLE_STATES,
  nextStates,
  recordTransition,
  transition,
  type LifecycleState,
} from '@/features/orders/stateMachine';

/**
 * The brief's §6 asks for the transitions to be enforced rather than described.
 * These are the moves that must be refused, and the ones that must not be.
 */

describe('the shape of the machine', () => {
  it('carries all fourteen states the brief lists', () => {
    expect(LIFECYCLE_STATES).toHaveLength(14);
    for (const state of [
      'DRAFT',
      'AWAITING_PAYMENT',
      'PAYMENT_AUTHORISED',
      'PLACED',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'COURIER_REQUESTED',
      'COURIER_ASSIGNED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COLLECTED',
      'CANCELLED',
      'REFUNDED',
    ] as LifecycleState[]) {
      expect(LIFECYCLE_STATES).toContain(state);
    }
  });

  it('only ever points at states that exist', () => {
    for (const state of LIFECYCLE_STATES) {
      for (const next of nextStates(state)) {
        expect(LIFECYCLE_STATES).toContain(next);
      }
    }
  });

  it('ends somewhere — every state can reach a terminal one', () => {
    const terminal = LIFECYCLE_STATES.filter(isTerminal);
    expect(terminal).toEqual(['REFUNDED']);

    for (const start of LIFECYCLE_STATES) {
      const seen = new Set<LifecycleState>();
      const queue: LifecycleState[] = [start];
      let reached = false;

      while (queue.length > 0) {
        const state = queue.shift() as LifecycleState;
        if (seen.has(state)) continue;
        seen.add(state);
        if (isTerminal(state)) {
          reached = true;
          break;
        }
        queue.push(...nextStates(state));
      }

      expect([start, reached]).toEqual([start, true]);
    }
  });

  it('never loops back on itself', () => {
    for (const state of LIFECYCLE_STATES) {
      expect(nextStates(state)).not.toContain(state);
    }
  });
});

describe('moves that must be refused', () => {
  it('will not send a delivered order back to the kitchen', () => {
    expect(canTransition('DELIVERED', 'PREPARING')).toBe(false);
    expect(() => transition('DELIVERED', 'PREPARING')).toThrow(IllegalTransitionError);
  });

  it('will not deliver an order nobody has paid for', () => {
    expect(canTransition('AWAITING_PAYMENT', 'OUT_FOR_DELIVERY')).toBe(false);
  });

  it('will not un-cancel an order', () => {
    expect(canTransition('CANCELLED', 'PREPARING')).toBe(false);
    expect(canTransition('CANCELLED', 'PLACED')).toBe(false);
  });

  it('will not move anything out of a refund', () => {
    for (const state of LIFECYCLE_STATES) {
      expect(canTransition('REFUNDED', state)).toBe(false);
    }
  });

  it('will not skip the kitchen', () => {
    expect(canTransition('PLACED', 'OUT_FOR_DELIVERY')).toBe(false);
    expect(canTransition('ACCEPTED', 'DELIVERED')).toBe(false);
  });

  it('will not assign a courier before one is asked for', () => {
    expect(canTransition('PREPARING', 'COURIER_ASSIGNED')).toBe(false);
    expect(canTransition('PREPARING', 'OUT_FOR_DELIVERY')).toBe(false);
  });
});

describe('moves that must be allowed', () => {
  it('walks a delivery order from draft to delivered', () => {
    const path = lifecycleFor('delivery');
    let state = path[0] as LifecycleState;

    for (const next of path.slice(1)) {
      expect([state, next, canTransition(state, next)]).toEqual([state, next, true]);
      state = transition(state, next);
    }

    expect(state).toBe('DELIVERED');
  });

  it('walks a collection order from draft to collected', () => {
    const path = lifecycleFor('collection');
    let state = path[0] as LifecycleState;

    for (const next of path.slice(1)) {
      expect([state, next, canTransition(state, next)]).toEqual([state, next, true]);
      state = transition(state, next);
    }

    expect(state).toBe('COLLECTED');
  });

  it('never routes a collection order through a courier', () => {
    const path = lifecycleFor('collection');
    expect(path).not.toContain('COURIER_REQUESTED');
    expect(path).not.toContain('COURIER_ASSIGNED');
    expect(path).not.toContain('OUT_FOR_DELIVERY');
  });

  it('lets a dine-in order take the collection path', () => {
    expect(lifecycleFor('dinein')).toEqual(lifecycleFor('collection'));
  });

  it('can cancel at every point before the order is finished', () => {
    const cancellable: LifecycleState[] = [
      'DRAFT',
      'AWAITING_PAYMENT',
      'PAYMENT_AUTHORISED',
      'PLACED',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'COURIER_REQUESTED',
      'COURIER_ASSIGNED',
      'OUT_FOR_DELIVERY',
    ];

    for (const state of cancellable) {
      expect([state, canTransition(state, 'CANCELLED')]).toEqual([state, true]);
    }
  });

  it('can refund a completed order without reopening it', () => {
    expect(canTransition('DELIVERED', 'REFUNDED')).toBe(true);
    expect(canTransition('COLLECTED', 'REFUNDED')).toBe(true);
    expect(canTransition('CANCELLED', 'REFUNDED')).toBe(true);
  });
});

describe('what the customer is shown', () => {
  it('reads everything before the kitchen as received', () => {
    for (const state of [
      'DRAFT',
      'AWAITING_PAYMENT',
      'PAYMENT_AUTHORISED',
      'PLACED',
      'ACCEPTED',
    ] as LifecycleState[]) {
      expect(customerStatus(state)).toBe('received');
    }
  });

  it('does not leak courier plumbing into the timeline', () => {
    expect(customerStatus('COURIER_REQUESTED')).toBe('ready');
    expect(customerStatus('COURIER_ASSIGNED')).toBe('ready');
  });

  it('maps both endings to completed and both failures to cancelled', () => {
    expect(customerStatus('DELIVERED')).toBe('completed');
    expect(customerStatus('COLLECTED')).toBe('completed');
    expect(customerStatus('CANCELLED')).toBe('cancelled');
    expect(customerStatus('REFUNDED')).toBe('cancelled');
  });

  it('has an answer for every state', () => {
    for (const state of LIFECYCLE_STATES) {
      expect(typeof customerStatus(state)).toBe('string');
    }
  });
});

describe('the log the brief asks for', () => {
  it('records who moved it and when', () => {
    const at = new Date('2026-09-02T10:00:00.000Z');
    const event = recordTransition('PREPARING', 'COURIER_REQUESTED', 'kitchen', undefined, at);

    expect(event).toEqual({
      from: 'PREPARING',
      to: 'COURIER_REQUESTED',
      at: at.toISOString(),
      actor: 'kitchen',
    });
  });

  it('keeps the reason when there is one', () => {
    const event = recordTransition('PLACED', 'CANCELLED', 'customer', 'Changed their mind');
    expect(event.reason).toBe('Changed their mind');
  });

  it('refuses to log a move that could not have happened', () => {
    expect(() => recordTransition('DELIVERED', 'PREPARING', 'kitchen')).toThrow(
      IllegalTransitionError,
    );
  });
});
