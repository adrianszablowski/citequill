import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import BotContact from '@/features/crawl/components/bot-contact';

function render(email?: string) {
    return renderToStaticMarkup(createElement(BotContact, { email }));
}

describe('BotContact', () => {
    it('links to the address it is given and shows it as text', () => {
        const html = render('hello@citequill.com');

        expect(html).toContain('href="mailto:hello@citequill.com"');
        expect(html).toContain('>hello@citequill.com</a>');
    });

    it('renders nothing when the address is empty', () => {
        expect(render('')).toBe('');
    });

    it('renders nothing when the address is unset', () => {
        expect(render()).toBe('');
    });
});
