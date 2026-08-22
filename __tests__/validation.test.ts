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
    const errors = validateFields(
      { email: 'thandi@example.co.za' },
      { email: validateEmail },
    );
    expect(errors).toEqual({});
  });

  it('treats a missing value as an empty string', () => {
    const errors = validateFields({} as Record<'email', string>, { email: validateEmail });
    expect(errors.email).toBe('Email address is required');
  });
});
