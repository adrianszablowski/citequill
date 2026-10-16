import NavUser from '@/features/auth/components/nav-user';
import { getCurrentUser } from '@/features/auth/queries';

export default async function SidebarUser() {
    const user = await getCurrentUser();

    return <NavUser email={user.email} />;
}
