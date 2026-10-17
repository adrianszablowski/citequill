import { beforeEach, describe, expect, it, vi } from 'vitest';

import { siteClient } from '@/features/audit/client';
import { firstPace } from '@/features/audit/pacing';
import { closeAudit, discoverSite } from '@/features/audit/steps';
import { finishRun, markProgress } from '@/features/runs/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase } from '@/lib/supabase/fake';

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/runs/steps', () => {
    return { finishRun: vi.fn(async () => {}), markProgress: vi.fn() };
});

vi.mock('@/features/audit/client', () => {
    return { siteClient: vi.fn() };
});

const startedAt = '2026-10-17T10:00:00Z';

function database(runStatus: string) {
    const answers: Record<string, object> = {
        runs: { data: { status: runStatus, started_at: startedAt } },
        projects: {
            data: { domain: 'acme.com', obey_robots: true, bot_secret: 's' },
        },
        project_locales: {
            data: [
                {
                    locale: 'en',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
                {
                    locale: 'de',
                    base_url: 'https://acme.de',
                    is_default: false,
                },
            ],
        },
        audit_queue: { data: [] },
        site_pages: { count: 0 },
    };

    const fake = fakeSupabase(({ name }) => answers[name] ?? {});

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('discoverSite', () => {
    it('reads robots.txt once from every origin the queue admits, each host and its twin over https and http', async () => {
        database('running');

        const read = vi.fn(async (url: string) => ({
            ok: false,
            status: 404,
            url,
            headers: new Headers(),
            body: '',
            hops: [{ url, status: 404 }],
        }));

        vi.mocked(siteClient).mockReturnValue({
            read,
            counts: { requests: 0, tooMany: 0, serverErrors: 0 },
            pace: () => firstPace,
        });

        await discoverSite('project', 'run', 'audit');

        expect(
            read.mock.calls
                .map(([url]) => url)
                .filter((url) => url.endsWith('/robots.txt')),
        ).toEqual(
            [
                'https://acme.com',
                'https://www.acme.com',
                'https://acme.de',
                'https://www.acme.de',
                'http://acme.com',
                'http://www.acme.com',
                'http://acme.de',
                'http://www.acme.de',
            ].map((origin) => `${origin}/robots.txt`),
        );
    });

    it('leaves an audit whose run has ended as it is, without asking the site', async () => {
        const fake = database('failed');

        await discoverSite('project', 'run', 'audit');

        expect(fake.writes()).toEqual([]);
        expect(siteClient).not.toHaveBeenCalled();
        expect(markProgress).not.toHaveBeenCalled();
    });
});

describe('closeAudit', () => {
    it('leaves an audit whose run has ended as it is, its queue to the retention sweep', async () => {
        const fake = database('failed');

        await closeAudit('project', 'run', 'audit');

        expect(fake.writes()).toEqual([]);
        expect(markProgress).not.toHaveBeenCalled();
        expect(finishRun).not.toHaveBeenCalled();
    });

    it('closes a running audit: writes its counters, empties its queue and finishes the run', async () => {
        const fake = database('running');

        await closeAudit('project', 'run', 'audit');

        expect(fake.writes()).toEqual(['update audits', 'delete audit_queue']);
        expect(finishRun).toHaveBeenCalledWith('run');
    });
});
