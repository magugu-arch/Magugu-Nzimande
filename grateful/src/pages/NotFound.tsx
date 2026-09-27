import { ButtonLink } from '../components/ui/Button';
import { useTitle } from '../lib/useTitle';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <section className="page-gutter flex min-h-[80svh] flex-col justify-end pt-32 pb-24">
      <p className="ui-label mb-8 opacity-60">(404)</p>
      <h1 className="editorial-title text-[3.4rem] sm:text-7xl lg:text-[8rem]">
        This page
        <br />
        <span className="editorial-italic">is not here.</span>
      </h1>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/">Back to home</ButtonLink>
        <ButtonLink to="/work" variant="secondary">
          Explore the Work
        </ButtonLink>
      </div>
    </section>
  );
}
