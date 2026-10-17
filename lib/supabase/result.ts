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

export async function done(
    query: PromiseLike<{ error: PostgrestError | null }>,
) {
    const { error } = await query;

    if (error) {
        throw new Error(error.message);
    }
}
