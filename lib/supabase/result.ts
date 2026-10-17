import type {
    PostgrestError,
    PostgrestSingleResponse,
} from '@supabase/supabase-js';

export async function one<T>(query: PromiseLike<PostgrestSingleResponse<T>>) {
    const { data, error } = await query;

    if (error || data === null) {
        throw new Error(error?.message ?? 'The row is gone.');
    }

    return data;
}

export const rowsPerRead = 1_000;

export async function all<T>(
    range: (
        from: number,
        to: number,
    ) => PromiseLike<PostgrestSingleResponse<T[]>>,
) {
    const rows: T[] = [];

    for (let from = 0; ; from += rowsPerRead) {
        const page = await one(range(from, from + rowsPerRead - 1));

        rows.push(...page);

        if (page.length < rowsPerRead) {
            return rows;
        }
    }
}

export function paged<T>({
    data,
    error,
    count,
}: {
    data: T[] | null;
    error: PostgrestError | null;
    count: number | null;
}) {
    // PostgREST answers a range that starts past the last row with 416 and no
    // count, so a page beyond the end is a result, not a failure.
    if (error?.code === 'PGRST103') {
        return { rows: [], total: null };
    }

    if (error) {
        throw error;
    }

    return { rows: data ?? [], total: count ?? 0 };
}

export async function done(
    query: PromiseLike<{ error: PostgrestError | null }>,
) {
    const { error } = await query;

    if (error) {
        throw new Error(error.message);
    }
}
