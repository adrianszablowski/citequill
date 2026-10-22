export function organizationDefaults(
    projectName: string,
    locales: { base_url: string; is_default: boolean }[],
) {
    const main = locales.find((locale) => locale.is_default) ?? locales[0];

    return {
        name: projectName,
        url: main ? new URL(main.base_url).origin : null,
    };
}
