export function apiUrl(path = '') {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/v1${path}`;
}

export function docsUrl(path = '') {
    return `${process.env.NEXT_PUBLIC_APP_URL}/docs${path}`;
}

export function hostSitemapUrl(siteId: string, host: string) {
    return apiUrl(`/sites/${siteId}/sitemaps/${host}.xml`);
}

// The host api_sitemap_project() and the host column of api_versions cut in
// SQL: the base URL lowercased and cut at the first /, :, ? or #. If the two
// disagree, a robots.txt line Settings shows answers host_not_found.
export function hostOf(baseUrl: string) {
    return new URL(baseUrl).hostname.toLowerCase();
}
