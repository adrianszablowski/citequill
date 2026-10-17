import type { CheckId } from '@/features/audit/catalogue';
import { checkText } from '@/features/audit/check-texts';

interface CheckExplanationProps {
    check: CheckId;
}

export default function CheckExplanation({
    check,
}: Readonly<CheckExplanationProps>) {
    const text = checkText(check);

    if (!text) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1 text-sm">
            <p>
                {text.says}{' '}
                <a
                    href={text.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                >
                    Read the documentation
                </a>
            </p>
            <p className="text-muted-foreground">{text.fix}</p>
        </div>
    );
}
