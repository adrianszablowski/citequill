import { notFound } from 'next/navigation';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { getCurrentUser } from '@/features/auth/queries';
import CrawlAgainForm from '@/features/crawl/components/crawl-again-form';
import AuthorDialog from '@/features/projects/components/author-dialog';
import KindAuthorsForm from '@/features/projects/components/kind-authors-form';
import NotSet from '@/features/projects/components/not-set';
import OrganizationForm from '@/features/projects/components/organization-form';
import {
    getAuthors,
    getOrganization,
    getPageKinds,
    getProjectLocales,
} from '@/features/projects/queries';
import { authorValues, organizationValues } from '@/features/projects/schema';
import { smallLogoWarning } from '@/features/publishing/logo';
import { organizationDefaults } from '@/features/publishing/organization';

interface SettingsGeneralProps {
    params: Promise<{ id: string }>;
}

export default async function SettingsGeneral({
    params,
}: Readonly<SettingsGeneralProps>) {
    const { id } = await params;

    await getCurrentUser();

    const [locales, kinds, authors, organization] = await Promise.all([
        getProjectLocales(id),
        getPageKinds(id),
        getAuthors(id),
        getOrganization(id),
    ]);

    if (organization === null) {
        notFound();
    }

    const {
        organization_logo_url: logoUrl,
        organization_logo_width: width,
        organization_logo_height: height,
    } = organization;

    const logo =
        logoUrl && width && height ? { url: logoUrl, width, height } : null;

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Locales</CardTitle>
                    <CardDescription>
                        Each locale has the base URL its pages start with.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Locale</TableHead>
                                <TableHead>Base URL</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {locales.map((locale) => (
                                <TableRow key={locale.id}>
                                    <TableCell>
                                        {locale.locale}
                                        {locale.is_default && ' (default)'}
                                    </TableCell>
                                    <TableCell>{locale.base_url}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Page kinds</CardTitle>
                    <CardDescription>
                        Where each kind of page lands, how it is written and who
                        signs it.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <KindAuthorsForm
                        projectId={id}
                        kinds={kinds}
                        authors={authors}
                    />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Authors</CardTitle>
                    <CardDescription>
                        The byline of a page and its author in JSON-LD.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {authors.length === 0 ? (
                        <p className="text-sm">
                            <NotSet />
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Profile URL</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Edit</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {authors.map((author) => (
                                    <TableRow key={author.id}>
                                        <TableCell>{author.name}</TableCell>
                                        <TableCell>
                                            {author.title ?? <NotSet />}
                                        </TableCell>
                                        <TableCell className="max-w-48 truncate">
                                            {author.url ?? <NotSet />}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AuthorDialog
                                                projectId={id}
                                                author={{
                                                    id: author.id,
                                                    values: authorValues(
                                                        author,
                                                    ),
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <AuthorDialog projectId={id} author={null} />
                </CardContent>
            </Card>
            <OrganizationForm
                projectId={id}
                values={organizationValues(organization)}
                defaults={organizationDefaults(organization.name, locales)}
                logo={logo}
                warning={logo && smallLogoWarning(logo)}
            />
            <Card>
                <CardHeader>
                    <CardTitle>Crawl</CardTitle>
                    <CardDescription>
                        Reads the site again, refreshes the locales and the
                        pages, and fills in the organization&apos;s empty
                        fields. Skills, kinds and authors stay as they are.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CrawlAgainForm projectId={id} />
                </CardContent>
            </Card>
        </div>
    );
}
