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
import { areaNames, severityNames } from '@/features/audit/check-texts';
import {
    findingListHref,
    hasFindingFilters,
    keptFindingParams,
} from '@/features/audit/list-query';
import { type FindingListQuery, severities } from '@/features/audit/schema';
import { sectionHref } from '@/lib/sections';

interface FindingFiltersProps {
    projectId: string;
    query: FindingListQuery;
    locales: string[];
}

export default function FindingFilters({
    projectId,
    query,
    locales,
}: Readonly<FindingFiltersProps>) {
    const localeSelects =
        locales.length > 1
            ? [
                  {
                      name: 'locale',
                      label: 'Language',
                      value: query.locale,
                      options: [
                          ['', 'Any language'],
                          ...locales.map((locale) => [locale, locale]),
                      ],
                  },
              ]
            : [];

    const selects =
        query.view === 'image'
            ? localeSelects
            : [
                  {
                      name: 'severity',
                      label: 'Severity',
                      value: query.severity,
                      options: [
                          ['', 'Any severity'],
                          ...severities.map((severity) => [
                              severity,
                              severityNames[severity],
                          ]),
                      ],
                  },
                  query.view === 'finding'
                      ? {
                            name: 'area',
                            label: 'Area',
                            value: query.area,
                            options: [
                                ['', 'Any area'],
                                ...Object.entries(areaNames),
                            ],
                        }
                      : {
                            name: 'written',
                            label: 'Written by Citequill',
                            value: query.written,
                            options: [
                                ['', 'Any'],
                                ['yes', 'Yes'],
                                ['no', 'No'],
                            ],
                        },
                  ...localeSelects,
              ];

    if (selects.length === 0) {
        return null;
    }

    return (
        <Form
            action={sectionHref(projectId, 'audit')}
            className="flex flex-wrap items-end gap-3"
        >
            {keptFindingParams(query).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
            ))}
            {query.view === 'page' && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="findings-q">Address</Label>
                    <Input
                        id="findings-q"
                        name="q"
                        type="search"
                        defaultValue={query.q ?? ''}
                        placeholder="https://www.yoursite.com/blog/"
                        className="w-56"
                    />
                </div>
            )}
            {selects.map((select) => (
                <div key={select.name} className="flex flex-col gap-1.5">
                    <Label htmlFor={`findings-${select.name}`}>
                        {select.label}
                    </Label>
                    <Select
                        name={select.name}
                        defaultValue={select.value ?? ''}
                        items={Object.fromEntries(select.options)}
                    >
                        <SelectTrigger
                            id={`findings-${select.name}`}
                            className="w-36"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {select.options.map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ))}
            <Button type="submit" variant="outline">
                <SearchIcon />
                Filter
            </Button>
            {hasFindingFilters(query) && (
                <Button
                    variant="ghost"
                    nativeButton={false}
                    render={
                        <Link
                            href={findingListHref(
                                projectId,
                                Object.fromEntries(keptFindingParams(query)),
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
