import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import CreateKeyDialog from '@/features/content-api/components/create-key-dialog';
import DeleteKeyDialog from '@/features/content-api/components/delete-key-dialog';
import {
    keyLimitSentence,
    keysPerProject,
} from '@/features/content-api/schema';
import CopyButton from '@/features/projects/components/copy-button';
import { formatDate } from '@/lib/utils';

interface SiteKeysProps {
    projectId: string;
    siteId: string;
    keys: {
        id: string;
        name: string;
        key_hint: string;
        last_used_on: string | null;
    }[];
}

export default function SiteKeys({
    projectId,
    siteId,
    keys,
}: Readonly<SiteKeysProps>) {
    const isFull = keys.length >= keysPerProject;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Content API keys</CardTitle>
                <CardDescription>
                    Your site sends a key from its server or its build.
                    Citequill shows a key in full only when you make it.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Site id</h3>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            readOnly
                            value={siteId}
                            aria-label="Site id"
                            className="font-mono"
                        />
                        <CopyButton value={siteId} label="Copy the site id" />
                    </div>
                </div>
                {keys.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Key</TableHead>
                                <TableHead>Last used</TableHead>
                                <TableHead>
                                    <span className="sr-only">Delete</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keys.map((key) => (
                                <TableRow key={key.id}>
                                    <TableCell>{key.name}</TableCell>
                                    <TableCell className="font-mono">
                                        {key.key_hint}
                                    </TableCell>
                                    <TableCell>
                                        {key.last_used_on ? (
                                            formatDate(key.last_used_on)
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Not used yet
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DeleteKeyDialog
                                            projectId={projectId}
                                            keyId={key.id}
                                            name={key.name}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Make one key for each place your site runs, such as
                        Production and Preview.
                    </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <CreateKeyDialog projectId={projectId} isFull={isFull} />
                    {isFull && (
                        <p className="text-sm text-muted-foreground">
                            {keyLimitSentence}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
