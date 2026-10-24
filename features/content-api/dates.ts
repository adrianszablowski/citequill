export function apiDate(value: string) {
    const time = Date.parse(value);

    if (Number.isNaN(time)) {
        throw new Error(`The date ${value} does not parse.`);
    }

    return new Date(time).toISOString();
}

export function parseRfc3339(value: string) {
    return isTime(rfc3339, value) ? apiDate(value) : null;
}

export function isPostgresTime(value: string) {
    return isTime(postgresTime, value);
}

function isTime(pattern: RegExp, value: string) {
    const match = pattern.exec(value);

    if (!match) {
        return false;
    }

    const [year, month, day, hour, minute, second] = match
        .slice(1, 7)
        .map(Number);

    const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    return (
        wall.getUTCFullYear() === year &&
        wall.getUTCMonth() === month - 1 &&
        wall.getUTCDate() === day &&
        wall.getUTCHours() === hour &&
        wall.getUTCMinutes() === minute &&
        second < 60 &&
        Date.parse(value) <= lastTime
    );
}

// Postgres refuses the extended year an ISO string past 9999 holds.
const lastTime = Date.parse('9999-12-31T23:59:59.999Z');

const rfc3339 =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const postgresTime =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5])(?::?[0-5]\d)?)$/;
