import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface ConnectSubmitButtonProps {
    isPending: boolean;
}

export default function ConnectSubmitButton({
    isPending,
}: Readonly<ConnectSubmitButtonProps>) {
    return (
        <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? 'Connecting…' : 'Connect'}
        </Button>
    );
}
