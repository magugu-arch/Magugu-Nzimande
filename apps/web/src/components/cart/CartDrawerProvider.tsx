'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type CartDrawerValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartDrawerContext = createContext<CartDrawerValue | null>(null);

export function useCartDrawer(): CartDrawerValue {
  const value = useContext(CartDrawerContext);
  if (!value) throw new Error('useCartDrawer must be used inside CartDrawerProvider');
  return value;
}

/**
 * The drawer's open state lives above both the header that opens it and the
 * drawer itself, so neither has to know about the other.
 */
export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}
