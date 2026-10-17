import { describe, expect, it } from 'vitest';

import { applyFormat, type Edit } from '@/features/pages/markdown-edit';

describe('applyFormat', () => {
    it('wraps the selection in bold and keeps it selected without the marks', () => {
        const value = 'lift it';

        const edit = applyFormat(value, { start: 0, end: 4 }, 'bold');

        expect(applied(value, edit)).toBe('**lift** it');
        expect(edit.selection).toEqual({ start: 2, end: 6 });
    });

    it('inserts a placeholder for an empty selection and selects it, so typing replaces it', () => {
        const value = 'a  b';

        const edit = applyFormat(value, { start: 2, end: 2 }, 'italic');

        expect(applied(value, edit)).toBe('a _italic text_ b');
        expect(edit.selection).toEqual({ start: 3, end: 14 });
    });

    it('turns the selection into link text with an address to fill in', () => {
        const value = 'see pricing';

        const edit = applyFormat(value, { start: 4, end: 11 }, 'link');

        expect(applied(value, edit)).toBe('see [pricing](https://)');
    });

    it('replaces only the line the caret is on when making a heading', () => {
        const value = 'intro\nhow much\nmore';

        const edit = applyFormat(value, { start: 9, end: 9 }, 'heading');

        expect(edit).toMatchObject({ start: 6, end: 14, text: '## how much' });
        expect(applied(value, edit)).toBe('intro\n## how much\nmore');
    });

    it('prefixes every selected line as a list item once', () => {
        const value = 'one\n- two\nthree';

        const edit = applyFormat(value, { start: 0, end: 13 }, 'list');

        expect(applied(value, edit)).toBe('- one\n- two\n- three');
        expect(edit.selection).toEqual({ start: 0, end: 19 });
    });

    it('prefixes the last line of the text, which has no newline after it', () => {
        const value = 'one\ntwo';

        const edit = applyFormat(value, { start: 5, end: 5 }, 'list');

        expect(applied(value, edit)).toBe('one\n- two');
    });
});

function applied(value: string, edit: Edit) {
    return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}
