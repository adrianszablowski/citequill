import Link from 'next/link';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { botSecretHeader } from '@/features/crawl/fetch';
import CopyButton from '@/features/projects/components/copy-button';
import RegenerateSecretForm from '@/features/projects/components/regenerate-secret-form';

interface BotSecretProps {
    projectId: string;
    secret: string;
}

export default function BotSecret({
    projectId,
    secret,
}: Readonly<BotSecretProps>) {
    const expression = `any(http.request.headers["${botSecretHeader}"][*] eq "${secret}")`;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bot secret</CardTitle>
                <CardDescription>
                    Every audit request to your site carries this secret in the
                    header <code>{botSecretHeader}</code>. It is sent over https
                    and http alike.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            readOnly
                            value={secret}
                            aria-label="Bot secret"
                            className="font-mono"
                        />
                        <CopyButton value={secret} label="Copy the secret" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <RegenerateSecretForm projectId={projectId} />
                        <p className="text-sm text-muted-foreground">
                            A new secret takes effect on the next audit.
                        </p>
                    </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">
                            Let the audit through Cloudflare
                        </h3>
                        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
                            <li>
                                In Cloudflare, open your domain, go to the
                                Security rules page and select Create rule, then
                                Custom rules.
                            </li>
                            <li>
                                <div className="flex flex-col items-start gap-2">
                                    Select Edit expression and paste the
                                    expression below.
                                    <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all text-foreground">
                                        {expression}
                                    </code>
                                    <CopyButton
                                        value={expression}
                                        label="Copy the Cloudflare expression"
                                    />
                                </div>
                            </li>
                            <li>
                                Choose Skip as the action, then select each
                                option your site needs from All remaining custom
                                rules, All managed rules, All Super Bot Fight
                                Mode rules and All rate limiting rules.
                            </li>
                            <li>
                                Select Deploy, then place the rule above any
                                rule of your own that blocks requests, because a
                                skip covers only the rules after it.
                            </li>
                        </ol>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">
                            Let the audit through Vercel
                        </h3>
                        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
                            <li>
                                In Vercel, open the project of your site, go to
                                Firewall and select Configure from the menu at
                                the top right.
                            </li>
                            <li>
                                Select Add New, then Rule, and add a condition:
                                the request header{' '}
                                <code>{botSecretHeader}</code> equals the secret
                                above.
                            </li>
                            <li>
                                Choose Bypass as the action and select Save
                                Rule.
                            </li>
                            <li>
                                Place the rule above any rule of your own that
                                blocks requests, because rules run in order.
                            </li>
                            <li>Select Review Changes, then Publish.</li>
                        </ol>
                    </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <p>
                        On Cloudflare&apos;s Free plan, no rule skips Bot Fight
                        Mode. Before you run an audit, go to Security, then
                        Settings, filter by Bot traffic and turn Bot Fight Mode
                        off.
                    </p>
                    <p>
                        In Vercel, Attack Mode runs before custom rules, so no
                        rule bypasses it. Keep Attack Mode off while an audit
                        runs.
                    </p>
                </div>
                <Link
                    href="/bot"
                    className="text-sm underline underline-offset-4"
                >
                    How CitequillBot reads your site
                </Link>
            </CardContent>
        </Card>
    );
}
