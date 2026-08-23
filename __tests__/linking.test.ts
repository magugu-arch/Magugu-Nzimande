import { Alert, Linking, Platform } from 'react-native';
import { callNumber, directionsUrl, isDiallable, openExternal, telUrl } from '@/utils/linking';

describe('telUrl', () => {
  /**
   * The bug this closes: the order screen dialled
   * `tel:bb.q Chicken Rosebank`. The number was never on the order — only the
   * name was — and interpolating it at the call site hid that.
   */
  it('strips the spaces South African numbers are written with', () => {
    expect(telUrl('011 883 0100')).toBe('tel:0118830100');
  });

  it('keeps a leading plus, because international numbers need it', () => {
    expect(telUrl('+27 11 883 0100')).toBe('tel:+27118830100');
  });

  it('drops the brackets and dashes people paste in', () => {
    expect(telUrl('(011) 883-0100')).toBe('tel:0118830100');
  });

  it('produces digits and nothing else', () => {
    // The property that actually matters: whatever went in, what comes out is
    // something a dialler will accept.
    expect(telUrl(' 021 418 9900 ')).toMatch(/^tel:\+?\d+$/);
  });
});

describe('isDiallable', () => {
  it('accepts a real number', () => {
    expect(isDiallable('011 447 2200')).toBe(true);
  });

  it.each([
    ['a store name', 'bb.q Chicken Rosebank'],
    ['an empty string', ''],
    ['too few digits', '0114'],
    ['nothing at all', undefined],
  ])('refuses %s', (_label, value) => {
    expect(isDiallable(value)).toBe(false);
  });
});

describe('directionsUrl', () => {
  const target = { latitude: -26.1465, longitude: 28.0436, label: 'bb.q Chicken Rosebank' };

  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('sends iOS to Apple Maps with the destination and a driving flag', () => {
    Platform.OS = 'ios';
    const url = directionsUrl(target);

    expect(url).toContain('maps.apple.com');
    expect(url).toContain('daddr=-26.1465,28.0436');
    expect(url).toContain('dirflg=d');
  });

  it('sends Android to a geo: link so the customer keeps their maps app', () => {
    Platform.OS = 'android';
    expect(directionsUrl(target)).toBe(
      'geo:-26.1465,28.0436?q=-26.1465,28.0436(bb.q%20Chicken%20Rosebank)',
    );
  });

  it('escapes the store name, which contains spaces and a full stop', () => {
    Platform.OS = 'ios';
    // An unescaped space truncates the query at the first word on some
    // handlers, which would open a pin labelled "bb.q".
    expect(directionsUrl(target)).not.toMatch(/q=[^&]*\s/);
  });

  it('falls back to a web maps link off-device', () => {
    Platform.OS = 'web';
    expect(directionsUrl(target)).toContain('google.com/maps/dir/');
  });
});

describe('openExternal', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the URL and reports success', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await expect(openExternal('tel:0118830100')).resolves.toBe(true);
    expect(openURL).toHaveBeenCalledWith('tel:0118830100');
    expect(alert).not.toHaveBeenCalled();
  });

  /**
   * Every one of these handoffs used to be `void Linking.openURL(...)`. On a
   * device with no dialler that rejects, the `void` swallows it, and the tap
   * does nothing with no explanation.
   */
  it('says something when the handoff fails instead of failing silently', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await expect(openExternal('tel:0118830100')).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('puts the number in the failure message, so the call is still possible', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await callNumber('011 883 0100');

    const [, message] = alert.mock.calls[0] as [string, string];
    expect(message).toContain('011 883 0100');
  });

  it('never rejects, so no caller needs a catch of its own', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // `void openExternal(...)` is the call shape used throughout the app; an
    // unhandled rejection there is a red box in development.
    await expect(openExternal('mailto:hello@example.com')).resolves.toBe(false);
  });
});
