import { useSyncExternalStore } from 'react';

const mobileQuery = '(max-width: 767px)';

export function useIsMobile() {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(mobileQuery).matches,
        () => false,
    );
}

function subscribe(onChange: () => void) {
    const mql = window.matchMedia(mobileQuery);

    mql.addEventListener('change', onChange);

    return () => mql.removeEventListener('change', onChange);
}
