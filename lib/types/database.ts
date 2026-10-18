export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '14.18';
    };
    public: {
        Tables: {
            audit_check_results: {
                Row: {
                    audit_id: string;
                    check: string;
                    pages_checked: number;
                    pages_failed: number;
                    pages_intended: number;
                    project_id: string;
                };
                Insert: {
                    audit_id: string;
                    check: string;
                    pages_checked?: number;
                    pages_failed?: number;
                    pages_intended?: number;
                    project_id: string;
                };
                Update: {
                    audit_id?: string;
                    check?: string;
                    pages_checked?: number;
                    pages_failed?: number;
                    pages_intended?: number;
                    project_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_check_results_audit_id_fkey';
                        columns: ['audit_id'];
                        isOneToOne: false;
                        referencedRelation: 'audits';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'audit_check_results_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audit_findings: {
                Row: {
                    audit_id: string;
                    check: string;
                    detail: Json | null;
                    fingerprint: string;
                    id: string;
                    is_intended: boolean;
                    project_id: string;
                    selector: string | null;
                    severity: string;
                    site_page_id: string | null;
                    snippet: string | null;
                    subject: string | null;
                };
                Insert: {
                    audit_id: string;
                    check: string;
                    detail?: Json | null;
                    fingerprint: string;
                    id?: string;
                    is_intended?: boolean;
                    project_id: string;
                    selector?: string | null;
                    severity: string;
                    site_page_id?: string | null;
                    snippet?: string | null;
                    subject?: string | null;
                };
                Update: {
                    audit_id?: string;
                    check?: string;
                    detail?: Json | null;
                    fingerprint?: string;
                    id?: string;
                    is_intended?: boolean;
                    project_id?: string;
                    selector?: string | null;
                    severity?: string;
                    site_page_id?: string | null;
                    snippet?: string | null;
                    subject?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_findings_audit_id_fkey';
                        columns: ['audit_id'];
                        isOneToOne: false;
                        referencedRelation: 'audits';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'audit_findings_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'audit_findings_site_page_id_fkey';
                        columns: ['site_page_id'];
                        isOneToOne: false;
                        referencedRelation: 'site_pages';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audit_marks: {
                Row: {
                    check: string;
                    created_at: string;
                    id: string;
                    note: string | null;
                    project_id: string;
                    selector: string | null;
                    url: string | null;
                };
                Insert: {
                    check: string;
                    created_at?: string;
                    id?: string;
                    note?: string | null;
                    project_id: string;
                    selector?: string | null;
                    url?: string | null;
                };
                Update: {
                    check?: string;
                    created_at?: string;
                    id?: string;
                    note?: string | null;
                    project_id?: string;
                    selector?: string | null;
                    url?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_marks_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audit_queue: {
                Row: {
                    audit_id: string;
                    depth: number | null;
                    in_sitemap: boolean;
                    inbound_links: number;
                    state: Database['public']['Enums']['audit_queue_state'];
                    url: string;
                };
                Insert: {
                    audit_id: string;
                    depth?: number | null;
                    in_sitemap?: boolean;
                    inbound_links?: number;
                    state?: Database['public']['Enums']['audit_queue_state'];
                    url: string;
                };
                Update: {
                    audit_id?: string;
                    depth?: number | null;
                    in_sitemap?: boolean;
                    inbound_links?: number;
                    state?: Database['public']['Enums']['audit_queue_state'];
                    url?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_queue_audit_id_fkey';
                        columns: ['audit_id'];
                        isOneToOne: false;
                        referencedRelation: 'audits';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audit_renders: {
                Row: {
                    audit_id: string;
                    posted_at: string;
                    result: Json;
                    site_page_id: string;
                };
                Insert: {
                    audit_id: string;
                    posted_at?: string;
                    result: Json;
                    site_page_id: string;
                };
                Update: {
                    audit_id?: string;
                    posted_at?: string;
                    result?: Json;
                    site_page_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audit_renders_audit_id_fkey';
                        columns: ['audit_id'];
                        isOneToOne: false;
                        referencedRelation: 'audits';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'audit_renders_site_page_id_fkey';
                        columns: ['site_page_id'];
                        isOneToOne: false;
                        referencedRelation: 'site_pages';
                        referencedColumns: ['id'];
                    },
                ];
            };
            audits: {
                Row: {
                    checks_scored: number;
                    checks_total: number;
                    created_at: string;
                    duration_s: number | null;
                    hints: number;
                    host_429_count: number;
                    host_5xx_count: number;
                    id: string;
                    is_gated: boolean;
                    is_partial: boolean;
                    pages_indexable: number;
                    pages_read: number;
                    pages_rendered: number;
                    project_id: string;
                    questions: number;
                    render_token_expires_at: string | null;
                    render_token_hash: string | null;
                    request_count: number;
                    robots_rules: Json | null;
                    run_id: string;
                    sandbox_cpu_s: number;
                    sandbox_gb_h: number;
                    sandbox_names: Json | null;
                    score: number | null;
                    severity_1: number;
                    severity_2: number;
                    severity_3: number;
                };
                Insert: {
                    checks_scored?: number;
                    checks_total?: number;
                    created_at?: string;
                    duration_s?: number | null;
                    hints?: number;
                    host_429_count?: number;
                    host_5xx_count?: number;
                    id?: string;
                    is_gated?: boolean;
                    is_partial?: boolean;
                    pages_indexable?: number;
                    pages_read?: number;
                    pages_rendered?: number;
                    project_id: string;
                    questions?: number;
                    render_token_expires_at?: string | null;
                    render_token_hash?: string | null;
                    request_count?: number;
                    robots_rules?: Json | null;
                    run_id: string;
                    sandbox_cpu_s?: number;
                    sandbox_gb_h?: number;
                    sandbox_names?: Json | null;
                    score?: number | null;
                    severity_1?: number;
                    severity_2?: number;
                    severity_3?: number;
                };
                Update: {
                    checks_scored?: number;
                    checks_total?: number;
                    created_at?: string;
                    duration_s?: number | null;
                    hints?: number;
                    host_429_count?: number;
                    host_5xx_count?: number;
                    id?: string;
                    is_gated?: boolean;
                    is_partial?: boolean;
                    pages_indexable?: number;
                    pages_read?: number;
                    pages_rendered?: number;
                    project_id?: string;
                    questions?: number;
                    render_token_expires_at?: string | null;
                    render_token_hash?: string | null;
                    request_count?: number;
                    robots_rules?: Json | null;
                    run_id?: string;
                    sandbox_cpu_s?: number;
                    sandbox_gb_h?: number;
                    sandbox_names?: Json | null;
                    score?: number | null;
                    severity_1?: number;
                    severity_2?: number;
                    severity_3?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'audits_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'audits_run_id_fkey';
                        columns: ['run_id'];
                        isOneToOne: true;
                        referencedRelation: 'runs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            authors: {
                Row: {
                    id: string;
                    name: string;
                    project_id: string;
                    title: string | null;
                    url: string | null;
                };
                Insert: {
                    id?: string;
                    name: string;
                    project_id: string;
                    title?: string | null;
                    url?: string | null;
                };
                Update: {
                    id?: string;
                    name?: string;
                    project_id?: string;
                    title?: string | null;
                    url?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'authors_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            crawled_pages: {
                Row: {
                    body: string | null;
                    crawled_at: string;
                    error: string | null;
                    id: string;
                    locale: string | null;
                    project_id: string;
                    reader_body: string | null;
                    signals: Json | null;
                    title: string | null;
                    url: string;
                };
                Insert: {
                    body?: string | null;
                    crawled_at?: string;
                    error?: string | null;
                    id?: string;
                    locale?: string | null;
                    project_id: string;
                    reader_body?: string | null;
                    signals?: Json | null;
                    title?: string | null;
                    url: string;
                };
                Update: {
                    body?: string | null;
                    crawled_at?: string;
                    error?: string | null;
                    id?: string;
                    locale?: string | null;
                    project_id?: string;
                    reader_body?: string | null;
                    signals?: Json | null;
                    title?: string | null;
                    url?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'crawled_pages_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            page_kinds: {
                Row: {
                    author_id: string | null;
                    id: string;
                    name: string;
                    project_id: string;
                    skill_id: string;
                    url_prefix: string;
                };
                Insert: {
                    author_id?: string | null;
                    id?: string;
                    name: string;
                    project_id: string;
                    skill_id: string;
                    url_prefix?: string;
                };
                Update: {
                    author_id?: string | null;
                    id?: string;
                    name?: string;
                    project_id?: string;
                    skill_id?: string;
                    url_prefix?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'page_kinds_author_id_fkey';
                        columns: ['author_id'];
                        isOneToOne: false;
                        referencedRelation: 'authors';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'page_kinds_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'page_kinds_skill_id_fkey';
                        columns: ['skill_id'];
                        isOneToOne: false;
                        referencedRelation: 'skills';
                        referencedColumns: ['id'];
                    },
                ];
            };
            pages: {
                Row: {
                    author_id: string | null;
                    body_html: string | null;
                    body_md: string;
                    check_note: string | null;
                    created_at: string;
                    excerpt: string;
                    faq: Json;
                    id: string;
                    kind_id: string | null;
                    locale: string;
                    meta_description: string;
                    meta_title: string;
                    project_id: string;
                    published_at: string | null;
                    reading_minutes: number;
                    redirect_to: string | null;
                    run_id: string | null;
                    slug: string;
                    sources: Json;
                    status: Database['public']['Enums']['page_status'];
                    tags: string[];
                    title: string;
                    translation_group_id: string;
                    unpublished_at: string | null;
                    updated_at: string;
                };
                Insert: {
                    author_id?: string | null;
                    body_html?: string | null;
                    body_md: string;
                    check_note?: string | null;
                    created_at?: string;
                    excerpt?: string;
                    faq?: Json;
                    id?: string;
                    kind_id?: string | null;
                    locale: string;
                    meta_description?: string;
                    meta_title?: string;
                    project_id: string;
                    published_at?: string | null;
                    reading_minutes?: number;
                    redirect_to?: string | null;
                    run_id?: string | null;
                    slug: string;
                    sources?: Json;
                    status?: Database['public']['Enums']['page_status'];
                    tags?: string[];
                    title: string;
                    translation_group_id?: string;
                    unpublished_at?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author_id?: string | null;
                    body_html?: string | null;
                    body_md?: string;
                    check_note?: string | null;
                    created_at?: string;
                    excerpt?: string;
                    faq?: Json;
                    id?: string;
                    kind_id?: string | null;
                    locale?: string;
                    meta_description?: string;
                    meta_title?: string;
                    project_id?: string;
                    published_at?: string | null;
                    reading_minutes?: number;
                    redirect_to?: string | null;
                    run_id?: string | null;
                    slug?: string;
                    sources?: Json;
                    status?: Database['public']['Enums']['page_status'];
                    tags?: string[];
                    title?: string;
                    translation_group_id?: string;
                    unpublished_at?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'pages_author_id_fkey';
                        columns: ['author_id'];
                        isOneToOne: false;
                        referencedRelation: 'authors';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'pages_kind_id_fkey';
                        columns: ['kind_id'];
                        isOneToOne: false;
                        referencedRelation: 'page_kinds';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'pages_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'pages_run_id_fkey';
                        columns: ['run_id'];
                        isOneToOne: false;
                        referencedRelation: 'runs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            project_locales: {
                Row: {
                    base_url: string;
                    id: string;
                    is_default: boolean;
                    locale: string;
                    project_id: string;
                };
                Insert: {
                    base_url: string;
                    id?: string;
                    is_default?: boolean;
                    locale: string;
                    project_id: string;
                };
                Update: {
                    base_url?: string;
                    id?: string;
                    is_default?: boolean;
                    locale?: string;
                    project_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'project_locales_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            projects: {
                Row: {
                    bot_secret: string;
                    created_at: string;
                    domain: string;
                    id: string;
                    name: string;
                    obey_robots: boolean;
                    user_id: string;
                };
                Insert: {
                    bot_secret?: string;
                    created_at?: string;
                    domain: string;
                    id?: string;
                    name: string;
                    obey_robots?: boolean;
                    user_id?: string;
                };
                Update: {
                    bot_secret?: string;
                    created_at?: string;
                    domain?: string;
                    id?: string;
                    name?: string;
                    obey_robots?: boolean;
                    user_id?: string;
                };
                Relationships: [];
            };
            runs: {
                Row: {
                    cost_usd: number;
                    error: string | null;
                    finished_at: string | null;
                    id: string;
                    input_tokens: number;
                    kind_id: string | null;
                    locale: string | null;
                    output_tokens: number;
                    plan: Json | null;
                    progressed_at: string | null;
                    project_id: string;
                    started_at: string;
                    status: Database['public']['Enums']['run_status'];
                    topic: string | null;
                    trigger: Database['public']['Enums']['run_trigger'];
                    workflow_run_id: string | null;
                };
                Insert: {
                    cost_usd?: number;
                    error?: string | null;
                    finished_at?: string | null;
                    id?: string;
                    input_tokens?: number;
                    kind_id?: string | null;
                    locale?: string | null;
                    output_tokens?: number;
                    plan?: Json | null;
                    progressed_at?: string | null;
                    project_id: string;
                    started_at?: string;
                    status?: Database['public']['Enums']['run_status'];
                    topic?: string | null;
                    trigger: Database['public']['Enums']['run_trigger'];
                    workflow_run_id?: string | null;
                };
                Update: {
                    cost_usd?: number;
                    error?: string | null;
                    finished_at?: string | null;
                    id?: string;
                    input_tokens?: number;
                    kind_id?: string | null;
                    locale?: string | null;
                    output_tokens?: number;
                    plan?: Json | null;
                    progressed_at?: string | null;
                    project_id?: string;
                    started_at?: string;
                    status?: Database['public']['Enums']['run_status'];
                    topic?: string | null;
                    trigger?: Database['public']['Enums']['run_trigger'];
                    workflow_run_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'runs_kind_id_fkey';
                        columns: ['kind_id'];
                        isOneToOne: false;
                        referencedRelation: 'page_kinds';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'runs_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            site_pages: {
                Row: {
                    body_hash: string | null;
                    canonical_url: string | null;
                    click_depth: number | null;
                    description: string | null;
                    final_url: string | null;
                    first_seen_at: string;
                    hreflang: Json | null;
                    id: string;
                    image_count: number;
                    in_sitemap: boolean;
                    inbound_links: number;
                    is_blocked: boolean;
                    is_gone: boolean;
                    is_indexable: boolean;
                    last_audit_id: string | null;
                    last_seen_at: string;
                    locale: string | null;
                    page_id: string | null;
                    project_id: string;
                    raw_extract: Json | null;
                    redirect_to: string | null;
                    status_code: number | null;
                    title: string | null;
                    url: string;
                };
                Insert: {
                    body_hash?: string | null;
                    canonical_url?: string | null;
                    click_depth?: number | null;
                    description?: string | null;
                    final_url?: string | null;
                    first_seen_at?: string;
                    hreflang?: Json | null;
                    id?: string;
                    image_count?: number;
                    in_sitemap?: boolean;
                    inbound_links?: number;
                    is_blocked?: boolean;
                    is_gone?: boolean;
                    is_indexable?: boolean;
                    last_audit_id?: string | null;
                    last_seen_at?: string;
                    locale?: string | null;
                    page_id?: string | null;
                    project_id: string;
                    raw_extract?: Json | null;
                    redirect_to?: string | null;
                    status_code?: number | null;
                    title?: string | null;
                    url: string;
                };
                Update: {
                    body_hash?: string | null;
                    canonical_url?: string | null;
                    click_depth?: number | null;
                    description?: string | null;
                    final_url?: string | null;
                    first_seen_at?: string;
                    hreflang?: Json | null;
                    id?: string;
                    image_count?: number;
                    in_sitemap?: boolean;
                    inbound_links?: number;
                    is_blocked?: boolean;
                    is_gone?: boolean;
                    is_indexable?: boolean;
                    last_audit_id?: string | null;
                    last_seen_at?: string;
                    locale?: string | null;
                    page_id?: string | null;
                    project_id?: string;
                    raw_extract?: Json | null;
                    redirect_to?: string | null;
                    status_code?: number | null;
                    title?: string | null;
                    url?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'site_pages_last_audit_id_fkey';
                        columns: ['last_audit_id'];
                        isOneToOne: false;
                        referencedRelation: 'audits';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'site_pages_page_id_fkey';
                        columns: ['page_id'];
                        isOneToOne: false;
                        referencedRelation: 'pages';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'site_pages_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
            skills: {
                Row: {
                    body: string;
                    description: string;
                    id: string;
                    is_product: boolean;
                    name: string;
                    project_id: string;
                    updated_at: string;
                };
                Insert: {
                    body?: string;
                    description?: string;
                    id?: string;
                    is_product?: boolean;
                    name: string;
                    project_id: string;
                    updated_at?: string;
                };
                Update: {
                    body?: string;
                    description?: string;
                    id?: string;
                    is_product?: boolean;
                    name?: string;
                    project_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'skills_project_id_fkey';
                        columns: ['project_id'];
                        isOneToOne: false;
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            add_run_usage: {
                Args: {
                    cost: number;
                    input: number;
                    output: number;
                    run: string;
                };
                Returns: undefined;
            };
            audit_check_list: {
                Args: { audit: string; locale?: string };
                Returns: {
                    check: string;
                    pages_failed: number;
                    pages_intended: number;
                    severity: string;
                    severity_rank: number;
                }[];
            };
            audit_page_list: {
                Args: { audit: string };
                Returns: {
                    canonical_url: string;
                    findings: number;
                    hints: number;
                    id: string;
                    locale: string;
                    page_id: string;
                    questions: number;
                    severity_1: number;
                    severity_2: number;
                    severity_3: number;
                    status_code: number;
                    title: string;
                    url: string;
                }[];
            };
            create_audit: { Args: { run: string }; Returns: string };
            is_project_owner: { Args: { project: string }; Returns: boolean };
            score_audit: {
                Args: {
                    audit: string;
                    checks_scored: number;
                    checks_total: number;
                    hints: number;
                    intended: string[];
                    is_gated: boolean;
                    questions: number;
                    results: Json;
                    score: number;
                    severity_1: number;
                    severity_2: number;
                    severity_3: number;
                };
                Returns: undefined;
            };
            stop_audit: { Args: { audit: string }; Returns: undefined };
        };
        Enums: {
            audit_queue_state: 'queued' | 'read' | 'blocked';
            page_status: 'draft' | 'published' | 'unpublished';
            run_status: 'running' | 'finished' | 'failed';
            run_trigger: 'crawl' | 'weekly' | 'manual' | 'audit';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
    keyof Database,
    'public'
>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends (DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {
            audit_queue_state: ['queued', 'read', 'blocked'],
            page_status: ['draft', 'published', 'unpublished'],
            run_status: ['running', 'finished', 'failed'],
            run_trigger: ['crawl', 'weekly', 'manual', 'audit'],
        },
    },
} as const;
