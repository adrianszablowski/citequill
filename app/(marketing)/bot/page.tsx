import type { Metadata } from 'next';

import BotContact from '@/features/crawl/components/bot-contact';
import { botSecretHeader, userAgent } from '@/features/crawl/fetch';

export const metadata: Metadata = {
    title: 'CitequillBot',
    description:
        'What CitequillBot reads on a site, how to block it and how to let it through a firewall.',
};

export default function BotPage() {
    return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-12 text-base/7">
            <header className="flex flex-col gap-3">
                <h1 className="text-3xl font-semibold">CitequillBot</h1>
                <p>
                    CitequillBot reads sites for Citequill, a hosted SEO and GEO
                    autopilot. Its user agent is <code>{userAgent}</code>.
                </p>
            </header>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    Why it visited your site
                </h2>
                <p>
                    The owner of the site connected it to Citequill.
                    CitequillBot reads a site only when its owner asks Citequill
                    to, for example when they connect the site or run an audit.
                    It never reads a site on a schedule or at random.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">What it reads</h2>
                <p>
                    CitequillBot reads HTML pages, robots.txt and sitemaps. When
                    the owner connects the site, it also reads llms.txt and
                    keeps the text of up to 50 pages, so Citequill learns what
                    the site offers.
                </p>
                <p>
                    An audit keeps only what its report needs: the status of
                    each page, the headers and tags it checks, and the short
                    pieces of HTML a finding points at. It keeps no copy of a
                    page.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">How it behaves</h2>
                <p>
                    In an audit, CitequillBot follows robots.txt as Googlebot
                    does. It applies the <code>Googlebot</code> group, or the{' '}
                    <code>*</code> group when there is none. When the owner
                    connects the site, it applies the <code>CitequillBot</code>{' '}
                    group, or the <code>*</code> group when there is none.
                </p>
                <p>
                    A <code>CitequillBot</code> group in your robots.txt always
                    applies, in an audit too.
                </p>
                <p>
                    When your server answers 429 or 503, the audit waits and
                    slows down. When your server keeps failing, the audit stops.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">How to block it</h2>
                <p>Add this group to your robots.txt:</p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{blockRule}</code>
                </pre>
                <p>
                    An audit then reads only robots.txt and the sitemaps. When
                    the owner connects the site, CitequillBot still reads the
                    home page, robots.txt, llms.txt and the sitemaps.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    How to let it through bot protection
                </h2>
                <p>
                    Every audit request to your site carries the header{' '}
                    <code>{botSecretHeader}</code>. Its value is a secret the
                    owner of the site finds in Citequill, under Settings.
                </p>
                <p>
                    To let the audit through, add a rule that matches the header
                    with that value: a skip rule in Cloudflare&apos;s WAF, or a
                    bypass rule in Vercel&apos;s firewall.
                </p>
                <p>
                    On Cloudflare&apos;s Free plan, no rule skips Bot Fight
                    Mode, and in Vercel no rule bypasses Attack Mode. Turn them
                    off for the audit.
                </p>
                <p>
                    When the owner connects the site, CitequillBot sends no
                    secret.
                </p>
            </section>
            <BotContact email={process.env.CONTACT_EMAIL} />
        </main>
    );
}

const blockRule = 'User-agent: CitequillBot\nDisallow: /';
