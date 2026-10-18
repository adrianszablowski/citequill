import { type CheckId, checkOf } from '@/features/audit/catalogue';
import ImageThumbnail from '@/features/audit/components/image-thumbnail';
import SeverityBadge from '@/features/audit/components/severity-badge';
import { checkText } from '@/features/audit/check-texts';
import { altAsShown, ancestorAsShown } from '@/features/audit/format';
import type { ImageListItem } from '@/features/audit/queries';

interface ImageHeaderProps {
    image: ImageListItem;
}

export default function ImageHeader({ image }: Readonly<ImageHeaderProps>) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
                <ImageThumbnail subject={image.subject} />
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="font-medium break-all">{image.subject}</h2>
                    <p className="text-sm break-all text-muted-foreground">
                        {image.alts.map(altAsShown).join(', ')}
                    </p>
                    {image.ancestors.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {image.ancestors.map(ancestorAsShown).join(', ')}
                        </p>
                    )}
                </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
                {image.checks.map((id) => {
                    const check = id as CheckId;
                    const severity = checkOf(check)?.severity;

                    return (
                        <li key={check} className="flex items-center gap-2">
                            {severity && <SeverityBadge severity={severity} />}
                            {checkText(check)?.name ?? check}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
