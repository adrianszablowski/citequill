---
paths:
    - 'features/**/components/*.tsx'
    - 'components/*.tsx'
---

# Forms

React Hook Form holds every state a form has, and `formState` is a Proxy: a component is subscribed
to the fields it reads during render, and only to those. A form reads its state from there.

## A form with fields

```tsx
const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
} = useForm({ resolver: zodResolver(skillSchema), defaultValues });

async function onSubmit(values: SkillValues) {
    const result = await updateSkill(skill.id, values);

    if (result.error) {
        setError('root', { message: result.error });
    } else {
        reset(result.values);
    }
}
```

- `useForm` takes no generic: `zodResolver(schema)` types the values from the schema in
  `features/<domain>/schema.ts`, input and output apart. `import * as z from 'zod'`.
- Destructure what the component renders, the `formState` fields inside the destructuring. A field
  first read behind `&&` or `||` is not subscribed.
- `isSubmitting` is the pending state and `errors.root` is the action's error; the next submit clears
  it. A form whose action redirects keeps its button pending on `isSubmitting || isSubmitSuccessful`,
  because the action's call settles before the new page is on screen.
- `reset(result.values)` after a save that keeps the form on screen: the saved values become the
  defaults and `isDirty` returns to false.
- Each field is a `Controller` rendering `Field` with `data-invalid={fieldState.invalid}`,
  `FieldLabel`, the control, and `FieldError errors={[fieldState.error]}` when invalid. A native
  control (`Input`, `Textarea`) takes `{...field}` and `aria-invalid={fieldState.invalid}`. A Base UI
  control that is not a native input (`Select`) takes `name`, `value`,
  `onValueChange={field.onChange}` and `inputRef={field.ref}`, with `aria-invalid` on its trigger.
- A submit button in its own file takes `control` and reads `useFormState({ control })`, so a flip
  of `isSubmitting` or `isDirty` re-renders the button alone. `SaveButton` in
  `components/save-button.tsx` is the one for a form that edits a row: disabled until dirty and while
  submitting. Only the button is disabled while submitting; a disabled input drops out of the values.
- A live value, for a preview or a count, comes from `useWatch({ control, name })` inside the
  component that renders it.
- `useState` holds a UI mode the form does not own: a dialog open, an editor in preview.

## A form that only changes the URL

A filter form is a navigation, not a form React Hook Form owns: `<Form action={href}>` from `next/form`, the section's own href,
with named inputs, a `Select` with `name` and `defaultValue`, hidden inputs for the parameters it
keeps, and a submit button. It renders on the server from the parsed search parameters.

## A form with no fields

One button that calls an action is `<form action={action}>` in a server component, with the button
in its own client file reading `pending` from `useFormStatus()`. Pending and result come from these
two hooks; `useActionState` fits neither shape.
