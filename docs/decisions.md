# Dziennik decyzji

Każdy wpis: data, decyzja, powód. Nowe wpisy na górze. Decyzja obowiązuje, dopóki nowszy wpis jej nie zmieni.

## 2026-10-14: nazwa Citequill

Produkt nazywa się Citequill. Domeny citequill.com, .io, .ai, .dev i .pl, nazwa paczki npm i konto GitHub były wolne 14 października 2026. Baz znaków towarowych nie sprawdzono.

Powód: "cite" nazywa cel GEO (bycie cytowanym przez asystentów AI), "quill" nazywa pisanie. Jedyna sensowna nazwa z wolnym .com. Odrzucone: serpmill (kojarzy się z content mill), rankwright (agencja SEO w Kanadzie), rankloop (istniejący rank tracker).

## 2026-10-14: co to jest Citequill

Hostowany autopilot SEO i GEO. Właściciel podłącza stronę, Citequill co tydzień robi research, pisze strony i publikuje je na stronie klienta przez integrację. Właściciel dostaje raport i nie musi codziennie nic robić.

Repo: Next.js 16.4 na Vercelu, pnpm, TypeScript, App Router. Repo prywatne, `docs/` w repo.

## 2026-10-14: decyzje z rundy 1 grillingu

1. Panel z logowaniem. Jeden workspace na podłączony projekt. W workspace zakładki: strony (pod URL-em wskazanym przez właściciela), analityka z Search Console (pozycje, wyświetlenia, kliknięcia per strona, wzór: Atomic AGI), skille. Właściciel wybiera per projekt: pełny automat albo tryb szkiców, w którym nic nie wychodzi bez jego kliknięcia.
2. Bez limitu stron tygodniowo. Właściciel odpowiada za swoją domenę. Citequill odpowiada za jakość każdej strony.
3. Skille jako źródło prawdy. Po podłączeniu Citequill crawluje stronę i pisze pierwszy skill: o czym jest produkt, dla kogo, jakie ma funkcje, języki. Właściciel poprawia skill i dopisuje kolejne (jak pisać blogi, czego nie twierdzić). Model używa tylko skilli jako wiedzy o produkcie. Autor stron jest polem w skillu o produkcie.
4. Rodzaje stron w MVP: wpisy blogowe, poradniki, porównania z konkurentami. Poza MVP: kalkulatory, darmowe narzędzia, strony "X dla Y".
5. Trackist: Citequill dokłada nowe strony obok istniejących w tablicach TypeScript. Bez migracji.
6. Backlinki: backlog. SEObot wymienia linki między klientami za ich zgodą; wymaga osobnej decyzji.
7. Języki: Citequill czyta ze strony klienta, w jakich językach istnieje, i pisze w tych językach.
8. Zakres MVP: tylko projekty właściciela, bez płatności i planów. Płatności i plany dojdą, gdy produkt spełni oczekiwania właściciela na jego stronach.
9. Bez adnotacji "przygotowane z pomocą AI". Byline to autor podany w skillu.
10. Tydzień pracy liczony jako Workflow na Vercelu z krokami, które wołają API modelu bezpośrednio.
11. Search Console: właściciel dodaje adres service account Citequill jako pełnego użytkownika właściwości. Bez OAuth.

Powód: odpowiedzi właściciela na rundę 1, 14 października 2026. Research stojący za pytaniami leży w `research/`.

## 2026-10-14: React Compiler i typowane trasy włączone

`next.config.ts` ma `reactCompiler: true` i `typedRoutes: true` obok `cacheComponents` i `partialPrefetching`. Komponenty piszemy bez `useMemo`, `useCallback` i `React.memo`; kompilator memoizuje sam. `href` w `<Link>` i `redirect()` jest sprawdzany przez TypeScript, więc literówka w ścieżce pada na `pnpm type-check`.

Powód: decyzja właściciela po raporcie o Next.js 16.4. Obie opcje są stabilne od 16.0, wersja kompilatora w Ruście (`experimental.turbopackRustReactCompiler`) zostaje wyłączona, dopóki jest eksperymentalna.

## Backlog

Rzeczy odłożone na później, z datą i powodem.

- 2026-10-14: backlinki i wymiana linków między klientami. Polityka Google nazywa wymiany link spamem; wymaga osobnej decyzji.
- 2026-10-14: kalkulatory, darmowe narzędzia, strony "X dla Y". Wymagają własnych danych lub kodu w feedzie.
- 2026-10-14: płatności i plany. Po tym, jak produkt spełni oczekiwania właściciela na jego stronach.
