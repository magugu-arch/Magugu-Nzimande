import { Header, Screen, StateView } from '@/design';

/**
 * Digital student ID (brief §15). The capability is in PENDING_APPROVAL, so
 * RouteGuard normally answers before this renders; the state below is the
 * same message, kept here so the screen is never blank.
 */
export default function DigitalId() {
  return (
    <Screen header={<Header title="Digital ID" fallbackHref="/profile" />}>
      <StateView
        kind="unavailable"
        title="Digital ID is coming"
        body="A digital student ID, library card and campus access pass are designed into NMU ONE. They switch on once NMU approves them and connects the systems behind them."
      />
    </Screen>
  );
}
