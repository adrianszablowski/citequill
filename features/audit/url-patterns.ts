export interface Pagination {
    page: number;
    series: string;
    first: string;
}

export const facetVolume = 10;

export function isSearchUrl(url: string) {
    const parsed = new URL(url);

    return (
        segmentsOf(parsed).some((segment) => searchSegments.has(segment)) ||
        parameterNames(parsed).some((name) => searchParameters.has(name))
    );
}

export function facetPath(url: string) {
    const parsed = new URL(url);

    return parameterNames(parsed).some((name) => facetParameters.has(name))
        ? parsed.origin + parsed.pathname
        : null;
}

export function pagination(url: string): Pagination | null {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/');

    const at = segments.findIndex(
        (segment, index) =>
            paginationNames.has(segment.toLowerCase()) &&
            /^\d+$/.test(segments[index + 1] ?? ''),
    );

    if (at !== -1) {
        const series = new URL(parsed);
        const first = new URL(parsed);

        series.pathname = segments.toSpliced(at, 2).join('/') || '/';
        first.pathname = segments.toSpliced(at + 1, 1, '1').join('/');

        return {
            page: Number(segments[at + 1]),
            series: series.href,
            first: first.href,
        };
    }

    const parameter = [...parsed.searchParams].find(
        ([name, value]) =>
            paginationNames.has(name.toLowerCase()) && /^\d+$/.test(value),
    );

    if (!parameter) {
        return null;
    }

    const [name, value] = parameter;
    const series = new URL(parsed);
    const first = new URL(parsed);

    series.searchParams.delete(name);
    first.searchParams.set(name, '1');

    return { page: Number(value), series: series.href, first: first.href };
}

export function isUtilityUrl(url: string) {
    const parsed = new URL(url);

    return (
        segmentsOf(parsed).some((segment) => utilitySegments.has(segment)) ||
        parameterNames(parsed).includes('print')
    );
}

export function trackingParameter(url: string) {
    return (
        parameterNames(new URL(url)).find(
            (name) => name.startsWith('utm_') || trackingParameters.has(name),
        ) ?? null
    );
}

export function saysNoResults(text: string) {
    return noResults.test(text);
}

const searchSegments = new Set(['search', 'szukaj', 'wyszukiwarka']);

const searchParameters = new Set(['s', 'q', 'query', 'search', 'szukaj']);

const facetParameters = new Set([
    'sort',
    'order',
    'orderby',
    'filter',
    'price',
    'color',
    'size',
    'brand',
    'sortuj',
    'filtr',
    'cena',
    'kolor',
    'rozmiar',
    'marka',
]);

const paginationNames = new Set(['page', 'strona']);

const utilitySegments = new Set([
    'print',
    'drukuj',
    'thank-you',
    'thanks',
    'dziekujemy',
    'podziekowanie',
    'login',
    'logowanie',
    'signin',
    'wp-login.php',
    'cart',
    'koszyk',
    'checkout',
    'zamowienie',
]);

const trackingParameters = new Set([
    'fbclid',
    'gclid',
    'msclkid',
    'mc_cid',
    'sessionid',
    'sid',
    'phpsessid',
    'jsessionid',
]);

const noResultsPhrases = [
    'no results',
    '0 results',
    'nothing found',
    'brak wyników',
    'nic nie znaleziono',
    'nie znaleziono produktów',
];

const noResults = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${noResultsPhrases.join('|')})(?![\\p{L}\\p{N}])`,
    'iu',
);

function segmentsOf(url: URL) {
    return url.pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decoded(segment).toLowerCase());
}

function parameterNames(url: URL) {
    return [...url.searchParams.keys()].map((name) => name.toLowerCase());
}

function decoded(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}
