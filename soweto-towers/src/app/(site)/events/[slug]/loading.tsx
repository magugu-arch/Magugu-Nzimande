import styles from '../page.module.css';

/** Shown the instant an event is tapped, while the page streams in. */
export default function LoadingEvent() {
  return (
    <div className="container" role="status" aria-busy="true" aria-label="Loading event">
      <div className={`${styles.hero} skeleton skeleton--dark`}>
        <div className={`glass-dark ${styles.heroPanel}`} style={{ width: 'min(100%, 560px)' }}>
          <span className="skeleton skeleton--dark skeleton--text" style={{ width: 120 }} />
          <span className="skeleton skeleton--dark" style={{ height: 'clamp(40px, 6vw, 72px)', width: '90%' }} />
          <span className="skeleton skeleton--dark skeleton--text" style={{ width: '60%', height: 32, borderRadius: 999 }} />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.text}>
          <span className="skeleton skeleton--text" style={{ width: '92%', height: 22 }} />
          <span className="skeleton skeleton--text" style={{ width: '100%' }} />
          <span className="skeleton skeleton--text" style={{ width: '96%' }} />
          <span className="skeleton skeleton--text" style={{ width: '70%' }} />
        </div>
        <div className={`card ${styles.ticketCard}`}>
          <span className="skeleton skeleton--text" style={{ width: 80 }} />
          <span className="skeleton" style={{ height: 36, width: '60%' }} />
          <span className="skeleton" style={{ height: 48 }} />
          <span className="skeleton" style={{ height: 48 }} />
          <span className="skeleton" style={{ height: 52, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
