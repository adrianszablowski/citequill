import * as z from 'zod';

const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const projectSchema = z.object({
    domain: z
        .string()
        .trim()
        .transform(toHost)
        .pipe(
            z
                .string()
                .regex(
                    domain,
                    'Enter the address of a site, like https://www.yoursite.com.',
                ),
        ),
});

export type ProjectValues = z.input<typeof projectSchema>;

function toHost(address: string) {
    try {
        return new URL(
            /^[a-z]+:\/\//i.test(address) ? address : `https://${address}`,
        ).hostname.replace(/^www\./, '');
    } catch {
        return address.toLowerCase();
    }
}
