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
import {
    getAuthors,
    getPageKinds,
    getProjectLocales,
} from '@/features/projects/queries';

interface SettingsOverviewProps {
    params: Promise<{ id: string }>;
}

export default async function SettingsOverview({
    params,
}: Readonly<SettingsOverviewProps>) {
    const { id } = await params;

    await getCurrentUser();

    const [locales, kinds, authors] = await Promise.all([
        getProjectLocales(id),
        getPageKinds(id),
        getAuthors(id),
    ]);

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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kind</TableHead>
                                <TableHead>URL prefix</TableHead>
                                <TableHead>Skill</TableHead>
                                <TableHead>Author</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {kinds.map((kind) => (
                                <TableRow key={kind.id}>
                                    <TableCell>{kind.name}</TableCell>
                                    <TableCell>
                                        {kind.url_prefix || notSet}
                                    </TableCell>
                                    <TableCell>{kind.skills.name}</TableCell>
                                    <TableCell>
                                        {kind.authors?.name ?? notSet}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Authors</CardTitle>
                    <CardDescription>
                        The byline of a page and its author in JSON-LD.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {authors.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {notSet}
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Profile URL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {authors.map((author) => (
                                    <TableRow key={author.id}>
                                        <TableCell>{author.name}</TableCell>
                                        <TableCell>
                                            {author.title ?? notSet}
                                        </TableCell>
                                        <TableCell>
                                            {author.url ?? notSet}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Crawl</CardTitle>
                    <CardDescription>
                        Reads the site again and refreshes the locales and the
                        pages. Skills, kinds and authors stay as they are.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CrawlAgainForm projectId={id} />
                </CardContent>
            </Card>
        </div>
    );
}

const notSet = 'Not set yet';
