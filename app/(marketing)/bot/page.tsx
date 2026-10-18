import type { Metadata } from 'next';

import { variantPaths } from '@/features/audit/sample';
import BotContact from '@/features/crawl/components/bot-contact';
import {
    botSecretHeader,
    phoneHeaders,
    userAgent,
} from '@/features/crawl/fetch';

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
                    Either the owner of the site connected it to Citequill, or a
                    site connected to Citequill links to yours. CitequillBot
                    reads a site only when its owner asks Citequill to, for
                    example when they connect the site or run an audit. It never
                    reads a site on a schedule or at random.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    Why it visited a site nobody connected
                </h2>
                <p>
                    A site connected to Citequill links to yours. Its audit
                    checks that each link still works, so CitequillBot asks your
                    server about every URL on your host that the site links to
                    or loads, such as a page or an image.
                </p>
                <p>
                    It sends one HEAD request for each URL, following a redirect
                    when there is one, and a GET only when your server answers
                    HEAD with 405 or 501. A request that gets no answer is sent
                    once more. It sends at most 2 requests a second to your
                    host, without any secret, and reads no robots.txt on your
                    host.
                </p>
                <p>
                    When your server answers 403 or 429 to its user agent, the
                    audit sends your host no more requests until it ends. A{' '}
                    <code>CitequillBot</code> group in your robots.txt does not
                    stop these requests, so a 403 to its user agent is the way
                    to refuse them.
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
                    In an audit of your site, CitequillBot follows robots.txt as
                    Googlebot does. It applies the <code>Googlebot</code> group,
                    or the <code>*</code> group when there is none. When the
                    owner connects the site, it applies the{' '}
                    <code>CitequillBot</code> group, or the <code>*</code> group
                    when there is none.
                </p>
                <p>
                    A <code>CitequillBot</code> group in your robots.txt always
                    applies, in an audit of your site too.
                </p>
                <p>
                    In an audit of your site, CitequillBot asks for the home
                    page of each language and up to {variantPaths} other pages
                    twice more: once as itself, and once with the user agent of
                    a phone browser with its own name appended and the header{' '}
                    <code>
                        sec-ch-ua-mobile: {phoneHeaders['sec-ch-ua-mobile']}
                    </code>
                    . A site that serves a phone template is checked as a phone
                    sees it.
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
                    An audit of your site then reads only robots.txt and the
                    sitemaps. When the owner connects the site, CitequillBot
                    still reads the home page, robots.txt, llms.txt and the
                    sitemaps.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    How to let it through bot protection
                </h2>
                <p>
                    Every request of an audit of your site carries the header{' '}
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
