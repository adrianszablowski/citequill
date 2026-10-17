export type Format = 'bold' | 'italic' | 'heading' | 'list' | 'link';

export interface Selection {
    start: number;
    end: number;
}

export interface Edit {
    start: number;
    end: number;
    text: string;
    selection: Selection;
}

export function applyFormat(
    value: string,
    selection: Selection,
    format: Format,
): Edit {
    switch (format) {
        case 'bold':
            return wrap(value, selection, '**', '**', 'bold text');
        case 'italic':
            return wrap(value, selection, '_', '_', 'italic text');
        case 'link':
            return wrap(value, selection, '[', '](https://)', 'link text');
        case 'heading':
            return prefixLines(value, selection, '## ');
        case 'list':
            return prefixLines(value, selection, '- ');
    }
}

function wrap(
    value: string,
    { start, end }: Selection,
    before: string,
    after: string,
    placeholder: string,
): Edit {
    const selected = value.slice(start, end) || placeholder;

    return {
        start,
        end,
        text: before + selected + after,
        selection: {
            start: start + before.length,
            end: start + before.length + selected.length,
        },
    };
}

function prefixLines(
    value: string,
    { start, end }: Selection,
    prefix: string,
): Edit {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    const lineEndIndex = value.indexOf('\n', end);

    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

    const text = value
        .slice(lineStart, lineEnd)
        .split('\n')
        .map((line) => (line.startsWith(prefix) ? line : prefix + line))
        .join('\n');

    return {
        start: lineStart,
        end: lineEnd,
        text,
        selection: { start: lineStart, end: lineStart + text.length },
    };
}
