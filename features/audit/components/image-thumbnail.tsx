import Image from 'next/image';

import { isWebUrl } from '@/lib/utils';

interface ImageThumbnailProps {
    subject: string;
}

export default function ImageThumbnail({
    subject,
}: Readonly<ImageThumbnailProps>) {
    if (!isWebUrl(subject)) {
        return null;
    }

    return (
        <Image
            src={subject}
            alt=""
            width={48}
            height={48}
            unoptimized
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded border bg-muted object-contain"
        />
    );
}
