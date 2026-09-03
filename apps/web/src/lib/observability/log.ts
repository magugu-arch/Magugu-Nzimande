/**
 * Structured logging.
 *
 * One line of JSON per event, because the thing that reads these in production
 * is a log aggregator and not a person: a message built by string concatenation
 * cannot be filtered, counted or alerted on without somebody writing a regular
 * expression against prose that will change.
 *
 * The part that matters here is not the format. It is that this is the layer
 * everything logs through, so redaction happens once. A log line is the most
 * common way a secret escapes a system — nobody means to print a session
 * cookie, they print the request that happened to carry one.
 */

export type Level = 'debug' | 'info' | 'warn' | 'error';

export type Fields = Record<string, unknown>;

/**
 * Field names whose values never appear in a log, whatever they hold.
 *
 * Matched on the name rather than the value, because a value-based check is a
 * guess: a session token and an order id are both opaque strings of about the
 * same length, and a redactor that decides by shape will either leak one or
 * ruin the other.
 */
const SECRET = /pass(word|phrase)?|secret|token|cookie|authorization|signature|hash/i;

/**
 * Keys whose values are personal rather than secret.
 *
 * Kept, but reduced to something that identifies a record without carrying the
 * person: an email becomes its domain, a mobile its last two digits. Enough to
 * tell two customers apart in a trace, not enough to be a copy of the customer
 * list sitting in a log aggregator that POPIA has never been told about.
 */
const PERSONAL = /^(email|mobile|phone|name|address)$/i;

export function redact(fields: Fields): Fields {
  const clean: Fields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (SECRET.test(key)) {
      clean[key] = '[redacted]';
      continue;
    }

    if (PERSONAL.test(key) && typeof value === 'string') {
      clean[key] = reduce(key, value);
      continue;
    }

    // Nested objects are walked, because the thing most likely to carry a
    // secret is a whole request or customer object logged in one go.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = redact(value as Fields);
      continue;
    }

    clean[key] = value;
  }

  return clean;
}

function reduce(key: string, value: string): string {
  if (/^email$/i.test(key)) {
    const at = value.lastIndexOf('@');
    return at === -1 ? '[redacted]' : `…@${value.slice(at + 1)}`;
  }
  if (/^(mobile|phone)$/i.test(key)) {
    return value.length <= 2 ? '[redacted]' : `…${value.slice(-2)}`;
  }
  return '[redacted]';
}

/** Where a line goes. Replaceable so a test can read what was written. */
export type Sink = (line: string) => void;

let sink: Sink = (line) => {
  // stdout, because that is where a container runtime collects logs from.
  process.stdout.write(line + '\n');
};

export function setSink(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

export function log(level: Level, event: string, fields: Fields = {}): void {
  sink(
    JSON.stringify({
      at: new Date().toISOString(),
      level,
      event,
      ...redact(fields),
    }),
  );
}

export const logger = {
  debug: (event: string, fields?: Fields) => log('debug', event, fields),
  info: (event: string, fields?: Fields) => log('info', event, fields),
  warn: (event: string, fields?: Fields) => log('warn', event, fields),
  error: (event: string, fields?: Fields) => log('error', event, fields),
};

/**
 * An error, flattened enough to be useful and not so much that it is a novel.
 *
 * The stack is kept — a production error without one costs an afternoon — but
 * the cause chain is not walked, because a cause is frequently the thing
 * carrying the connection string.
 */
export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack?.split('\n').slice(0, 5).join('\n') };
  }
  return { error: String(error) };
}
