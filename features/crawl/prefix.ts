export function guessPrefix(candidates: string[], urls: string[]) {
    const paths = urls.flatMap((url) => {
        try {
            return [new URL(url).pathname.toLowerCase()];
        } catch {
            return [];
        }
    });

    return (
        candidates.find((candidate) =>
            paths.some(
                (path) =>
                    path === candidate || path.startsWith(`${candidate}/`),
            ),
        ) ?? ''
    );
}
