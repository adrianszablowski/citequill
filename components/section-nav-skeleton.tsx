import { Skeleton } from '@/components/ui/skeleton';
import { projectSections, settingsPages } from '@/lib/sections';

export default function SectionNavSkeleton() {
    return (
        <div className="flex flex-col gap-1 p-2">
            {projectSections.map(({ segment }) => (
                <Skeleton key={segment} className="h-8 w-full" />
            ))}
            {settingsPages.map(({ segment }) => (
                <Skeleton key={segment} className="ml-6 h-7 w-auto" />
            ))}
        </div>
    );
}
