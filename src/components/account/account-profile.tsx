"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Mail, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SystemUser } from "@/types";

export function accountDisplayName(user: SystemUser) {
  return user.role === "Staff" && user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.username;
}

export function AccountStatus({ active }: { active: boolean }) {
  return <Badge variant="outline" className={cn("gap-1.5 font-medium", active
    ? "border-green-200 bg-green-100 text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-200"
    : "border-gray-200 bg-gray-100 text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100")}>
    <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-green-600 dark:bg-green-400" : "bg-muted-foreground")} />
    {active ? "Active" : "Inactive"}
  </Badge>;
}

export function AccountIdentity({ user }: { user: SystemUser }) {
  const name = accountDisplayName(user);
  const initials = name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();
  return <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
    <CardContent className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-primary/10 text-xl font-semibold text-primary sm:h-20 sm:w-20">{initials}</div>
        <div className="min-w-0 flex-1 basis-40">
          <p className="mb-1 text-xs font-medium text-muted-foreground">User profile · {user.role}</p>
          <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
          <p className="mt-1 break-all text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{user.role} account</div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 border-t border-border/70 pt-3 sm:w-auto sm:border-0 sm:pt-0">
          <span className="text-xs text-muted-foreground sm:sr-only">Account status</span>
          <AccountStatus active={user.isActive} />
        </div>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3">
        {user.email ? <a href={`mailto:${user.email}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-all">{user.email}</span></a>
          : <p className="flex items-center gap-2 px-2 text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />Email not provided</p>}
      </div>
    </CardContent>
  </Card>;
}

// The same compact, collapsible section treatment used by staff details.
export function AccountSection({ title, icon, description, children }: {
  title: string; icon: ReactNode; description?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
      <h2><CollapsibleTrigger className="flex min-h-12 w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </CollapsibleTrigger></h2>
      <CollapsibleContent><CardContent className="border-t border-border/60 p-4">
        {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
        {children}
      </CardContent></CollapsibleContent>
    </Card>
  </Collapsible>;
}

export function AccountField({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm leading-relaxed">{children || <span className="text-muted-foreground">Not provided</span>}</dd>
  </div>;
}
