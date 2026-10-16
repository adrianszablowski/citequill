export const pageCap = 50;

export const postSample = 5;

export interface RankInput {
    home: string;
    candidates: string[];
    navLinks: string[];
    localePrefixes: string[];
    seen: string[];
}

export function rankUrls(input: RankInput, count: number) {
    const home = new URL(input.home);
    const seen = new Set(input.seen.map((url) => normalize(url, home)));
    const nav = new Set(input.navLinks.map((url) => normalize(url, home)));

    const prefixes = input.localePrefixes.map((prefix) =>
        prefix.replace(/\/$/, ''),
    );

    let postsLeft = postSample - input.seen.filter(isPost).length;

    const ranked = unique(
        [input.home, ...input.candidates].map((url) => normalize(url, home)),
    )
        .filter(
            (url): url is string =>
                url !== null && !excluded(url) && !underLocale(url, prefixes),
        )
        .map((url) => ({
            url,
            tier: tierOf(url, home.href, nav),
            depth: segments(url).length,
        }))
        .sort(
            (a, b) =>
                a.tier - b.tier ||
                a.depth - b.depth ||
                a.url.length - b.url.length ||
                a.url.localeCompare(b.url),
        );

    const picked: string[] = [];

    for (const { url } of ranked) {
        if (picked.length === count) {
            break;
        }

        if (seen.has(url)) {
            continue;
        }

        if (isPost(url)) {
            if (postsLeft === 0) {
                continue;
            }

            postsLeft -= 1;
        }

        picked.push(url);
    }

    return picked;
}

const factPages = new Set(
    `pricing prices plans plan cennik cena ceny preise tarife tarifs prix precios planes prezzi precos
    about about-us company team story mission o-nas o-firmie firma zespol uber-uns unternehmen a-propos qui-sommes-nous sobre nosotros quienes-somos chi-siamo sobre-nos
    contact contact-us kontakt contacto contatti contato
    features feature product products solutions solution platform how-it-works funkcje produkt produkty rozwiazania jak-to-dziala funktionen produkte losungen fonctionnalites produits caracteristicas funciones productos soluciones funzionalita prodotti soluzioni funcionalidades produtos solucoes
    faq faqs help support questions pomoc wsparcie hilfe aide ayuda aiuto ajuda
    terms terms-of-service privacy privacy-policy legal refund refunds refund-policy regulamin polityka-prywatnosci prywatnosc zwroty agb datenschutz impressum cgv cgu mentions-legales confidentialite terminos privacidad termini condizioni termos privacidade
    customers customer-stories case-studies case-study testimonials reviews clients klienci opinie referencje kunden referenzen temoignages clientes casos testimonios recensioni clienti
    security trust compliance bezpieczenstwo sicherheit securite seguridad sicurezza seguranca
    careers jobs press media kariera praca prasa karriere presse carrieres emploi prensa lavora-con-noi carreiras imprensa
    docs documentation getting-started changelog roadmap integrations dokumentacja integracje integrationen integraciones integrazioni
    compare comparison vs alternatives alternative porownanie alternatywy vergleich alternativen comparatif alternativas confronto
    use-cases industries branze branchen industrias settori
    demo download apps app pobierz enterprise partners partner affiliates`
        .split(/\s+/)
        .filter(Boolean),
);

const contentSections = new Set(
    `blog blogs articles article news posts post insights resources stories journal magazine updates
    aktualnosci artykuly artykul blogu nachrichten artikel actualites noticias articulos notizie articoli artigos`
        .split(/\s+/)
        .filter(Boolean),
);

const excludedSegments = new Set(
    `tag tags tagi category categories kategoria kategorie author authors autor page strona search szukaj feed rss
    login logowanie signin sign-in signup sign-up register rejestracja cart koszyk checkout account konto
    wp-json wp-admin wp-content wp-includes cdn-cgi api admin dashboard auth`
        .split(/\s+/)
        .filter(Boolean),
);

const fileExtension =
    /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|xml|json|txt|zip|gz|mp3|mp4|webm|mov|css|js|map|woff2?|ttf|docx?|xlsx?|pptx?|csv)$/i;

function normalize(candidate: string, home: URL) {
    try {
        const url = new URL(candidate, home);

        if (
            !/^https?:$/.test(url.protocol) ||
            bareHost(url.hostname) !== bareHost(home.hostname)
        ) {
            return null;
        }

        url.hostname = home.hostname;
        url.hash = '';
        url.search = '';

        return url.href;
    } catch {
        return null;
    }
}

function bareHost(hostname: string) {
    return hostname.toLowerCase().replace(/^www\./, '');
}

function segments(url: string) {
    return new URL(url).pathname
        .split('/')
        .filter(Boolean)
        .map((segment) =>
            decode(segment)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .replace(/_/g, '-'),
        );
}

function decode(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function excluded(url: string) {
    const parts = segments(url);

    return (
        fileExtension.test(new URL(url).pathname) ||
        parts.some((segment) => excludedSegments.has(segment)) ||
        parts.some((segment, index) => index > 0 && /^\d+$/.test(segment))
    );
}

function underLocale(url: string, localePrefixes: string[]) {
    return localePrefixes.some(
        (prefix) => url === prefix || url.startsWith(`${prefix}/`),
    );
}

function isPost(url: string) {
    const parts = segments(url);

    return parts.length >= 2 && contentSections.has(parts[0]);
}

function tierOf(url: string, home: string, nav: Set<string | null>) {
    const parts = segments(url);

    if (url === home) {
        return 0;
    }

    if (nav.has(url)) {
        return 1;
    }

    if (parts.some(namesFactPage)) {
        return 2;
    }

    if (isPost(url)) {
        return 4;
    }

    return parts.length === 1 ? 3 : 5;
}

function namesFactPage(segment: string) {
    return (
        factPages.has(segment) ||
        [...factPages].some(
            (hint) =>
                segment.startsWith(`${hint}-`) || segment.endsWith(`-${hint}`),
        )
    );
}

function unique<T>(values: T[]) {
    return [...new Set(values)];
}
