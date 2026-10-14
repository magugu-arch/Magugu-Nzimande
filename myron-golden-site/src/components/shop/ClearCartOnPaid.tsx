'use client';

import { useEffect } from 'react';
import { cart } from './cart-store';

/** Once Stripe confirms an order is paid, the cart that made it is done with. */
export function ClearCartOnPaid() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}
