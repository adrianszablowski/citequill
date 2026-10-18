import { describe, expect, it } from 'vitest';

import { findingsPerPage } from '@/features/audit/finding';
import { httpsChecks } from '@/features/audit/https-checks';
import { readAuditPage } from '@/features/audit/page';

const home = 'https://acme.com/';
const context = { hosts: ['acme.com', 'www.acme.com'], homes: [home] };

function checksOf(
    html: string,
    url = 'https://acme.com/pricing',
    headers: Record<string, string> = {},
) {
    return httpsChecks(
        url,
        { headers: new Headers(headers), body: html },
        readAuditPage(html, url),
        context,
    );
}

describe('httpsChecks', () => {
    it('finds nothing on an https page whose resources, forms and links stay on https', () => {
        expect(
            checksOf(
                '<html><head><script src="/app.js"></script><link rel="stylesheet" href="https://cdn.com/a.css"></head><body><img src="https://acme.com/a.png"><a href="http://other.com/">Partner</a><form action="/login"><input type="password"></form></body></html>',
            ),
        ).toEqual([]);
    });

    it('reports a script, stylesheet or iframe over http as active mixed content, once per URL, and never a protocol-relative one', () => {
        const findings = checksOf(
            '<html><head><script src="http://cdn.com/a.js"></script><script class="again" src="http://cdn.com/a.js"></script><link rel="stylesheet" href="http://cdn.com/b.css"></head><body><iframe src="http://maps.com/x"></iframe><script src="https://cdn.com/c.js"></script><script src="//cdn.com/d.js"></script></body></html>',
        );

        expect(
            findings.map(({ check, subject, selector }) => [
                check,
                subject,
                selector,
            ]),
        ).toEqual([
            ['mixed-active', 'http://cdn.com/a.js', 'script'],
            ['mixed-active', 'http://cdn.com/b.css', 'link'],
            ['mixed-active', 'http://maps.com/x', 'iframe'],
        ]);

        expect(findings[0].snippet).toBe(
            '<script src="http://cdn.com/a.js"></script>',
        );
    });

    it('reports an image, a srcset candidate, a media source or a poster over http, and a link to an http URL of the site, as passive mixed content, and never a protocol-relative one', () => {
        const findings = checksOf(
            '<html><body><img src="http://acme.com/a.png" srcset="https://acme.com/b.png 1x, http://acme.com/c.png 2x"><img src="//cdn.com/p.png" srcset="//cdn.com/q.png 2x"><video src="http://acme.com/v.mp4" poster="http://acme.com/p.jpg"></video><a href="http://www.acme.com/about">About</a><a href="http://other.com/">Partner</a></body></html>',
        );

        expect(
            findings.map(({ check, subject, detail }) => [
                check,
                subject,
                detail,
            ]),
        ).toEqual([
            [
                'mixed-passive',
                'http://acme.com/a.png',
                { reason: 'resource', total: 5 },
            ],
            [
                'mixed-passive',
                'http://acme.com/c.png',
                { reason: 'resource', total: 5 },
            ],
            [
                'mixed-passive',
                'http://acme.com/v.mp4',
                { reason: 'resource', total: 5 },
            ],
            [
                'mixed-passive',
                'http://acme.com/p.jpg',
                { reason: 'resource', total: 5 },
            ],
            [
                'mixed-passive',
                'http://www.acme.com/about',
                { reason: 'link', total: 5 },
            ],
        ]);
    });

    it('reports no mixed content on an http page, where every resource is over http anyway', () => {
        const checks = checksOf(
            '<html><head><script src="http://acme.com/app.js"></script></head><body><img src="/a.png"></body></html>',
            'http://acme.com/pricing',
        ).map(({ check }) => check);

        expect(checks).toEqual(['https-missing']);
    });

    it('reports every form and a password field outside a form on an http page, and on an https page a form that posts to http', () => {
        const html =
            '<html><body><form class="login" action="/login"><input type="password"></form><form id="search" action="http://acme.com/search"></form><input type="password"></body></html>';

        expect(
            checksOf(html, 'http://acme.com/pricing')
                .filter(({ check }) => check === 'form-on-http')
                .map(({ subject, selector, detail }) => [
                    subject,
                    selector ?? null,
                    detail,
                ]),
        ).toEqual([
            [
                'http://acme.com/login',
                'form.login',
                { reason: 'http-page', hasPassword: true, total: 2 },
            ],
            [
                'http://acme.com/search',
                'form#search',
                { reason: 'http-page', hasPassword: false, total: 2 },
            ],
            [undefined, null, { reason: 'http-page', hasPassword: true }],
        ]);

        expect(
            checksOf(html).map(({ check, subject, detail }) => [
                check,
                subject,
                detail,
            ]),
        ).toEqual([
            [
                'form-on-http',
                'http://acme.com/search',
                { reason: 'http-action', hasPassword: false, total: 1 },
            ],
        ]);
    });

    it('reports two forms with no action on an http page once, as one distinct form', () => {
        expect(
            checksOf(
                '<html><body><form><input name="q"></form><form><input name="email"></form></body></html>',
                'http://acme.com/pricing',
            ).filter(({ check }) => check === 'form-on-http'),
        ).toEqual([
            {
                check: 'form-on-http',
                url: 'http://acme.com/pricing',
                subject: null,
                selector: 'form',
                snippet: expect.any(String),
                detail: { reason: 'http-page', hasPassword: false, total: 1 },
            },
        ]);
    });

    it(`reports ${findingsPerPage} findings per check and page at most, with the total in the detail`, () => {
        const scripts = Array.from(
            { length: findingsPerPage + 1 },
            (_, index) => `<script src="http://cdn.com/${index}.js"></script>`,
        ).join('');

        const findings = checksOf(`<html><head>${scripts}</head></html>`);

        expect(findings).toHaveLength(findingsPerPage);

        expect(
            findings.every(
                ({ check, detail }) =>
                    check === 'mixed-active' &&
                    (detail as { total: number }).total === findingsPerPage + 1,
            ),
        ).toBe(true);
    });

    it('lists the missing security headers of a home page, frame-ancestors standing for X-Frame-Options and a report-only policy standing for nothing', () => {
        const security = (url: string, headers: Record<string, string>) =>
            checksOf('<html></html>', url, headers).filter(
                ({ check }) => check === 'security-headers',
            );

        expect(
            security(home, {
                'strict-transport-security': 'max-age=31536000',
                'content-security-policy': "frame-ancestors 'self'",
                'x-content-type-options': 'nosniff',
                'referrer-policy': 'strict-origin-when-cross-origin',
            }),
        ).toEqual([]);

        expect(
            security(home, {
                'content-security-policy-report-only': "frame-ancestors 'self'",
                'x-frame-options': 'DENY',
            }),
        ).toEqual([
            {
                check: 'security-headers',
                url: home,
                detail: {
                    missing: [
                        'strict-transport-security',
                        'content-security-policy',
                        'x-content-type-options',
                        'referrer-policy',
                    ],
                },
            },
        ]);

        expect(
            httpsChecks(
                'http://acme.com/',
                { headers: new Headers(), body: '' },
                null,
                { ...context, homes: ['http://acme.com/'] },
            ),
        ).toContainEqual({
            check: 'security-headers',
            url: 'http://acme.com/',
            detail: {
                missing: [
                    'content-security-policy',
                    'x-content-type-options',
                    'x-frame-options',
                    'referrer-policy',
                ],
            },
        });

        expect(security('https://acme.com/pricing', {})).toEqual([]);
    });

    it('reports a 200 that is HTML under another Content-Type, after a byte order mark and white space, in any case', () => {
        const typed = (contentType: string | null, body: string) =>
            httpsChecks(
                home,
                {
                    headers: new Headers(
                        contentType ? { 'content-type': contentType } : {},
                    ),
                    body,
                },
                null,
                { ...context, homes: [] },
            );

        for (const body of ['﻿\n  <!DOCTYPE HTML>', '<Html lang="en">']) {
            expect(typed('text/plain', body)).toEqual([
                {
                    check: 'content-type-wrong',
                    url: home,
                    detail: { contentType: 'text/plain' },
                },
            ]);
        }

        expect(typed('application/json', '{"html": true}')).toEqual([]);
        expect(typed(null, '<!doctype html>')).toEqual([]);
        expect(typed('application/xhtml+xml', '<html>')).toEqual([]);
    });
});
