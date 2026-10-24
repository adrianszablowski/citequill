'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import SaveButton from '@/components/save-button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updateOrganization } from '@/features/projects/actions';
import NotSet from '@/features/projects/components/not-set';
import {
    organizationSchema,
    type OrganizationValues,
} from '@/features/projects/schema';
import type { Logo } from '@/features/publishing/logo';

interface OrganizationFormProps {
    projectId: string;
    values: OrganizationValues;
    defaults: { name: string; url: string | null };
    logo: Logo | null;
    warning: string | null;
}

export default function OrganizationForm({
    projectId,
    values,
    defaults,
    logo,
    warning,
}: Readonly<OrganizationFormProps>) {
    const [checkWarning, setCheckWarning] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(organizationSchema, undefined, { raw: true }),
        defaultValues: values,
    });

    async function onSubmit(organization: OrganizationValues) {
        const result = await updateOrganization(projectId, organization);

        if ('values' in result) {
            reset(result.values);
            setCheckWarning(result.warning ?? null);
            setNotice(result.notice ?? null);
        } else {
            setError(result.field ?? 'root', { message: result.error });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>
                    The company that runs the site, with its logo and its
                    profiles on other sites.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="organization-name"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    <FieldDescription>
                                        Left empty, it is the project&apos;s
                                        name, {defaults.name}.
                                    </FieldDescription>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="url"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-url">
                                        URL
                                    </FieldLabel>
                                    <Input
                                        id="organization-url"
                                        type="url"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="https://www.yoursite.com"
                                        {...field}
                                    />
                                    {defaults.url && (
                                        <FieldDescription>
                                            Left empty, it is {defaults.url},
                                            the site in its main language.
                                        </FieldDescription>
                                    )}
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="logo_url"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-logo">
                                        Logo
                                    </FieldLabel>
                                    <Input
                                        id="organization-logo"
                                        type="url"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="https://www.yoursite.com/logo.png"
                                        {...field}
                                    />
                                    <FieldDescription>
                                        Citequill checks the image when you
                                        save, and shows it in the sidebar.
                                    </FieldDescription>
                                    <FieldDescription>
                                        {logo ? (
                                            `The logo is ${logo.width} by ${logo.height} px.`
                                        ) : (
                                            <NotSet />
                                        )}
                                    </FieldDescription>
                                    {[checkWarning, warning].map(
                                        (line) =>
                                            line && (
                                                <p
                                                    key={line}
                                                    className="text-sm text-amber-700 dark:text-amber-400"
                                                >
                                                    {line}
                                                </p>
                                            ),
                                    )}
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="same_as"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="organization-same-as">
                                        Profiles
                                    </FieldLabel>
                                    <Textarea
                                        id="organization-same-as"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="https://www.linkedin.com/company/yoursite"
                                        {...field}
                                    />
                                    <FieldDescription>
                                        One address a line, such as the
                                        company&apos;s page on LinkedIn or X.
                                    </FieldDescription>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        {errors.root && <FieldError errors={[errors.root]} />}
                        <SaveButton control={control} />
                        {notice && (
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                                {notice}
                            </p>
                        )}
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
