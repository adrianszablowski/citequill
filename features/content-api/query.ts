import { problem } from '@/features/content-api/answer';

export function readQuery(
    url: URL,
    allowed: readonly string[],
    named: readonly string[] = allowed,
) {
    const values: Record<string, string> = {};

    for (const [name, value] of url.searchParams) {
        if (!allowed.includes(name)) {
            return problem(
                'invalid_parameter',
                allowed.length > 0
                    ? `The endpoint takes no parameter ${name}. It takes ${listed(named)}.`
                    : `The endpoint takes no parameters, and the request has ${name}.`,
            );
        }

        if (name in values) {
            return problem(
                'invalid_parameter',
                `The request has ${name} twice. Send it once.`,
            );
        }

        values[name] = value;
    }

    return values;
}

export function isLocale(value: string) {
    return /^[a-z]{2,3}([-_][a-z]{2})?$/i.test(value);
}

function listed(names: readonly string[]) {
    return names.length > 1
        ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
        : names.join('');
}
