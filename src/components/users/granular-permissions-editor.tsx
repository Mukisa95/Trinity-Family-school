"use client";

import React from "react";
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
import { MODULE_ACTIONS } from "@/types/permissions";
import { ModulePermissions, PagePermission, ActionPermission } from "@/types";
import { ChevronRight, Shield, FileText, CheckCircle, XCircle } from "lucide-react";

interface GranularPermissionsEditorProps {
  permissions: ModulePermissions[];
  onChange: (permissions: ModulePermissions[]) => void;
  modules?: string[]; // Specific modules to show, or show all if not provided
}

export function GranularPermissionsEditor({ 
  permissions, 
  onChange,
  modules 
}: GranularPermissionsEditorProps) {
  const modulesList = modules || Object.keys(MODULE_ACTIONS);

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
          allowed: canAccess // If granting page access, grant all actions by default too initially for this new page
        })) || []
      };
      modulePerm.pages.push(pagePerm);
    } else {
      pagePerm.canAccess = canAccess;
      // If disabling page access, disable all actions
      // If enabling page access, enable all actions (can be fine-tuned later)
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
        canAccess: true, // Enable page access if enabling an action
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
      
      // If enabling an action, ensure page access is enabled
      if (allowed && !pagePerm.canAccess) {
        pagePerm.canAccess = true;
      }
      // If all actions are disabled, and page access was only true due to an action, consider if page access should be false
      // However, explicit page access toggle should be the main driver for page access.
    }
    
    onChange(newPermissions);
  };

  const toggleAllPageActions = (moduleId: string, pageId: string, enable: boolean) => {
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
    const pageConfig = moduleConfig?.pages.find(p => p.page === pageId);
    
    if(pageConfig){
        // Ensure page access is enabled if enabling actions
        if(enable){
            handlePageAccessChange(moduleId, pageId, true);
        }
        pageConfig.actions.forEach(action => {
          handleActionChange(moduleId, pageId, action.id, enable);
        });
    }
  };

  const handleGrantFullAccessToModule = (moduleId: string) => {
    const newPermissions = [...permissions];
    let modulePerm = newPermissions.find(p => p.moduleId === moduleId);
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];

    if (!moduleConfig) return;

    if (!modulePerm) {
      modulePerm = {
        moduleId,
        pages: []
      };
      newPermissions.push(modulePerm);
    }

    modulePerm.pages = moduleConfig.pages.map(pageConfig => ({
      pageId: pageConfig.page,
      canAccess: true,
      actions: pageConfig.actions.map(actionConfig => ({
        actionId: actionConfig.id,
        allowed: true
      }))
    }));
    
    onChange(newPermissions);
  };

  const handleRevokeAllAccessFromModule = (moduleId: string) => {
    const newPermissions = [...permissions];
    let modulePerm = newPermissions.find(p => p.moduleId === moduleId);
    const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];

    if (!moduleConfig) return;

    if (!modulePerm) {
      modulePerm = {
        moduleId,
        pages: []
      };
      newPermissions.push(modulePerm);
    }

    modulePerm.pages = moduleConfig.pages.map(pageConfig => ({
      pageId: pageConfig.page,
      canAccess: false,
      actions: pageConfig.actions.map(actionConfig => ({
        actionId: actionConfig.id,
        allowed: false
      }))
    }));
    
    onChange(newPermissions);
  };

  const getPageStats = (moduleId: string, pageId: string) => {
    const pagePerm = getPagePermissions(moduleId, pageId);
    if (!pagePerm || !pagePerm.canAccess) return { allowed: 0, total: 0 };
    
    const allowed = pagePerm.actions.filter(a => a.allowed).length;
    const total = pagePerm.actions.length;
    
    return { allowed, total };
  };

  const getModuleStats = (moduleId: string) => {
    const moduleActions = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
    if (!moduleActions) return { pages: 0, totalPages: 0, actions: 0, totalActions: 0 };
    
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
      totalActions 
    };
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="w-full">
        {modulesList.map(moduleId => {
          const moduleConfig = MODULE_ACTIONS[moduleId as keyof typeof MODULE_ACTIONS];
          if (!moduleConfig) return null;
          
          const stats = getModuleStats(moduleId);
          
          return (
            <AccordionItem key={moduleId} value={moduleId}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium capitalize">{moduleId.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.pages > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stats.pages}/{stats.totalPages} pages
                      </Badge>
                    )}
                    {stats.actions > 0 && (
                      <Badge variant="default" className="text-xs">
                        {stats.actions}/{stats.totalActions} actions
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex justify-end gap-2 mb-4 px-4 pt-2 border-b pb-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent accordion from closing
                        handleGrantFullAccessToModule(moduleId);
                    }}
                    className="text-xs"
                  >
                    Grant Full Module Access
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRevokeAllAccessFromModule(moduleId);
                    }}
                    className="text-xs"
                  >
                    Revoke All Module Access
                  </Button>
                </div>
                <div className="space-y-6 pt-0">
                  {moduleConfig.pages.map((page, pageIndex) => {
                    const pagePerm = getPagePermissions(moduleId, page.page);
                    const canAccess = pagePerm?.canAccess || false;
                    const pageStats = getPageStats(moduleId, page.page);
                    
                    return (
                      <div key={page.page} className="space-y-3">
                        {pageIndex > 0 && <Separator className="my-4" />}
                        
                        {/* Page Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-base font-medium">{page.name}</Label>
                              <Badge variant="outline" className="text-xs">
                                {page.path}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleAllPageActions(moduleId, page.page, true)}
                                className="text-xs"
                              >
                                Enable All
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleAllPageActions(moduleId, page.page, false)}
                                className="text-xs"
                              >
                                Disable All
                              </Button>
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
                                  className={`flex items-start space-x-3 p-3 rounded-lg border ${
                                    isAllowed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-950/20'
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
                                      {isAllowed ? (
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-gray-400" />
                                      )}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
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
  );
} 