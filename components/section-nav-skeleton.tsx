import { Skeleton } from '@/components/ui/skeleton';
import { projectSections } from '@/lib/sections';

export default function SectionNavSkeleton() {
    return (
        <div className="flex flex-col gap-1 p-2">
            {projectSections.map(({ segment }) => (
                <Skeleton key={segment} className="h-8 w-full" />
            ))}
        </div>
    );
}
