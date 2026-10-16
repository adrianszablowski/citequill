export function isStaleRun(
    run: { status: string; started_at: string },
    now = Date.now(),
) {
    return (
        run.status === 'running' &&
        now - new Date(run.started_at).getTime() > staleAfterMs
    );
}

export const staleAfterMs = 15 * 60 * 1000;
