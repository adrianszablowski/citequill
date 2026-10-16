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
                    created_at: string;
                    domain: string;
                    id: string;
                    name: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    domain: string;
                    id?: string;
                    name: string;
                    user_id?: string;
                };
                Update: {
                    created_at?: string;
                    domain?: string;
                    id?: string;
                    name?: string;
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
                    project_id: string;
                    started_at: string;
                    status: Database['public']['Enums']['run_status'];
                    topic: string | null;
                    trigger: Database['public']['Enums']['run_trigger'];
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
                    project_id: string;
                    started_at?: string;
                    status?: Database['public']['Enums']['run_status'];
                    topic?: string | null;
                    trigger: Database['public']['Enums']['run_trigger'];
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
                    project_id?: string;
                    started_at?: string;
                    status?: Database['public']['Enums']['run_status'];
                    topic?: string | null;
                    trigger?: Database['public']['Enums']['run_trigger'];
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
            is_project_owner: { Args: { project: string }; Returns: boolean };
        };
        Enums: {
            page_status: 'draft' | 'published' | 'unpublished';
            run_status: 'running' | 'finished' | 'failed';
            run_trigger: 'crawl' | 'weekly' | 'manual';
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
            page_status: ['draft', 'published', 'unpublished'],
            run_status: ['running', 'finished', 'failed'],
            run_trigger: ['crawl', 'weekly', 'manual'],
        },
    },
} as const;
