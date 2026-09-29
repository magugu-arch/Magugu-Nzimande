import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeSlotGrid, AvailabilityChip } from '@/components/mabu/TimeSlotGrid';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { Chip, Stepper } from '@/components/ui/Controls';
import { Photo } from '@/components/ui/Photo';
import { BookingDatePicker } from '@/components/mabu/BookingDatePicker';
import type { ReservationSlot } from '@/domain/reservations/types';

const slot = (time: string, available: boolean): ReservationSlot => ({
  slotId: `mabu-waterfall|2026-10-06|${time}`,
  startsAt: `2026-10-06T${time}:00+02:00`,
  available,
  provider: 'mabu-direct',
  servicePeriod: time < '16:00' ? 'lunch' : 'dinner',
});

describe('TimeSlotGrid', () => {
  it('groups by service, names each time, and will not select an unavailable one', () => {
    const onSelect = jest.fn();
    render(
      <TimeSlotGrid
        slots={[slot('12:00', true), slot('19:00', false), slot('19:30', true)]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    // Queried by accessible state, as assistive tech sees it.
    const full = screen.getByRole('button', { name: '19:00, unavailable', disabled: true });
    fireEvent.press(full);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: '19:30', disabled: false }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'mabu-waterfall|2026-10-06|19:30' }),
    );
  });
});

describe('PremiumButton', () => {
  it('announces busy and ignores presses while loading', () => {
    const onPress = jest.fn();
    render(<PremiumButton label="Confirm booking" loading onPress={onPress} />);
    const button = screen.getByRole('button', {
      name: 'Confirm booking',
      busy: true,
      disabled: true,
    });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Stepper', () => {
  it('is adjustable by assistive tech and respects its bounds', () => {
    const onChange = jest.fn();
    render(<Stepper label="Guests" value={10} min={1} max={10} onChange={onChange} />);
    const stepper = screen.getByLabelText('Guests');
    expect(stepper.props.accessibilityValue).toMatchObject({ min: 1, max: 10, now: 10 });
    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenCalledWith(9);
  });
});

describe('BookingDatePicker', () => {
  it('reads each day aloud with its state, and disables closed days', () => {
    const onSelect = jest.fn();
    render(
      <BookingDatePicker
        today="2026-10-01"
        maxDate="2026-12-30"
        selected={null}
        states={{ '2026-10-05': 'closed', '2026-10-02': 'full', '2026-10-06': 'available' }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByLabelText('Friday 2 October, fully booked, waitlist open')).toBeTruthy();
    const closed = screen.getByLabelText('Monday 5 October, closed');
    fireEvent.press(closed);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Tuesday 6 October, tables available'));
    expect(onSelect).toHaveBeenCalledWith('2026-10-06');
  });
});

describe('Photo', () => {
  it('announces a photograph once, and a decorative texture not at all', () => {
    const { rerender, UNSAFE_root } = render(
      <Photo photo="hero-signature" label="A fillet on a black stone plate" />,
    );
    expect(screen.getByLabelText('A fillet on a black stone plate')).toBeTruthy();
    // The image inside the frame must not announce itself as well.
    expect(screen.getAllByLabelText('A fillet on a black stone plate')).toHaveLength(1);
    rerender(<Photo photo="texture-marble" label="" />);
    expect(UNSAFE_root.findAllByProps({ 'aria-hidden': true }).length).toBeGreaterThan(0);
  });
});

describe('Chip', () => {
  it('is a toggle button, not a selected tab', () => {
    render(<Chip label="Vegetarian" selected onPress={() => undefined} />);
    const chip = screen.getByLabelText('Vegetarian');
    expect(chip.props['aria-pressed']).toBe(true);
    expect(chip.props['aria-selected']).toBeUndefined();
  });
});

describe('AvailabilityChip', () => {
  it('says the state in words, never colour alone', () => {
    render(<AvailabilityChip state="waitlist" />);
    expect(screen.getByLabelText('Waitlist open')).toBeTruthy();
  });
});
