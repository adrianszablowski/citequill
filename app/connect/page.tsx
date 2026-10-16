import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import SignOutForm from '@/features/auth/components/sign-out-form';
import ConnectSiteForm from '@/features/projects/components/connect-site-form';

export default function ConnectPage() {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Connect your site</CardTitle>
                    <CardDescription>
                        One project is one domain. The crawl names it after the
                        site.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ConnectSiteForm />
                </CardContent>
            </Card>
            <SignOutForm />
        </main>
    );
}
