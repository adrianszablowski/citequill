import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    hasFilters,
    keptParams,
    pageListHref,
} from '@/features/pages/list-query';
import { type PageListQuery, pageStatuses } from '@/features/pages/schema';
import { sectionHref } from '@/lib/sections';

interface PageFiltersProps {
    projectId: string;
    query: PageListQuery;
    locales: string[];
}

export default function PageFilters({
    projectId,
    query,
    locales,
}: Readonly<PageFiltersProps>) {
    return (
        <Form
            action={sectionHref(projectId, 'pages')}
            className="flex flex-wrap items-end gap-3"
        >
            {keptParams(query).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pages-q">Title</Label>
                <Input
                    id="pages-q"
                    name="q"
                    type="search"
                    defaultValue={query.q ?? ''}
                    placeholder="Search titles"
                    className="w-56"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pages-locale">Language</Label>
                <Select
                    name="locale"
                    defaultValue={query.locale ?? ''}
                    items={{
                        '': 'Any language',
                        ...Object.fromEntries(
                            locales.map((locale) => [locale, locale]),
                        ),
                    }}
                >
                    <SelectTrigger id="pages-locale" className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Any language</SelectItem>
                        {locales.map((locale) => (
                            <SelectItem key={locale} value={locale}>
                                {locale}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pages-status">State</Label>
                <Select
                    name="status"
                    defaultValue={query.status ?? ''}
                    items={statusItems}
                >
                    <SelectTrigger id="pages-status" className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(statusItems).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pages-from">Published from</Label>
                <Input
                    id="pages-from"
                    name="from"
                    type="date"
                    defaultValue={query.from ?? ''}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pages-to">Published to</Label>
                <Input
                    id="pages-to"
                    name="to"
                    type="date"
                    defaultValue={query.to ?? ''}
                />
            </div>
            <Button type="submit" variant="outline">
                <SearchIcon />
                Filter
            </Button>
            {hasFilters(query) && (
                <Button
                    variant="ghost"
                    nativeButton={false}
                    render={
                        <Link
                            href={pageListHref(
                                projectId,
                                Object.fromEntries(keptParams(query)),
                            )}
                        />
                    }
                >
                    Clear
                </Button>
            )}
        </Form>
    );
}

const statusItems: Record<'' | (typeof pageStatuses)[number], string> = {
    '': 'Any state',
    draft: 'Draft',
    published: 'Live',
    unpublished: 'Unpublished',
};
