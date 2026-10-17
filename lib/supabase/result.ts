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

export async function done(
    query: PromiseLike<{ error: PostgrestError | null }>,
) {
    const { error } = await query;

    if (error) {
        throw new Error(error.message);
    }
}
