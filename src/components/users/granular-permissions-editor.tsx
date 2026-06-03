"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_ACTIONS } from "@/types/permissions";
import { ModulePermissions, PagePermission, ActionPermission } from "@/types";
import { ChevronRight, Shield, FileText, CheckCircle, XCircle, LayoutGrid, Layers, Database, Users, MessageSquare, LayoutDashboard } from "lucide-react";

interface GranularPermissionsEditorProps {
  permissions: ModulePermissions[];
  onChange: (permissions: ModulePermissions[]) => void;
  modules?: string[]; // Specific modules to show, or show all if not provided
}

// Group modules into logical sections
const PERMISSION_SECTIONS = [
  {
    id: "dashboard_reports",
    title: "Dashboard & Reports",
    icon: LayoutDashboard,
    description: "Manage access to dashboard statistics and system reports",
    modules: ["reports"]
  },
  {
    id: "academics",
    title: "Pupils & Academics",
    icon: Users,
    description: "Manage students, classes, exams, and attendance",
    modules: ["pupils", "classes", "subjects", "exams", "attendance", "promotion", "pupil_history", "duty_service", "timetable"]
  },
  {
    id: "finance",
    title: "Finance & Accounts",
    icon: Database,
    description: "Manage fees, banking, and procurement",
    modules: ["fees", "banking", "procurement"]
  },
  {
    id: "admin",
    title: "Administration",
    icon: Shield,
    description: "System settings, staff management, and access controls",
    modules: ["staff", "users", "access_levels", "academic_years", "settings"]
  },
  {
    id: "communication",
    title: "Communication",
    icon: MessageSquare,
    description: "Notifications, SMS, events, and commentary",
    modules: ["notifications", "bulk_sms", "events", "commentary"]
  },
  {
    id: "inventory",
    title: "Inventory",
    icon: Layers,
    description: "Uniforms and requirements management",
    modules: ["uniforms", "requirements"]
  }
];

export function GranularPermissionsEditor({
  permissions,
  onChange,
  modules
}: GranularPermissionsEditorProps) {
  // Filter modules based on props if provided
  const visibleSections = useMemo(() => {
    if (!modules) return PERMISSION_SECTIONS;

    return PERMISSION_SECTIONS.map(section => ({
      ...section,
      modules: section.modules.filter(m => modules.includes(m))
    })).filter(section => section.modules.length > 0);
  }, [modules]);

  const getModulePermissions = (moduleId: string): ModulePermissions | undefined => {
    return permissions.find(p => p.moduleId === moduleId);
  };

  const getPagePermissions = (moduleId: string, pageId: string): PagePermission | undefined => {
    const modulePerm = getModulePermissions(moduleId);
    return modulePerm?.pages.find(p => p.pageId === pageId);
  };

  const isActionAllowed = (moduleId: string, pageId: string, actionId: string): boolean => {
    const pagePerm = getPagePermissions(moduleId, pageId);
    if (!pagePerm || !pagePerm.canAccess) return false;
    const action = pagePerm.actions.find(a => a.actionId === actionId);
    return action?.allowed || false;
  };

  const handlePageAccessChange = (moduleId: string, pageId: string, canAccess: boolean) => {
    const newPermissions = [...permissions];
    let modulePerm = newPermissions.find(p => p.moduleId === moduleId);

    if (!modulePerm) {
      if (!canAccess) return; // Nothing to do if revoking from non-existent
      modulePerm = {
        moduleId,
        pages: []
      };
      newPermissions.push(modulePerm);
    }

    let pagePerm = modulePerm.pages.find(p => p.pageId === pageId);
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
    const pageConfig = moduleConfig?.pages.find(p => p.page === pageId);

    if (!pagePerm) {
      pagePerm = {
        pageId,
        canAccess,
        actions: pageConfig?.actions.map(action => ({
          actionId: action.id,
          allowed: canAccess // Grant all actions by default
        })) || []
      };
      modulePerm.pages.push(pagePerm);
    } else {
      pagePerm.canAccess = canAccess;
      pagePerm.actions = pagePerm.actions.map(a => ({ ...a, allowed: canAccess }));
    }

    onChange(newPermissions);
  };

  const handleActionChange = (moduleId: string, pageId: string, actionId: string, allowed: boolean) => {
    const newPermissions = [...permissions];
    let modulePerm = newPermissions.find(p => p.moduleId === moduleId);

    if (!modulePerm) {
      modulePerm = {
        moduleId,
        pages: []
      };
      newPermissions.push(modulePerm);
    }

    let pagePerm = modulePerm.pages.find(p => p.pageId === pageId);
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
    const pageConfig = moduleConfig?.pages.find(p => p.page === pageId);

    if (!pagePerm) {
      pagePerm = {
        pageId,
        canAccess: true,
        actions: pageConfig?.actions.map(action => ({
          actionId: action.id,
          allowed: action.id === actionId ? allowed : false
        })) || []
      };
      modulePerm.pages.push(pagePerm);
    } else {
      const action = pagePerm.actions.find(a => a.actionId === actionId);
      if (action) {
        action.allowed = allowed;
      } else {
        pagePerm.actions.push({ actionId, allowed });
      }

      if (allowed && !pagePerm.canAccess) {
        pagePerm.canAccess = true;
      }
    }

    onChange(newPermissions);
  };

  const handleGrantFullAccessToModule = (moduleId: string, grant: boolean) => {
    const newPermissions = [...permissions];
    let modulePermIndex = newPermissions.findIndex(p => p.moduleId === moduleId);
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];

    if (!moduleConfig) return;

    if (!grant) {
      // If revoking, we can just remove permissions for this module or set all to false
      // Setting detailed false is better for UI consistency if we re-enable later logic
      if (modulePermIndex !== -1) {
        newPermissions[modulePermIndex].pages.forEach(p => {
          p.canAccess = false;
          p.actions.forEach(a => a.allowed = false);
        });
      }
    } else {
      // Granting full access
      const fullModulePermissions = {
        moduleId,
        pages: moduleConfig.pages.map(pageConfig => ({
          pageId: pageConfig.page,
          canAccess: true,
          actions: pageConfig.actions.map(actionConfig => ({
            actionId: actionConfig.id,
            allowed: true
          }))
        }))
      };

      if (modulePermIndex !== -1) {
        newPermissions[modulePermIndex] = fullModulePermissions;
      } else {
        newPermissions.push(fullModulePermissions);
      }
    }

    onChange(newPermissions);
  };

  const handleSectionAccessChange = (sectionId: string, grant: boolean) => {
    const section = visibleSections.find(s => s.id === sectionId);
    if (!section) return;

    const newPermissions = [...permissions];

    section.modules.forEach(moduleId => {
      const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
      if (!moduleConfig) return;

      let modulePermIndex = newPermissions.findIndex(p => p.moduleId === moduleId);

      if (grant) {
        const fullModulePermissions = {
          moduleId,
          pages: moduleConfig.pages.map(pageConfig => ({
            pageId: pageConfig.page,
            canAccess: true,
            actions: pageConfig.actions.map(actionConfig => ({
              actionId: actionConfig.id,
              allowed: true
            }))
          }))
        };
        if (modulePermIndex !== -1) {
          newPermissions[modulePermIndex] = fullModulePermissions;
        } else {
          newPermissions.push(fullModulePermissions);
        }
      } else {
        if (modulePermIndex !== -1) {
          newPermissions[modulePermIndex].pages.forEach(p => {
            p.canAccess = false;
            p.actions.forEach(a => a.allowed = false);
          });
        }
      }
    });

    onChange(newPermissions);
  };

  const handleSystemAccessChange = (grant: boolean) => {
    const newPermissions = [...permissions];

    visibleSections.forEach(section => {
      section.modules.forEach(moduleId => {
        const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
        if (!moduleConfig) return;

        let modulePermIndex = newPermissions.findIndex(p => p.moduleId === moduleId);

        if (grant) {
          const fullModulePermissions = {
            moduleId,
            pages: moduleConfig.pages.map(pageConfig => ({
              pageId: pageConfig.page,
              canAccess: true,
              actions: pageConfig.actions.map(actionConfig => ({
                actionId: actionConfig.id,
                allowed: true
              }))
            }))
          };
          if (modulePermIndex !== -1) {
            newPermissions[modulePermIndex] = fullModulePermissions;
          } else {
            newPermissions.push(fullModulePermissions);
          }
        } else {
          if (modulePermIndex !== -1) {
            newPermissions[modulePermIndex].pages.forEach(p => {
              p.canAccess = false;
              p.actions.forEach(a => a.allowed = false);
            });
          }
        }
      });
    });

    onChange(newPermissions);
  };

  const getModuleStats = (moduleId: string) => {
    const moduleActions = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
    if (!moduleActions) return { pages: 0, totalPages: 0, actions: 0, totalActions: 0, fullyGranted: false };

    let pages = 0;
    let actions = 0;
    let totalActions = 0;

    moduleActions.pages.forEach(page => {
      const pagePerm = getPagePermissions(moduleId, page.page);
      if (pagePerm?.canAccess) {
        pages++;
        actions += pagePerm.actions.filter(a => a.allowed).length;
      }
      totalActions += page.actions.length;
    });

    return {
      pages,
      totalPages: moduleActions.pages.length,
      actions,
      totalActions,
      fullyGranted: actions === totalActions && totalActions > 0
    };
  };

  const getSectionStats = (sectionModules: string[]) => {
    let fullyGrantedCount = 0;
    sectionModules.forEach(moduleId => {
      const stats = getModuleStats(moduleId);
      if (stats.fullyGranted) fullyGrantedCount++;
    });
    return {
      fullyGranted: fullyGrantedCount === sectionModules.length && sectionModules.length > 0,
      indeterminate: fullyGrantedCount > 0 && fullyGrantedCount < sectionModules.length
    };
  };

  const isSystemFullyGranted = () => {
    for (const section of visibleSections) {
      const stats = getSectionStats(section.modules);
      if (!stats.fullyGranted) return false;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Global Controls */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="system-access"
              checked={isSystemFullyGranted()}
              onCheckedChange={(checked) => handleSystemAccessChange(!!checked)}
              className="h-5 w-5 border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <div className="space-y-1">
              <Label htmlFor="system-access" className="text-base font-semibold cursor-pointer">
                Grant Full System Access
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow this user to access and manage ALL modules and features in the system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections Accordion */}
      <Accordion type="multiple" className="w-full" defaultValue={[]}>
        {visibleSections.map(section => {
          const sectionStats = getSectionStats(section.modules);
          // Only show section if it has modules
          if (section.modules.length === 0) return null;
          const SectionIcon = section.icon;

          return (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg bg-card mb-4">
              <AccordionTrigger className="hover:no-underline px-4 py-2">
                <div className="flex items-center space-x-2 w-full pr-4">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center p-1 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`section-${section.id}`}
                      checked={sectionStats.fullyGranted}
                      onCheckedChange={(checked) => handleSectionAccessChange(section.id, !!checked)}
                    />
                  </div>
                  <LayoutGrid className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 text-left">
                    <Label htmlFor={`section-${section.id}`} className="font-semibold text-lg cursor-pointer flex items-center gap-2 pointer-events-none">
                      {section.title}
                    </Label>
                    <p className="text-xs text-muted-foreground font-normal">{section.description}</p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="space-y-2">
                  <Accordion type="multiple" className="w-full">
                    {section.modules.map(moduleId => {
                      const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
                      if (!moduleConfig) return null;

                      const stats = getModuleStats(moduleId);

                      return (
                        <AccordionItem key={moduleId} value={moduleId} className="border rounded-lg mb-2 bg-muted/20">
                          <AccordionTrigger className="hover:no-underline px-4 py-2">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center p-1 rounded hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`module-${moduleId}`}
                                    checked={stats.fullyGranted}
                                    onCheckedChange={(checked) => handleGrantFullAccessToModule(moduleId, !!checked)}
                                  />
                                </div>
                                <Shield className={`h-4 w-4 ${stats.fullyGranted ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="flex flex-col items-start text-left">
                                  <span className="font-medium capitalize">{moduleId.replace(/_/g, ' ')}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {stats.pages > 0 && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    {stats.pages}/{stats.totalPages} pages
                                  </Badge>
                                )}
                                {stats.actions > 0 && (
                                  <Badge variant={stats.fullyGranted ? "default" : "outline"} className="text-xs">
                                    {stats.actions}/{stats.totalActions} actions
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-6 pt-4">
                              {moduleConfig.pages.map((page, pageIndex) => {
                                const pagePerm = getPagePermissions(moduleId, page.page);
                                const canAccess = pagePerm?.canAccess || false;
                                const pageStats = (function () {
                                  if (!pagePerm || !pagePerm.canAccess) return { allowed: 0, total: 0 };
                                  const allowed = pagePerm.actions.filter(a => a.allowed).length;
                                  const total = pagePerm.actions.length;
                                  return { allowed, total };
                                })();

                                return (
                                  <div key={page.page} className="space-y-3">
                                    {pageIndex > 0 && <Separator className="my-4" />}

                                    {/* Page Header */}
                                    <div className="flex items-start justify-between bg-muted/30 p-2 rounded-md">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                          <Label className="text-base font-medium">{page.name}</Label>
                                        </div>
                                        <div className="flex items-center gap-2 pl-6">
                                          <Checkbox
                                            id={`${moduleId}-${page.page}-access`}
                                            checked={canAccess}
                                            onCheckedChange={(checked) =>
                                              handlePageAccessChange(moduleId, page.page, !!checked)
                                            }
                                          />
                                          <Label
                                            htmlFor={`${moduleId}-${page.page}-access`}
                                            className="text-sm text-muted-foreground cursor-pointer"
                                          >
                                            Allow access to this page
                                          </Label>
                                        </div>
                                      </div>

                                      {canAccess && (
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {pageStats.allowed}/{pageStats.total} actions
                                          </Badge>
                                        </div>
                                      )}
                                    </div>

                                    {/* Page Actions */}
                                    {canAccess && (
                                      <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {page.actions.map(action => {
                                          const isAllowed = isActionAllowed(moduleId, page.page, action.id);

                                          return (
                                            <div
                                              key={action.id}
                                              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${isAllowed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-card hover:bg-muted/50'
                                                }`}
                                            >
                                              <Checkbox
                                                id={`${moduleId}-${page.page}-${action.id}`}
                                                checked={isAllowed}
                                                onCheckedChange={(checked) =>
                                                  handleActionChange(moduleId, page.page, action.id, !!checked)
                                                }
                                              />
                                              <div className="flex-1 space-y-1">
                                                <Label
                                                  htmlFor={`${moduleId}-${page.page}-${action.id}`}
                                                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                                                >
                                                  {action.name}
                                                  {isAllowed && <CheckCircle className="h-3 w-3 text-green-600" />}
                                                </Label>
                                                <p className="text-[0.8rem] text-muted-foreground leading-tight">
                                                  {action.description}
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}