import { RequestWizard } from '@/components/booking/RequestWizard';
import { isIsoDate } from '@/lib/booking/dates';
import { pageMetadata } from '@/lib/seo';
import styles from '../book.module.css';

export const metadata = pageMetadata({
  title: 'Booking request',
  description: 'Request Zakes Bantwini for your event: date, event details, location and travel, then review and send.',
  path: '/book/request',
  image: 'IMG_6873',
});

/** Booking pages prioritise speed over animation (brief §03): no hero image, no motion. */
export default async function BookingRequestPage(props: PageProps<'/book/request'>) {
  const { date } = await props.searchParams;
  const initialDate = typeof date === 'string' && isIsoDate(date) ? date : undefined;

  return (
    <div className={`container ${styles.requestPage}`}>
      <header className={styles.requestHead}>
        <p className="eyebrow eyebrow-accent">Book Zakes</p>
        <h1 className="display display-m">Booking request</h1>
        <p className="lede">Five short steps. You will receive a reference immediately and a formal quote after management review.</p>
      </header>
      <RequestWizard initialDate={initialDate} />
    </div>
  );
}
