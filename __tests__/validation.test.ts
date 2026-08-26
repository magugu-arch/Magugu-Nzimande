import {
  minLength,
  required,
  toE164,
  validateEmail,
  validateFields,
  validateOtp,
  validatePassword,
  validatePhone,
  validatePostalCode,
} from '@/utils/validation';

describe('validateEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(validateEmail('thandi@example.co.za')).toBeNull();
    expect(validateEmail('  thandi@example.com  ')).toBeNull();
  });

  it('rejects malformed addresses', () => {
    expect(validateEmail('')).toBe('Email address is required');
    expect(validateEmail('thandi@')).not.toBeNull();
    expect(validateEmail('thandi.example.com')).not.toBeNull();
    expect(validateEmail('thandi@example')).not.toBeNull();
  });
});

describe('validatePhone', () => {
  it('accepts South African mobile numbers in both formats', () => {
    expect(validatePhone('0821234567')).toBeNull();
    expect(validatePhone('+27821234567')).toBeNull();
    expect(validatePhone('082 123 4567')).toBeNull();
    expect(validatePhone('082-123-4567')).toBeNull();
  });

  it('rejects landlines and malformed numbers', () => {
    expect(validatePhone('')).toBe('Mobile number is required');
    expect(validatePhone('0111234567')).not.toBeNull();
    expect(validatePhone('082123456')).not.toBeNull();
    expect(validatePhone('+1234567890')).not.toBeNull();
  });
});

describe('toE164', () => {
  it('normalises local numbers to +27', () => {
    expect(toE164('0821234567')).toBe('+27821234567');
    expect(toE164('082 123 4567')).toBe('+27821234567');
  });

  it('leaves an already-normalised number alone', () => {
    expect(toE164('+27821234567')).toBe('+27821234567');
  });
});

describe('validatePassword', () => {
  it('requires eight characters with a letter and a digit', () => {
    expect(validatePassword('Crispy123')).toBeNull();
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('short1')).not.toBeNull();
    expect(validatePassword('allletters')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
  });
});

describe('validatePostalCode', () => {
  it('requires exactly four digits', () => {
    expect(validatePostalCode('2196')).toBeNull();
    expect(validatePostalCode('219')).not.toBeNull();
    expect(validatePostalCode('21966')).not.toBeNull();
    expect(validatePostalCode('abcd')).not.toBeNull();
  });
});

describe('validateOtp', () => {
  it('requires exactly four digits', () => {
    expect(validateOtp('1234')).toBeNull();
    expect(validateOtp('123')).not.toBeNull();
    expect(validateOtp('12a4')).not.toBeNull();
  });
});

describe('required and minLength', () => {
  it('reports the field label in the message', () => {
    expect(required('Last name')('')).toBe('Last name is required');
    expect(required('Last name')('   ')).toBe('Last name is required');
    expect(required('Last name')('Mokoena')).toBeNull();
    expect(minLength('First name', 2)('T')).toBe('First name must be at least 2 characters');
  });
});

describe('validateFields', () => {
  it('returns only the failing fields', () => {
    const errors = validateFields(
      { email: 'bad', password: 'Crispy123' },
      { email: validateEmail, password: validatePassword },
    );
    expect(Object.keys(errors)).toEqual(['email']);
  });

  it('returns an empty object when everything passes', () => {
    const errors = validateFields({ email: 'thandi@example.co.za' }, { email: validateEmail });
    expect(errors).toEqual({});
  });

  it('treats a missing value as an empty string', () => {
    const errors = validateFields({} as Record<'email', string>, { email: validateEmail });
    expect(errors.email).toBe('Email address is required');
  });
});

/**
 * The phone rule was written twice — a regex that tested a number and a
 * normaliser that rewrote it — and they disagreed about which spellings count.
 * Both stripped spaces and hyphens and nothing else, so forms people write
 * every day were refused, and normalised into nonsense on the way out:
 *
 *     "(082) 123 4567"       rejected, and normalised to +27(082)1234567
 *     "+27 (0)82 123 4567"   rejected, and normalised to +27(0)821234567
 *     "27821234567"          rejected, and normalised to +2727821234567
 *
 * The last is two country codes: the normaliser could not tell a national
 * number from an international one, so it guessed and prefixed anyway.
 * `verify.tsx` prints the result under "We sent a code to…", so that is a
 * number shown to a customer that nobody dialled.
 */
describe('the ways a South African writes their mobile number', () => {
  const NINE = '821234567';

  it.each([
    '0821234567',
    '082 123 4567',
    '082-123-4567',
    '(082) 123 4567',
    '082 123 4567 ',
    '+27821234567',
    '+27 82 123 4567',
    '+27 (0)82 123 4567',
    '27821234567',
    '821234567',
  ])('accepts %s and normalises it to one number', (typed) => {
    expect(validatePhone(typed)).toBeNull();
    expect(toE164(typed)).toBe(`+27${NINE}`);
  });

  it.each(['071 123 4567', '060 123 4567', '083 123 4567'])(
    'accepts the %s prefix range',
    (typed) => {
      expect(validatePhone(typed)).toBeNull();
    },
  );
});

describe('what is not a South African mobile number', () => {
  it.each([
    ['011 883 0100', 'a Johannesburg landline'],
    ['+27118830100', 'the same landline in international form'],
    ['+1 555 123 4567', 'another country'],
    ['+27 82 123 456', 'a digit short'],
    ['+27 82 123 45678', 'a digit long'],
    ['not a number', 'words'],
  ])('refuses %s — %s', (typed) => {
    expect(validatePhone(typed)).toBe('Enter a valid South African mobile number');
  });

  it('hands back what it was given rather than inventing a country code', () => {
    // Shown to the customer on the verify screen. A number nobody dialled is
    // worse than the one they typed.
    expect(toE164('011 883 0100')).toBe('011 883 0100');
  });

  it('still asks for one when the field is empty', () => {
    expect(validatePhone('')).toBe('Mobile number is required');
    expect(validatePhone('   ')).toBe('Mobile number is required');
  });
});

describe('an email address with a trailing dot', () => {
  it('is refused, because the verification mail would go nowhere', () => {
    // Registration creates every customer unverified, so a mail that never
    // arrives leaves a badge that can never clear.
    expect(validateEmail('thandi@example.co.za.')).toBe('Enter a valid email address');
  });

  it.each([
    'thandi@example.co.za',
    'thandi.mokoena+orders@example.co.za',
    'THANDI@EXAMPLE.CO.ZA',
    ' thandi@example.co.za ',
  ])('still accepts %s', (typed) => {
    expect(validateEmail(typed)).toBeNull();
  });
});
