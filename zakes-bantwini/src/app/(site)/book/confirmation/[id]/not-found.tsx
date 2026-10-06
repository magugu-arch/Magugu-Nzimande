import { ButtonLink } from '@/components/ui/Button';
import styles from '@/components/booking/Portal.module.css';

export default function BookingNotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="eyebrow eyebrow-accent">My booking</p>
        <h1 className="display display-m">This link does not open a booking</h1>
        <p className="lede">Booking links are long and private. Check that the whole link was copied from the email we sent, or contact the booking team with your ZB reference.</p>
        <ButtonLink href="/book" variant="outline">
          Booking home
        </ButtonLink>
      </header>
    </div>
  );
}
