import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Section } from '@/components/ui/Section';
import { official } from '@/content/site';
import { MEMBER_PORTAL_URL } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Member login',
  description: 'Access your courses and community on the official member platform.',
  path: '/login',
});

/**
 * A handoff, never a login form: this site holds no credentials (brief §7,
 * Member portal). Members go to the real platform.
 */
export default function LoginPage() {
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Members"
        title="Member login"
        intro={
          <p>
            Courses, replays and community access live on the official member platform. This site
            never asks for your password.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Member login', path: '/login' },
        ]}
        actions={
          MEMBER_PORTAL_URL ? (
            <OutboundLink
              href={MEMBER_PORTAL_URL}
              campaign="member-login"
              variant="primary"
              size="lg"
            >
              Go to the member platform
            </OutboundLink>
          ) : (
            <OutboundLink href={official.home} campaign="member-login" variant="primary" size="lg">
              Go to the official site
            </OutboundLink>
          )
        }
      />
      <Section tone="charcoal" className="!py-16" labelledBy="help-title">
        <div className="container-site max-w-3xl">
          <h2 id="help-title" className="type-display-sm">
            Trouble getting in?
          </h2>
          <p className="mt-3 text-ivory/72">
            Use the email address you enrolled with. If you still cannot get access,{' '}
            <Link href="/contact?topic=support" className="underline hover:text-ivory">
              contact customer support
            </Link>{' '}
            with your order reference.
          </p>
        </div>
      </Section>
    </>
  );
}
