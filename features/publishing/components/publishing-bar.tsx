'use client';

import type { ComponentProps } from 'react';
import { type Control, useFormState } from 'react-hook-form';

import DiscardChangesForm from '@/features/pages/components/discard-changes-form';
import type { PageValues } from '@/features/pages/schema';
import PublishForm from '@/features/publishing/components/publish-form';
import UnpublishDialog from '@/features/publishing/components/unpublish-dialog';
import { stateButtons, type VersionState } from '@/features/publishing/state';

interface PublishingBarProps {
    projectId: string;
    pageId: string;
    control: Control<PageValues>;
    state: VersionState;
    hasLiveVersion: boolean;
    checkNote: string | null;
    block: string | null;
    onDiscarded: ComponentProps<typeof DiscardChangesForm>['onDiscarded'];
}

export default function PublishingBar({
    projectId,
    pageId,
    control,
    state,
    hasLiveVersion,
    checkNote,
    block,
    onDiscarded,
}: Readonly<PublishingBarProps>) {
    const { isDirty } = useFormState({ control });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start gap-2">
                {stateButtons[state].map((button) => {
                    if (button === 'discard') {
                        return (
                            hasLiveVersion && (
                                <DiscardChangesForm
                                    key={button}
                                    projectId={projectId}
                                    pageId={pageId}
                                    isDisabled={isDirty}
                                    onDiscarded={onDiscarded}
                                />
                            )
                        );
                    }

                    if (button === 'unpublish') {
                        return (
                            <UnpublishDialog
                                key={button}
                                projectId={projectId}
                                pageId={pageId}
                            />
                        );
                    }

                    return (
                        <PublishForm
                            key={button}
                            projectId={projectId}
                            pageId={pageId}
                            label={
                                button === 'publish'
                                    ? 'Publish'
                                    : 'Publish changes'
                            }
                            checkNote={checkNote}
                            block={isDirty ? unsavedEdits : block}
                        />
                    );
                })}
            </div>
            {state === 'changed' && !hasLiveVersion && (
                <p className="text-sm text-muted-foreground">
                    The page has no published version yet, so there is nothing
                    to discard. Publish changes writes one.
                </p>
            )}
        </div>
    );
}

const unsavedEdits = 'Save the page first, then publish it.';
