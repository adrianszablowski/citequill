import { signOut } from '@/features/auth/actions';
import SignOutButton from '@/features/auth/components/sign-out-button';

export default function SignOutForm() {
    return (
        <form action={signOut}>
            <SignOutButton />
        </form>
    );
}
