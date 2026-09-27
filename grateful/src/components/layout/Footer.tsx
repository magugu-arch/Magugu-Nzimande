import { Link } from 'react-router';
import { nav, site } from '../../data/site';
import { NewsletterForm } from '../forms/NewsletterForm';
import { Logo } from '../ui/Logo';

export function Footer() {
  const socials = Object.entries(site.social).filter((e): e is [string, string] => typeof e[1] === 'string');
  return (
    <footer className="page-gutter border-t border-line pt-20 pb-32 lg:pb-12">
      <div className="editorial-grid gap-y-14">
        <div className="col-span-4 md:col-span-8 lg:col-span-5">
          <p className="editorial-title text-5xl sm:text-6xl">
            Be bold.
            <br />
            Be you.
            <br />
            <span className="editorial-italic">Be different.</span>
          </p>
        </div>

        <div className="col-span-4 md:col-span-4 lg:col-span-3 lg:col-start-7">
          <p className="ui-label mb-5 opacity-60">Studio</p>
          <address className="space-y-1 not-italic">
            <p className="font-serif text-lg">{site.designer}</p>
            <p className="font-serif italic opacity-70">{site.designerRole}</p>
            <p className="pt-3">
              <a href={site.phoneHref} className="inline-flex min-h-11 items-center hover:underline">
                {site.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center break-all hover:underline">
                {site.email}
              </a>
            </p>
            <p className="opacity-70">{site.location}</p>
          </address>
        </div>

        <div className="col-span-4 md:col-span-4 lg:col-span-3 lg:col-start-10">
          <NewsletterForm />
        </div>
      </div>

      <div className="mt-20 flex flex-col gap-8 border-t border-line pt-8 lg:flex-row lg:items-center lg:justify-between">
        <Logo className="h-8 w-auto self-start" />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {nav.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="ui-label inline-flex min-h-11 items-center opacity-70 hover:opacity-100">
                  {item.label}
                </Link>
              </li>
            ))}
            {socials.map(([name, href]) => (
              <li key={name}>
                <a href={href} rel="noopener noreferrer" target="_blank" className="ui-label inline-flex min-h-11 items-center capitalize opacity-70 hover:opacity-100">
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link to="/privacy" className="ui-label inline-flex min-h-11 items-center opacity-60 hover:opacity-100">
          Privacy
        </Link>
        <p className="ui-label opacity-50">
          © {new Date().getFullYear()} {site.legalName}
        </p>
      </div>
    </footer>
  );
}
