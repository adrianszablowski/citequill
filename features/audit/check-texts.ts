import {
    type Area,
    type CheckId,
    checkOf,
    type Severity,
} from '@/features/audit/catalogue';

export interface CheckText {
    name: string;
    says: string;
    link: string;
    fix: string;
}

export const severityNames: Record<Severity, string> = {
    '3': 'Critical',
    '2': 'Major',
    '1': 'Minor',
    hint: 'Hint',
    question: 'Question',
};

export const areaNames: Record<Area, string> = {
    indexability: 'Indexability',
    'on-page': 'On-page',
    links: 'Links',
    https: 'HTTPS',
    mobile: 'Mobile',
    performance: 'Performance',
    'ai-access': 'AI access',
};

export const notCounted = 'Google does not count this.';

export function checkText(id: CheckId) {
    const text = texts[id];

    if (!text) {
        return null;
    }

    return checkOf(id).severity === 'hint'
        ? { ...text, says: `${text.says} ${notCounted}` }
        : text;
}

const google = 'https://developers.google.com';

const links = {
    robotsIntro: `${google}/search/docs/crawling-indexing/robots/intro`,
    robotsSpec: `${google}/crawling/docs/robots-txt/robots-txt-spec`,
    robotsMeta: `${google}/search/docs/crawling-indexing/robots-meta-tag`,
    noindex: `${google}/search/docs/crawling-indexing/block-indexing`,
    statusCodes: `${google}/crawling/docs/troubleshooting/http-status-codes`,
    redirects: `${google}/search/docs/crawling-indexing/301-redirects`,
    crawlBudget: `${google}/crawling/docs/crawl-budget`,
    googlebot: `${google}/search/docs/crawling-indexing/googlebot`,
    canonical: `${google}/search/docs/crawling-indexing/canonicalization`,
    canonicalHowTo: `${google}/search/docs/crawling-indexing/consolidate-duplicate-urls`,
    canonicalFix: `${google}/search/docs/crawling-indexing/canonicalization-troubleshooting`,
    sitemaps: `${google}/search/docs/crawling-indexing/sitemaps/overview`,
    buildSitemap: `${google}/search/docs/crawling-indexing/sitemaps/build-sitemap`,
    largeSitemaps: `${google}/search/docs/crawling-indexing/sitemaps/large-sitemaps`,
    imageSitemaps: `${google}/search/docs/crawling-indexing/sitemaps/image-sitemaps`,
    languages: `${google}/search/docs/specialty/international/managing-multi-regional-sites`,
    spam: `${google}/search/docs/essentials/spam-policies`,
    protocol: 'https://www.sitemaps.org/protocol.html',
};

const texts: Partial<Record<CheckId, CheckText>> = {
    'robots-5xx': {
        name: 'robots.txt answers with a server error',
        says: 'When robots.txt answers with a server error, Google stops crawling the site for 12 hours, then uses its cached copy for 30 days, or crawls freely when it has none.',
        link: links.robotsSpec,
        fix: 'Make /robots.txt answer 200 with your rules, or 404 when you have none. Check the server or CDN rule that answers it with an error.',
    },
    'robots-googlebot-blocked': {
        name: 'robots.txt blocks Google from the home page',
        says: 'Google does not index a page Googlebot cannot reach.',
        link: links.robotsIntro,
        fix: 'Remove the Disallow rule that matches your home page from the Googlebot or * group of robots.txt.',
    },
    'robots-size': {
        name: 'robots.txt is too large or redirects too often',
        says: 'Google reads the first 500 KiB of robots.txt and follows at most 5 redirects to reach it.',
        link: links.robotsSpec,
        fix: 'Keep robots.txt under 500 KiB by merging rules that repeat, and serve it at /robots.txt itself.',
    },
    'robots-unsupported': {
        name: 'robots.txt has lines Google ignores',
        says: 'Google ignores the robots.txt fields it does not list, such as crawl-delay, noindex and host.',
        link: links.robotsSpec,
        fix: 'Remove the crawl-delay, noindex or host lines, or keep them for the crawlers that read them. To keep a page out of Google, give it a noindex meta tag.',
    },
    'robots-4xx': {
        name: 'The site has no robots.txt',
        says: 'When robots.txt answers 4xx, Google crawls the site with no restrictions.',
        link: links.robotsSpec,
        fix: 'Nothing breaks. Add a robots.txt when you want to keep crawlers out of part of the site or name your sitemap.',
    },
    'noindex-site': {
        name: 'The site is kept out of Google',
        says: 'A page must be indexable to appear in Google, and a noindex rule keeps it out.',
        link: links.noindex,
        fix: 'Remove the noindex meta tag or X-Robots-Tag header from your home page and content pages. A staging setting left on after launch is the usual cause.',
    },
    'noindex-content': {
        name: 'A page you want found has noindex',
        says: 'Google keeps a page with noindex out of its results, so remove the rule if the page should appear.',
        link: links.noindex,
        fix: 'Should this page appear in Google? If it should, remove its noindex meta tag or X-Robots-Tag header.',
    },
    'noindex-blocked': {
        name: 'A page with noindex is blocked in robots.txt',
        says: 'Googlebot never sees the noindex of a page robots.txt blocks, so the page can stay indexed.',
        link: links.noindex,
        fix: 'Remove the Disallow rule for this page so Google can read its noindex.',
    },
    'robots-conflict': {
        name: 'The robots meta tag and X-Robots-Tag disagree',
        says: 'When robots rules conflict, Google applies the most restrictive one.',
        link: links.robotsMeta,
        fix: 'Make the robots meta tag and the X-Robots-Tag header say the same thing, or keep only one of them.',
    },
    'robots-invalid': {
        name: 'A robots rule has a value Google cannot read',
        says: 'Google ignores a robots rule whose value it cannot parse, such as max-snippet without a number.',
        link: links.robotsMeta,
        fix: 'Give max-snippet a whole number and unavailable_after a date such as 2027-06-25.',
    },
    'robots-none': {
        name: 'A page uses the none robots rule',
        says: 'Google reads none as noindex, nofollow, and Bing does not list it.',
        link: links.robotsMeta,
        fix: 'Write noindex, nofollow instead of none, so every search engine reads the same rule.',
    },
    'unavailable-after-past': {
        name: 'A page’s unavailable_after date has passed',
        says: 'Google stops showing a page in its results after its unavailable_after date.',
        link: links.robotsMeta,
        fix: 'Remove the unavailable_after rule if the page should stay in Google, or take the page down if its time is over.',
    },
    'html-over-2mb': {
        name: 'The HTML is over 2 MB',
        says: 'Googlebot reads the first 2 MB of an HTML file and ignores the rest.',
        link: links.googlebot,
        fix: 'Make the HTML smaller: move inline scripts, styles and data into files of their own, and split long lists into pages.',
    },
    'page-4xx': {
        name: 'A page answers with a 4xx error',
        says: 'Google treats every 4xx page as gone, so fix the links and sitemap entries that point to it.',
        link: links.statusCodes,
        fix: 'Restore the page, redirect it to its closest replacement with a 301, or remove the links and sitemap entries that point to it.',
    },
    'page-5xx': {
        name: 'A page answers with a server error',
        says: 'Server errors and 429 answers slow Google’s crawling, and a URL that keeps failing is dropped from the index.',
        link: links.statusCodes,
        fix: 'Find in the server’s logs why this URL fails and fix it. A page that times out needs a faster server or a cached copy.',
    },
    'redirect-chain': {
        name: 'A redirect goes through several hops',
        says: 'Google advises against long redirect chains, because each hop slows crawling.',
        link: links.crawlBudget,
        fix: 'Redirect the first URL straight to the final one, and point your links at the final URL.',
    },
    'redirect-chain-long': {
        name: 'A redirect does not end after 10 hops',
        says: 'Googlebot follows up to 10 redirect hops and then gives up.',
        link: links.statusCodes,
        fix: 'Find the hop that sends the URL on and redirect it straight to the final page.',
    },
    'redirect-loop': {
        name: 'A redirect loops back on itself',
        says: 'A URL that comes back in its own redirect chain is a redirect error, so Google never reaches a page.',
        link: links.redirects,
        fix: 'Change the redirect rules so the URL leads to a page that answers 200. Two rules that send a URL back and forth, such as one that adds a trailing slash and one that removes it, are the usual cause.',
    },
    'redirect-to-error': {
        name: 'A redirect ends on an error',
        says: 'A redirect that ends on a 4xx or 5xx page is broken for Google and for readers.',
        link: links.statusCodes,
        fix: 'Point the redirect at a page that answers 200, or let the old URL answer 404 or 410 when nothing replaces it.',
    },
    'redirect-meta': {
        name: 'A page redirects with a meta refresh',
        says: 'Google reads an instant meta refresh as a permanent redirect and a delayed one as temporary.',
        link: links.redirects,
        fix: 'Replace the meta refresh with a 301 redirect on the server when your host lets you.',
    },
    'redirect-slash-or-case': {
        name: 'A redirect only fixes a slash or letter case',
        says: 'Google follows these redirects, and each one is a hop your links could avoid.',
        link: links.redirects,
        fix: 'Link to the URL in its final form, with the trailing slash and the letter case it redirects to.',
    },
    'canonical-missing': {
        name: 'A page names no canonical',
        says: 'A canonical is not required, and without one Google chooses the canonical itself.',
        link: links.canonical,
        fix: 'Add a link rel=canonical with the page’s own full URL if you want to name it yourself.',
    },
    'canonical-outside-head': {
        name: 'The canonical is outside the head',
        says: 'Google accepts a rel=canonical link only in the head of the page.',
        link: links.canonicalHowTo,
        fix: 'Move the link rel=canonical into the head. A script or a stray tag that ends the head early can push it into the body.',
    },
    'canonical-relative': {
        name: 'The canonical is relative or has a fragment',
        says: 'Google asks for a full URL in rel=canonical, never a relative path.',
        link: links.canonicalHowTo,
        fix: 'Write the canonical as a full URL with https and the host, and without a # part.',
    },
    'canonical-conflict': {
        name: 'The page names more than one canonical',
        says: 'Name one canonical by one method, or Google ignores them and chooses for itself.',
        link: links.canonicalHowTo,
        fix: 'Keep one link rel=canonical or one Link header, and make it name the URL you want indexed.',
    },
    'canonical-language': {
        name: 'The canonical points to another language or to HTTP',
        says: 'A canonical should point to a page in the same language, and an HTTP canonical can make Google prefer the HTTP version.',
        link: links.canonicalHowTo,
        fix: 'Point each language version’s canonical at itself, over https, and connect the languages with hreflang.',
    },
    'canonical-to-error': {
        name: 'The canonical points to a page that cannot be indexed',
        says: 'The canonical is the URL you want indexed, so it must answer 200 without noindex.',
        link: links.canonicalHowTo,
        fix: 'Point the canonical at the final URL that answers 200, or at the page itself.',
    },
    'canonical-chain': {
        name: 'The canonical points to a page with another canonical',
        says: 'Google does not rule on canonical chains, and the convention is one hop to the final URL.',
        link: links.canonical,
        fix: 'Point the canonical straight at the URL that the next page names as its canonical.',
    },
    'canonical-cross-domain': {
        name: 'The canonical points to another site',
        says: 'A canonical on another site is legitimate for syndicated content, and Google warns about canonicals that hackers inject.',
        link: links.canonicalFix,
        fix: 'Did you publish this page on the other site first? If you did not, remove the canonical, because it asks Google to index the other site instead.',
    },
    'duplicate-body': {
        name: 'Two pages have the same content',
        says: 'Google picks one version of duplicate content, and crawling the copies wastes its time.',
        link: links.canonical,
        fix: 'Redirect the copies to one page, or give each copy a canonical that names the page you want indexed.',
    },
    'page-not-in-sitemap': {
        name: 'A page is in no sitemap',
        says: 'A sitemap lists the pages you want Google to find.',
        link: links.sitemaps,
        fix: 'Add the page to your sitemap, or find the setting of your CMS that leaves it out.',
    },
    'sitemap-missing': {
        name: 'The site has no sitemap',
        says: 'A sitemap is optional, and Google recommends one so it finds your pages.',
        link: links.sitemaps,
        fix: 'Publish a sitemap at /sitemap.xml and name it in robots.txt with a Sitemap: line.',
    },
    'sitemap-unreachable': {
        name: 'A sitemap cannot be fetched',
        says: 'Google cannot fetch a sitemap that does not answer 200, and it ignores the whole file.',
        link: links.buildSitemap,
        fix: 'Make the sitemap URL answer 200 on your own host, or remove the line that names it.',
    },
    'sitemap-not-in-robots': {
        name: 'robots.txt names no sitemap',
        says: 'A Sitemap: line in robots.txt is one way Google finds your sitemap.',
        link: links.buildSitemap,
        fix: 'Add a line such as Sitemap: https://www.yoursite.com/sitemap.xml to robots.txt.',
    },
    'sitemap-limits': {
        name: 'A sitemap is over its size limit',
        says: 'A sitemap holds at most 50 000 URLs or 50 MB, and a sitemap index at most 50 000 sitemaps.',
        link: links.largeSitemaps,
        fix: 'Split the sitemap into several files and list them in a sitemap index.',
    },
    'sitemap-invalid': {
        name: 'A sitemap breaks the sitemap format',
        says: 'A sitemap must follow the format of sitemaps.org, or the file is not read.',
        link: links.protocol,
        fix: 'Write every ampersand as &amp;, use full URLs under 2 048 characters, and declare the sitemaps.org namespace.',
    },
    'sitemap-scope': {
        name: 'A sitemap lists URLs it may not list',
        says: 'A sitemap may list only URLs on its own host and protocol, in its own folder or below it.',
        link: links.protocol,
        fix: 'Move the URLs into a sitemap on their own host, or put the sitemap at the root of the site.',
    },
    'sitemap-url-error': {
        name: 'A sitemap lists a page that fails',
        says: 'A sitemap should list only the URLs you want in Google, and a page with an error or noindex is not one of them.',
        link: links.buildSitemap,
        fix: 'Remove the URL from the sitemap, or fix the page so it answers 200 without noindex.',
    },
    'sitemap-url-noncanonical': {
        name: 'A sitemap lists a URL that is not canonical',
        says: 'A sitemap should list the canonical URL of each page.',
        link: links.buildSitemap,
        fix: 'List the URL each page redirects to or names as canonical, over https.',
    },
    'sitemap-lastmod': {
        name: 'A sitemap’s lastmod dates are wrong',
        says: 'Google uses lastmod only when it is consistently accurate, so leave it out when you cannot keep it accurate.',
        link: links.buildSitemap,
        fix: 'Set lastmod to the date the page’s content last changed, such as 2026-10-17, or leave it out.',
    },
    'sitemap-priority': {
        name: 'A sitemap uses priority or changefreq',
        says: 'Google ignores the priority and changefreq tags.',
        link: links.buildSitemap,
        fix: 'Nothing breaks. You can remove the tags to keep the file small.',
    },
    'sitemap-extensions': {
        name: 'A sitemap’s image or video entries break their rules',
        says: 'Each sitemap extension has its own rules, such as at most 1 000 images for one URL.',
        link: links.imageSitemaps,
        fix: 'Keep up to 1 000 images for each URL, drop the image tags Google removed, and give each video a thumbnail, a title, a description and its file or player URL.',
    },
    'html-lang': {
        name: 'The html lang is missing or does not match',
        says: 'Google does not read the lang attribute to find a page’s language, and screen readers do.',
        link: links.languages,
        fix: 'Set the lang attribute of the html element to the page’s language, such as en or pl.',
    },
    'thin-page': {
        name: 'A page has little text',
        says: 'Google sets no word count, and its spam policies cover pages made in bulk with little value.',
        link: links.spam,
        fix: 'Check that the page answers what its visitors came for. Add to it if it is short, or merge it with a related page.',
    },
};
