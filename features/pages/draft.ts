export function slugify(title: string) {
    return title
        .replace(/[łŁøØßæÆđĐ]/g, (letter) => plainLetters[letter] ?? letter)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
}

export function uniqueSlug(slug: string, taken: string[]) {
    const base = slug || 'page';

    if (!taken.includes(base)) {
        return base;
    }

    let n = 2;

    while (taken.includes(`${base}-${n}`)) {
        n += 1;
    }

    return `${base}-${n}`;
}

export function pagePath(baseUrl: string, urlPrefix: string, slug: string) {
    const parts = [urlPrefix, slug]
        .map((part) => part.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean);

    return `${baseUrl.replace(/\/+$/, '')}/${parts.join('/')}`;
}

export function readingMinutes(markdown: string) {
    const words = markdown.split(/\s+/).filter(Boolean).length;

    return Math.max(1, Math.round(words / wordsPerMinute));
}

export function internalLinkFindings(
    markdown: string,
    siteOrigin: string,
    knownUrls: string[],
) {
    const known = new Set(knownUrls.map(normalize));
    const host = hostOf(siteOrigin);
    const findings: string[] = [];

    for (const match of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1];
        const resolved = resolve(target, siteOrigin);

        if (!resolved || hostOf(resolved) !== host) {
            continue;
        }

        if (!known.has(normalize(resolved)) && !findings.includes(target)) {
            findings.push(target);
        }
    }

    return findings.map(
        (target) =>
            `The link to ${target} is not among the pages Citequill knows; link to one of the site's pages or remove it.`,
    );
}

function resolve(target: string, origin: string) {
    try {
        return new URL(target, origin).toString();
    } catch {
        return null;
    }
}

function hostOf(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function normalize(url: string) {
    try {
        const parsed = new URL(url);

        return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
        return url;
    }
}

const wordsPerMinute = 200;

// Letters NFKD leaves whole, because they have no base letter plus accent form.
const plainLetters: Record<string, string> = {
    ł: 'l',
    Ł: 'l',
    ø: 'o',
    Ø: 'o',
    ß: 'ss',
    æ: 'ae',
    Æ: 'ae',
    đ: 'd',
    Đ: 'd',
};
