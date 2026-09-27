import type { ApiError, CheckoutForm, CreateBookingResult, PublicBooking, Service } from '../../shared/types';

/** Thrown for any non-2xx response, carrying the server's message and field errors. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new RequestError('We could not reach the studio. Check your connection and try again.', 0);
  }
  const body = (await res.json().catch(() => ({}))) as T & Partial<ApiError>;
  if (!res.ok) throw new RequestError(body.error ?? 'Something went wrong. Please try again.', res.status, body.fields);
  return body;
}

const post = <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });

export const api = {
  services: () => request<{ services: Service[] }>('/api/services').then((r) => r.services),
  availableDates: (serviceId: string, month: string) =>
    request<{ dates: string[] }>(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&month=${month}`).then((r) => r.dates),
  slots: (serviceId: string, date: string) =>
    request<{ slots: string[] }>(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}`).then((r) => r.slots),
  createBooking: (data: unknown) => post<CreateBookingResult>('/api/booking', data),
  booking: (id: string) => request<{ booking: PublicBooking }>(`/api/booking/${encodeURIComponent(id)}`).then((r) => r.booking),
  startPayment: (data: unknown) => post<{ checkout: CheckoutForm }>('/api/payment', data).then((r) => r.checkout),
  contact: (data: unknown) => post<{ ok: true }>('/api/contact', data),
  newsletter: (data: unknown) => post<{ ok: true }>('/api/newsletter', data),
  unsubscribe: (data: { email: string; token: string }) => post<{ ok: true }>('/api/newsletter/unsubscribe', data),
};

/** Send the browser to a hosted checkout by building and submitting its form. */
export function submitCheckout(checkout: CheckoutForm) {
  if (checkout.method === 'GET') {
    const url = new URL(checkout.action, window.location.origin);
    for (const [k, v] of Object.entries(checkout.fields)) url.searchParams.set(k, v);
    window.location.assign(url.toString());
    return;
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.action;
  for (const [k, v] of Object.entries(checkout.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
