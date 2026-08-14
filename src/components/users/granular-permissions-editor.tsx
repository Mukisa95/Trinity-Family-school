"use client";

import React, { useMemo } from "react";
import { CheckCircle2, LayoutGrid, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_ACTIONS } from "@/types/permissions";
import { ModulePermissions, PagePermission } from "@/types";

interface GranularPermissionsEditorProps {
  permissions: ModulePermissions[];
  onChange: (permissions: ModulePermissions[]) => void;
  modules?: string[];
}

type ModuleId = keyof typeof MODULE_ACTIONS;

type PermissionScope = {
  id: string;
  title: string;
  description: string;
  moduleId: ModuleId;
  pageIds?: string[];
};

type PermissionGroup = {
  id: string;
  title: string;
  description?: string;
  scopes: PermissionScope[];
};

type PermissionSection = {
  id: string;
  title: string;
  description: string;
  groups: PermissionGroup[];
};

// This mirrors the sidebar: main section, menu group, then the submenu/feature
// the user actually sees. A feature can expose just the relevant pages from a
// module, which keeps sensitive pages such as Seeding deliberately separate.
const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    id: "overview",
    title: "Overview",
    description: "Dashboard, timetable, and calendar access.",
    groups: [
      { id: "dashboard", title: "Dashboard", scopes: [{ id: "dashboard", title: "Dashboard", description: "Overview statistics and reports.", moduleId: "reports", pageIds: ["dashboard"] }] },
      { id: "timetable", title: "Timetable", scopes: [{ id: "timetable", title: "Timetable", description: "School timetable and live tracking.", moduleId: "timetable" }] },
      { id: "events", title: "Events & Calendar", scopes: [{ id: "events", title: "Events & Calendar", description: "School events and calendar entries.", moduleId: "events" }] },
    ],
  },
  {
    id: "academics",
    title: "Academics",
    description: "Pupils, learning, teaching, and academic operations.",
    groups: [
      {
        id: "pupils",
        title: "Pupils",
        description: "Matches the Pupils menu in the sidebar.",
        scopes: [
          { id: "pupil-management", title: "Pupils Management", description: "Pupil lists, registration, editing, and profiles.", moduleId: "pupils", pageIds: ["list", "create", "edit", "detail"] },
          { id: "attendance", title: "Attendance", description: "Daily pupil attendance.", moduleId: "attendance" },
          { id: "birthdays", title: "Birthdays", description: "Pupil birthday calendar.", moduleId: "pupils", pageIds: ["birthdays"] },
          { id: "in-house", title: "In-House", description: "Boarding pupils and dormitory management.", moduleId: "boarding" },
          { id: "promote-demote", title: "Promote/Demote", description: "Pupil promotion, demotion, and transfers.", moduleId: "promotion" },
          { id: "enrollment-trends", title: "Enrollment Trends", description: "Historic pupil enrollment charts.", moduleId: "pupils", pageIds: ["enrollment_trends"] },
          { id: "pupil-history", title: "Pupil History", description: "Pupil history records.", moduleId: "pupil_history" },
        ],
      },
      { id: "staff", title: "Staff", scopes: [{ id: "staff", title: "Staff", description: "Staff records and management.", moduleId: "staff" }] },
      {
        id: "classes",
        title: "Classes",
        scopes: [
          { id: "classes", title: "Classes", description: "Classes, teachers, and class assignments.", moduleId: "classes" },
          { id: "subjects", title: "Subjects", description: "Subject setup used by classes and exams.", moduleId: "subjects" },
        ],
      },
      { id: "exams", title: "Exams", scopes: [{ id: "exams", title: "Exams", description: "Exams and results.", moduleId: "exams" }] },
      { id: "docx", title: "DocX", scopes: [{ id: "docx", title: "DocX", description: "Create personalised printable pupil documents.", moduleId: "reports", pageIds: ["docx"] }] },
      { id: "duty-service", title: "Duty & Service", scopes: [{ id: "duty-service", title: "Duty & Service", description: "Duty and service records.", moduleId: "duty_service" }] },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    description: "The Accounts menu and its finance submenus.",
    groups: [
      {
        id: "accounts",
        title: "Accounts",
        description: "Matches the Accounts menu in the sidebar.",
        scopes: [
          { id: "collect-fees", title: "Collect Fees", description: "Fee collection and individual payments.", moduleId: "fees", pageIds: ["collection", "collect"] },
          { id: "collection-analytics", title: "Collection Analytics", description: "Fee collection analytics.", moduleId: "fees", pageIds: ["analytics"] },
          { id: "schoolpay-feed", title: "SchoolPay Feed", description: "SchoolPay transaction feed.", moduleId: "fees", pageIds: ["schoolpay_feed"] },
          { id: "banking", title: "Banking", description: "Bank accounts and loans.", moduleId: "banking" },
          { id: "procurement", title: "Procurement", description: "Items, purchases, and budgets.", moduleId: "procurement" },
          { id: "assign", title: "Assign", description: "Pupil fee assignments, discounts, and family accounts.", moduleId: "fees", pageIds: ["list"] },
          { id: "inventory", title: "Inventory", description: "Inventory, uniforms, and requirements tracking.", moduleId: "inventory" },
          { id: "uniforms", title: "Uniforms", description: "Uniform setup and issue tracking.", moduleId: "uniforms" },
          { id: "requirements", title: "Requirements", description: "Requirements setup and pupil tracking.", moduleId: "requirements" },
        ],
      },
    ],
  },
  {
    id: "communications",
    title: "Communications",
    description: "The Communications menu and internal messaging tools.",
    groups: [
      {
        id: "communications-menu",
        title: "Communications",
        description: "Matches the Communications menu in the sidebar.",
        scopes: [
          { id: "bulk-sms", title: "Bulk SMS", description: "Bulk SMS messaging.", moduleId: "bulk_sms" },
          { id: "push-notifications", title: "Push Notifications", description: "In-system notification delivery.", moduleId: "notifications" },
          { id: "commentary", title: "Internal Commentary", description: "Internal commentary and notices.", moduleId: "commentary" },
        ],
      },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    description: "The Settings menu and school administration controls.",
    groups: [
      {
        id: "settings",
        title: "Settings",
        description: "Matches the Settings menu in the sidebar.",
        scopes: [
          { id: "users", title: "Users", description: "User accounts and roles.", moduleId: "users" },
          { id: "access-levels", title: "Access Levels", description: "Detailed access-level configuration.", moduleId: "access_levels" },
          { id: "accounts-settings", title: "Accounts", description: "Fee structures and account setup.", moduleId: "fees", pageIds: ["list"] },
          { id: "academic-setup", title: "Academic Setup", description: "Academic years and terms.", moduleId: "academic_years" },
          { id: "seeding", title: "Seeding", description: "Historical pupil seeding. This remains hidden from every non-admin until explicitly granted here.", moduleId: "pupils", pageIds: ["historical_seeding"] },
          { id: "about-school", title: "About School", description: "School profile and settings.", moduleId: "settings" },
          { id: "history-log", title: "History Log", description: "System activity history and audit records.", moduleId: "account", pageIds: ["history_log"] },
          { id: "my-profile", title: "My Profile", description: "Signed-in user profile and password controls.", moduleId: "account", pageIds: ["profile"] },
          { id: "change-log", title: "Change Log", description: "Application change notes.", moduleId: "account", pageIds: ["changelog"] },
        ],
      },
    ],
  },
];

function clonePermissions(permissions: ModulePermissions[]) {
  return permissions.map((module) => ({
    ...module,
    pages: module.pages.map((page) => ({
      ...page,
      actions: page.actions.map((action) => ({ ...action })),
    })),
  }));
}

export function GranularPermissionsEditor({ permissions, onChange, modules }: GranularPermissionsEditorProps) {
  const visibleSections = useMemo(() => {
    if (!modules) return PERMISSION_SECTIONS;

    return PERMISSION_SECTIONS.map((section) => ({
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        scopes: group.scopes.filter((scope) => modules.includes(scope.moduleId)),
      })).filter((group) => group.scopes.length > 0),
    })).filter((section) => section.groups.length > 0);
  }, [modules]);

  const getModulePermissions = (moduleId: string) => permissions.find((permission) => permission.moduleId === moduleId);

  const getPagePermissions = (moduleId: string, pageId: string): PagePermission | undefined =>
    getModulePermissions(moduleId)?.pages.find((page) => page.pageId === pageId);

  const getScopePages = (scope: PermissionScope) => {
    const module = MODULE_ACTIONS[scope.moduleId];
    return scope.pageIds ? module.pages.filter((page) => scope.pageIds?.includes(page.page)) : module.pages;
  };

  const getScopeStats = (scope: PermissionScope) => {
    const pages = getScopePages(scope);
    const totalActions = pages.reduce((total, page) => total + page.actions.length, 0);
    const allowedActions = pages.reduce((total, page) => {
      const permission = getPagePermissions(scope.moduleId, page.page);
      return total + (permission?.canAccess ? permission.actions.filter((action) => action.allowed).length : 0);
    }, 0);
    const allowedPages = pages.filter((page) => getPagePermissions(scope.moduleId, page.page)?.canAccess).length;

    return {
      allowedPages,
      totalPages: pages.length,
      allowedActions,
      totalActions,
      fullyGranted: pages.length > 0 && allowedPages === pages.length && allowedActions === totalActions,
      hasAnyAccess: allowedPages > 0 || allowedActions > 0,
    };
  };

  const getGroupScopes = (group: PermissionGroup) => group.scopes;
  const getSectionScopes = (section: PermissionSection) => section.groups.flatMap((group) => group.scopes);

  const getAggregateState = (scopes: PermissionScope[]) => {
    const stats = scopes.map(getScopeStats);
    const fullyGranted = stats.length > 0 && stats.every((stat) => stat.fullyGranted);
    const hasAnyAccess = stats.some((stat) => stat.hasAnyAccess);
    return { fullyGranted, hasAnyAccess };
  };

  const setPagesAccess = (draft: ModulePermissions[], scope: PermissionScope, grant: boolean) => {
    const moduleConfig = MODULE_ACTIONS[scope.moduleId];
    let modulePermission = draft.find((permission) => permission.moduleId === scope.moduleId);

    for (const pageConfig of getScopePages(scope)) {
      if (!modulePermission) {
        if (!grant) continue;
        modulePermission = { moduleId: scope.moduleId, pages: [] };
        draft.push(modulePermission);
      }

      const existingPage = modulePermission.pages.find((page) => page.pageId === pageConfig.page);
      if (!existingPage) {
        if (!grant) continue;
        modulePermission.pages.push({
          pageId: pageConfig.page,
          canAccess: true,
          actions: pageConfig.actions.map((action) => ({ actionId: action.id, allowed: true })),
        });
        continue;
      }

      existingPage.canAccess = grant;
      existingPage.actions = pageConfig.actions.map((action) => ({ actionId: action.id, allowed: grant }));
    }
  };

  const handleScopeAccessChange = (scope: PermissionScope, grant: boolean) => {
    const draft = clonePermissions(permissions);
    setPagesAccess(draft, scope, grant);
    onChange(draft);
  };

  const handlePageAccessChange = (scope: PermissionScope, pageId: string, grant: boolean) => {
    const pageScope = { ...scope, pageIds: [pageId] };
    const draft = clonePermissions(permissions);
    setPagesAccess(draft, pageScope, grant);
    onChange(draft);
  };

  const handleActionChange = (scope: PermissionScope, pageId: string, actionId: string, allowed: boolean) => {
    const draft = clonePermissions(permissions);
    let modulePermission = draft.find((permission) => permission.moduleId === scope.moduleId);
    const pageConfig = MODULE_ACTIONS[scope.moduleId].pages.find((page) => page.page === pageId);
    if (!pageConfig) return;

    if (!modulePermission) {
      if (!allowed) return;
      modulePermission = { moduleId: scope.moduleId, pages: [] };
      draft.push(modulePermission);
    }

    let pagePermission = modulePermission.pages.find((page) => page.pageId === pageId);
    if (!pagePermission) {
      if (!allowed) return;
      pagePermission = {
        pageId,
        canAccess: true,
        actions: pageConfig.actions.map((action) => ({ actionId: action.id, allowed: action.id === actionId })),
      };
      modulePermission.pages.push(pagePermission);
    } else {
      pagePermission.canAccess = allowed || pagePermission.canAccess;
      const action = pagePermission.actions.find((item) => item.actionId === actionId);
      if (action) action.allowed = allowed;
      else pagePermission.actions.push({ actionId, allowed });
    }

    onChange(draft);
  };

  const handleScopesAccessChange = (scopes: PermissionScope[], grant: boolean) => {
    const draft = clonePermissions(permissions);
    scopes.forEach((scope) => setPagesAccess(draft, scope, grant));
    onChange(draft);
  };

  const allScopes = visibleSections.flatMap(getSectionScopes);
  const systemState = getAggregateState(allScopes);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-5">
          <Checkbox
            id="system-access"
            checked={systemState.fullyGranted ? true : systemState.hasAnyAccess ? "indeterminate" : false}
            onCheckedChange={(checked) => handleScopesAccessChange(allScopes, checked === true)}
            className="mt-0.5 h-5 w-5 border-primary/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          />
          <div className="space-y-1">
            <Label htmlFor="system-access" className="cursor-pointer text-base font-semibold">Grant full system access</Label>
            <p className="text-sm text-muted-foreground">Grants every permission shown in the sidebar-based structure below.</p>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="w-full space-y-4">
        {visibleSections.map((section) => {
          const sectionScopes = getSectionScopes(section);
          const sectionState = getAggregateState(sectionScopes);

          return (
            <AccordionItem key={section.id} value={section.id} className="rounded-xl border bg-card px-4">
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-4 text-left">
                  <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      id={`section-${section.id}`}
                      checked={sectionState.fullyGranted ? true : sectionState.hasAnyAccess ? "indeterminate" : false}
                      onCheckedChange={(checked) => handleScopesAccessChange(sectionScopes, checked === true)}
                    />
                  </span>
                  <LayoutGrid className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <Label htmlFor={`section-${section.id}`} className="cursor-pointer text-lg font-semibold">{section.title}</Label>
                    <p className="text-sm font-normal text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  {section.groups.map((group) => {
                    const groupScopes = getGroupScopes(group);
                    const groupState = getAggregateState(groupScopes);

                    return (
                      <Card key={group.id} className="border-muted bg-muted/20 shadow-none">
                        <CardHeader className="flex-row items-start gap-3 space-y-0 px-4 py-3">
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={groupState.fullyGranted ? true : groupState.hasAnyAccess ? "indeterminate" : false}
                            onCheckedChange={(checked) => handleScopesAccessChange(groupScopes, checked === true)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{group.title}</CardTitle>
                            {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                          <Accordion type="multiple" className="space-y-2">
                            {group.scopes.map((scope) => {
                              const scopeStats = getScopeStats(scope);
                              const scopePages = getScopePages(scope);

                              return (
                                <AccordionItem key={scope.id} value={`${group.id}-${scope.id}`} className="rounded-lg border bg-background px-3">
                                  <AccordionTrigger className="py-3 hover:no-underline">
                                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-3 text-left">
                                      <span onClick={(event) => event.stopPropagation()}>
                                        <Checkbox
                                          id={`scope-${scope.id}`}
                                          checked={scopeStats.fullyGranted ? true : scopeStats.hasAnyAccess ? "indeterminate" : false}
                                          onCheckedChange={(checked) => handleScopeAccessChange(scope, checked === true)}
                                        />
                                      </span>
                                      <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <div className="min-w-0 flex-1">
                                        <Label htmlFor={`scope-${scope.id}`} className="cursor-pointer font-medium">{scope.title}</Label>
                                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">{scope.description}</p>
                                      </div>
                                      <Badge variant={scopeStats.fullyGranted ? "default" : "outline"} className="shrink-0 text-xs">
                                        {scopeStats.allowedActions}/{scopeStats.totalActions} actions
                                      </Badge>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="space-y-3 pb-3 pt-1">
                                    {scopePages.map((page) => {
                                      const pagePermission = getPagePermissions(scope.moduleId, page.page);
                                      const canAccess = pagePermission?.canAccess || false;
                                      const allowedCount = canAccess ? pagePermission?.actions.filter((action) => action.allowed).length || 0 : 0;

                                      return (
                                        <div key={page.page} className="rounded-lg border border-border/70 p-3">
                                          <div className="flex items-start gap-3">
                                            <Checkbox
                                              id={`${scope.id}-${page.page}`}
                                              checked={canAccess}
                                              onCheckedChange={(checked) => handlePageAccessChange(scope, page.page, checked === true)}
                                              className="mt-1"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <Label htmlFor={`${scope.id}-${page.page}`} className="cursor-pointer font-medium">{page.name}</Label>
                                              <p className="mt-0.5 text-xs text-muted-foreground">{allowedCount}/{page.actions.length} actions allowed</p>
                                            </div>
                                          </div>
                                          {canAccess && (
                                            <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                                              {page.actions.map((action) => {
                                                const isAllowed = pagePermission?.actions.find((item) => item.actionId === action.id)?.allowed || false;
                                                return (
                                                  <label key={action.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/60">
                                                    <Checkbox
                                                      checked={isAllowed}
                                                      onCheckedChange={(checked) => handleActionChange(scope, page.page, action.id, checked === true)}
                                                      className="mt-0.5"
                                                    />
                                                    <span>
                                                      <span className="flex items-center gap-1 text-sm font-medium">{action.name}{isAllowed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}</span>
                                                      <span className="block text-xs text-muted-foreground">{action.description}</span>
                                                    </span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
