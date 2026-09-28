import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { InlineNotice, PremiumButton } from '@/components/ui';
import { formatRand } from '@/domain/shared/format';
import { config } from '@/services/config';
import { useRpc } from '@/services/queries';

/**
 * §20: a payment waiting on the guest. With a hosted gateway (PayFast) the
 * guest pays on the gateway's page; this opens it, and keeps checking until
 * the gateway's notification settles the payment on the server. The in-app
 * mock settles payments itself, so there is nothing to show there.
 */
export function CompletePayment({
  purpose,
  referenceId,
  autoOpen,
  refresh,
}: {
  purpose: 'voucher' | 'event' | 'deposit';
  referenceId: string;
  autoOpen?: boolean;
  /** Query keys to refresh once the payment settles. */
  refresh?: string[];
}) {
  const client = useQueryClient();
  const live = !config.useMockApi;
  const q = useRpc(
    'payments.checkout',
    { purpose, referenceId },
    {
      enabled: live,
      refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    },
  );
  const opened = useRef(false);
  const url = q.data?.checkoutUrl;

  useEffect(() => {
    if (autoOpen && url && !opened.current) {
      opened.current = true;
      void Linking.openURL(url);
    }
  }, [autoOpen, url]);

  const status = q.data?.status;
  useEffect(() => {
    if (status && status !== 'pending')
      for (const key of refresh ?? []) void client.invalidateQueries({ queryKey: [key] });
  }, [status, refresh, client]);

  if (!live || !q.data || q.data.status !== 'pending' || !url) return null;
  return (
    <>
      <PremiumButton
        label={`Pay ${formatRand(q.data.amountCents)} securely`}
        icon="lock"
        onPress={() => void Linking.openURL(url)}
      />
      <InlineNotice tone="info">
        You pay on PayFast’s secure page. This screen updates by itself once the payment is
        confirmed.
      </InlineNotice>
    </>
  );
}
