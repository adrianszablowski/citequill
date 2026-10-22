import { pageAddress } from '@/features/pages/draft';

export interface PublishCandidate {
    locale: string;
    slug: string;
    author_id: string | null;
    page_kinds: { url_prefix: string; author_id: string | null } | null;
    published_pages: { url: string } | null;
}

export function publishCheck(
    page: PublishCandidate,
    locales: { locale: string; base_url: string }[],
) {
    if (!page.author_id && !page.page_kinds?.author_id) {
        return { error: "Pick the page's author in Edit, then publish it." };
    }

    const locale = locales.find(
        (candidate) => candidate.locale === page.locale,
    );

    if (!locale) {
        return {
            error: `The page is in ${page.locale}, which is not among the project's languages, so it has no address on the site. Write it again in one of the project's languages.`,
        };
    }

    const address = pageAddress(
        locale.base_url,
        page.page_kinds?.url_prefix ?? '',
        page.slug,
    );

    const liveUrl = page.published_pages?.url;

    if (liveUrl && liveUrl !== address.url) {
        return {
            error: `The page went live at ${liveUrl}, and the base URL of its language and the URL prefix of its kind now give ${address.url}. A page keeps the address it went live at, so Publish waits until they give ${liveUrl} again.`,
        };
    }

    return { address };
}
