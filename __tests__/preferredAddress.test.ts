import type { Address } from '@/types';
import { preferredAddress } from '@/features/checkout/preferredAddress';
import { useFulfilmentStore } from '@/store/fulfilmentStore';

const at = (id: string, label: string, isDefault = false): Address => ({
  id,
  label,
  line1: `${id} Acacia Road`,
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.1446,
  longitude: 28.0424,
  isDefault,
});

/**
 * Checkout picks a branch and a card for a customer who has not chosen one,
 * and used to leave the address alone. Every journey ever driven through this
 * app places a *first* order, where the address is already in hand — so the
 * gap only opened on the second one, which is the commonest order there is.
 *
 *     FIRST order  : {"disabled":null,  "reason":"(none)"}
 *     SECOND order : {"disabled":"true","reason":"Add a delivery address"}
 */
describe('which address to pre-select', () => {
  it('takes the one the customer marked default', () => {
    const chosen = preferredAddress([at('a1', 'Work'), at('a2', 'Home', true)]);
    expect(chosen?.id).toBe('a2');
  });

  /**
   * The common case here, and easy to miss: the address form flags a default
   * only when the customer ticks the box, so the first address most people
   * save is not flagged at all. A default-only rule would leave exactly the
   * customer this fix is for still blocked.
   */
  it('takes a lone saved address even though nothing marked it default', () => {
    const chosen = preferredAddress([at('a1', 'Home')]);
    expect(chosen?.id).toBe('a1');
  });

  it('declines to guess between several when none is preferred', () => {
    expect(preferredAddress([at('a1', 'Home'), at('a2', 'Mom')])).toBeUndefined();
  });

  it('has nothing to offer someone with nothing saved', () => {
    expect(preferredAddress([])).toBeUndefined();
  });
});

/**
 * The other half of the same defect. `reset()` runs when an order is placed,
 * and it nulled the address — so even a customer whose address was sitting in
 * the persisted store came back to checkout without one.
 */
describe('what survives placing an order', () => {
  beforeEach(() => {
    useFulfilmentStore.getState().forgetPerson();
  });

  it('keeps the address and the note for the driver', () => {
    const state = useFulfilmentStore.getState();
    state.setAddress({ ...at('a1', 'Home', true), instructions: 'Buzz 4B' });

    useFulfilmentStore.getState().reset();

    const after = useFulfilmentStore.getState();
    expect(after.address?.id).toBe('a1');
    expect(after.deliveryInstructions).toBe('Buzz 4B');
  });

  it('drops what belonged to that order alone', () => {
    const state = useFulfilmentStore.getState();
    state.setTableNumber('14');
    state.setScheduledFor('2026-10-01T18:30:00.000Z');

    useFulfilmentStore.getState().reset();

    const after = useFulfilmentStore.getState();
    expect(after.tableNumber).toBe('');
    expect(after.scheduledFor).toBeNull();
    expect(after.store).toBeNull();
  });

  /** A different person picking up the phone is not the same thing at all. */
  it('still forgets the address when the person signs out', () => {
    useFulfilmentStore.getState().setAddress(at('a1', 'Home', true));

    useFulfilmentStore.getState().forgetPerson();

    expect(useFulfilmentStore.getState().address).toBeNull();
  });
});
