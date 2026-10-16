export function isAllowedEmail(
    email: string | undefined,
    allowed = process.env.ALLOWED_EMAILS,
) {
    if (!email || !allowed) {
        return false;
    }

    const list = allowed.split(',').map((item) => item.trim().toLowerCase());

    return list.includes(email.trim().toLowerCase());
}
