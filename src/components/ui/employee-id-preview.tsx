"use client";

import * as React from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedEmployeeID } from "@/lib/utils/employee-id-generator";

interface EmployeeIDPreviewProps {
  employeeID: GeneratedEmployeeID | null;
  onRegenerate: () => void;
  isLoading?: boolean;
  className?: string;
}

export function EmployeeIDPreview({
  employeeID,
  onRegenerate,
  isLoading = false,
  className,
}: EmployeeIDPreviewProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (!employeeID) return;

    try {
      await navigator.clipboard.writeText(employeeID.id);
      setCopied(true);
      toast({
        title: "Employee ID copied!",
        description: "The employee ID has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy employee ID to clipboard.",
        variant: "destructive",
      });
    }
  };

  if (!employeeID) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <p>Employee ID will be generated automatically</p>
            <p className="text-sm">Fill in the required fields to generate ID</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-green-200 bg-green-50/50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-green-800">Generated Employee ID</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {/* Main ID Display */}
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-green-900 bg-white px-4 py-2 rounded-lg border border-green-200">
              {employeeID.id}
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-green-700">ID Breakdown:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.schoolLetter}</span>
                <span className="ml-1 text-muted-foreground">School</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.staffLetter}</span>
                <span className="ml-1 text-muted-foreground">Staff</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.departmentLetter}</span>
                <span className="ml-1 text-muted-foreground">Dept</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.surnameLetter}</span>
                <span className="ml-1 text-muted-foreground">Surname</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.birthYear}</span>
                <span className="ml-1 text-muted-foreground">Year</span>
              </Badge>
              <Badge variant="outline" className="text-xs">
                <span className="font-mono">{employeeID.breakdown.randomDigits}</span>
                <span className="ml-1 text-muted-foreground">Random</span>
              </Badge>
            </div>
          </div>

          {/* Format Explanation */}
          <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
            <p className="font-medium mb-1">Format: [School][Staff][Dept]-[Surname][Year]-[Random]</p>
            <p>Example: TSA-M87-726 (Trinity + Staff + Admin + Mukilo + 1987 + Random)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
