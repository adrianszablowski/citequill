import {
    BarChart3Icon,
    FileTextIcon,
    GaugeIcon,
    NotebookPenIcon,
    ScrollTextIcon,
    SettingsIcon,
} from 'lucide-react';

export const projectSections = [
    { segment: 'pages', title: 'Pages', icon: FileTextIcon },
    { segment: 'skills', title: 'Skills', icon: NotebookPenIcon },
    { segment: 'audit', title: 'Audit', icon: GaugeIcon },
    { segment: 'analytics', title: 'Analytics', icon: BarChart3Icon },
    { segment: 'reports', title: 'Reports', icon: ScrollTextIcon },
    { segment: 'settings', title: 'Settings', icon: SettingsIcon },
] as const;

export type ProjectSection = (typeof projectSections)[number]['segment'];

export function sectionHref(projectId: string, segment: ProjectSection) {
    return `/projects/${projectId}/${segment}` as const;
}

export function skillHref(projectId: string, skillId: string) {
    return `/projects/${projectId}/skills/${skillId}` as const;
}

export function pageHref(projectId: string, pageId: string) {
    return `/projects/${projectId}/pages/${pageId}` as const;
}

export function pageTitle(pathname: string) {
    const segment = pathname.split('/')[3];

    return projectSections.find((section) => section.segment === segment)
        ?.title;
}
