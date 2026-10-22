export function isRedirectTarget(to: string) {
    if (to.startsWith('/')) {
        return /^\/(?![/\\])[^\s\\]*$/.test(to);
    }

    try {
        const url = new URL(to);

        return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
        return false;
    }
}

export function redirectUrl(to: string, pageUrl: string) {
    return new URL(to, to.startsWith('/') ? pageUrl : undefined).href;
}
