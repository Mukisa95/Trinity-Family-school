"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { FeeStructure } from "@/types";
import { FeeStructuresService } from "@/lib/services/fee-structures.service";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { PageHeader } from "@/components/common/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tag, Scissors } from "lucide-react";

export default function AssignPage() {
  const router = useRouter();

  const {
    data: feeStructures = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["assign-fee-structures"],
    queryFn: async () => {
      const data = await FeeStructuresService.getAllFeeStructures();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: academicYears = [],
    isLoading: isLoadingAcademicYears,
  } = useAcademicYears();

  const feeMap = useMemo(() => {
    return new Map(feeStructures.map((fee) => [fee.id, fee]));
  }, [feeStructures]);

  const assignmentFees = useMemo(
    () =>
      feeStructures
        .filter((fee) => fee.isAssignmentFee)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [feeStructures]
  );

  const discounts = useMemo(
    () =>
      feeStructures
        .filter((fee) => fee.category === "Discount")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [feeStructures]
  );

  const totalAssignmentValue = assignmentFees.reduce(
    (sum, fee) => sum + (fee.amount || 0),
    0
  );
  const totalDiscountValue = discounts.reduce(
    (sum, fee) => sum + Math.abs(fee.amount || 0),
    0
  );

  const getYearLabel = (yearId?: string) => {
    if (!yearId) {
      return "All academic years";
    }
    const year = academicYears?.find((ay) => ay.id === yearId);
    return year ? year.name : yearId;
  };

  const getTermLabel = (termId?: string) => {
    if (!termId) {
      return "All terms";
    }

    for (const year of academicYears || []) {
      const term = year.terms?.find((t) => t.id === termId);
      if (term) {
        return `${term.name} (${year.name})`;
      }
    }

    return termId;
  };

  const getScopeLabel = (fee: FeeStructure) => {
    const classScope =
      fee.classFeeType === "specific"
        ? `${fee.classIds?.length || 0} classes`
        : "All classes";
    const sectionScope =
      fee.sectionFeeType === "specific"
        ? fee.section || "Specific section"
        : "All sections";

    return `${classScope} • ${sectionScope}`;
  };

  const goToDetails = (fee: FeeStructure) => {
    router.push(`/assign/${fee.id}`);
  };

  const renderSummaryCards = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-blue-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-blue-700">
              Assignment Fees
            </CardTitle>
            <CardDescription>All pupil-specific fee items</CardDescription>
          </div>
          <div className="rounded-full bg-blue-50 p-3 text-blue-500">
            <Tag className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{assignmentFees.length}</p>
          <p className="text-sm text-muted-foreground">
            Total value {formatCurrency(totalAssignmentValue)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-semibold text-amber-700">
              Discounts
            </CardTitle>
            <CardDescription>Automatic reductions linked to fees</CardDescription>
          </div>
          <div className="rounded-full bg-amber-50 p-3 text-amber-500">
            <Scissors className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{discounts.length}</p>
          <p className="text-sm text-muted-foreground">
            Total discount value {formatCurrency(totalDiscountValue)}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading || isLoadingAcademicYears) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Assign" description="Assignment fees & discounts" />
        <Card className="p-8 flex items-center justify-center">
          <LoadingIndicator isLoading size="lg" text="Loading assignment data..." />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Assign" description="Assignment fees & discounts" />
        <Alert variant="destructive">
          <AlertTitle>Unable to load assignment data</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || "Please try again shortly."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <PageHeader title="Assign" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-blue-100">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Assignment Fees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignmentFees.length === 0 ? (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4 text-center text-xs text-muted-foreground">
                No assignment fees have been recorded yet.
              </div>
            ) : (
              <div className="rounded-xl border border-blue-50 shadow-inner shadow-blue-100/50">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-blue-50/70">
                      <TableHead className="py-1.5">Name</TableHead>
                      <TableHead className="py-1.5">Amount</TableHead>
                      <TableHead className="py-1.5">Academic Context</TableHead>
                      <TableHead className="py-1.5">Scope</TableHead>
                      <TableHead className="py-1.5 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignmentFees.map((fee) => (
                      <TableRow
                        key={fee.id}
                        className="cursor-pointer hover:bg-blue-50/60 transition-colors"
                        onClick={() => goToDetails(fee)}
                      >
                        <TableCell className="font-medium py-1.5">
                          <div>{fee.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {fee.category}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">{formatCurrency(fee.amount)}</TableCell>
                        <TableCell className="py-1.5">
                          <div className="text-sm">{getYearLabel(fee.academicYearId)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {getTermLabel(fee.termId)}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="text-sm">{getScopeLabel(fee)}</div>
                          {fee.description && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {fee.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-1.5">
                          <Badge variant={fee.status === "active" ? "default" : "outline"}>
                            {fee.status === "active" ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-100">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Discounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {discounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-4 text-center text-xs text-muted-foreground">
                No discounts have been configured yet.
              </div>
            ) : (
              <div className="rounded-xl border border-amber-50 shadow-inner shadow-amber-100/50">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-amber-50/70">
                      <TableHead className="py-1.5">Name</TableHead>
                      <TableHead className="py-1.5">Discount</TableHead>
                      <TableHead className="py-1.5">Linked Fee</TableHead>
                      <TableHead className="py-1.5">Academic Context</TableHead>
                      <TableHead className="py-1.5 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discounts.map((discount) => {
                      const linkedFee = discount.linkedFeeId
                        ? feeMap.get(discount.linkedFeeId)
                        : undefined;

                      return (
                        <TableRow
                          key={discount.id}
                          className="cursor-pointer hover:bg-amber-50/60 transition-colors"
                          onClick={() => goToDetails(discount)}
                        >
                          <TableCell className="font-medium py-1.5">
                            <div>{discount.name}</div>
                            {discount.description && (
                              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {discount.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-emerald-600 font-semibold py-1.5">
                            -{formatCurrency(Math.abs(discount.amount))}
                          </TableCell>
                          <TableCell className="py-1.5">
                            {linkedFee ? (
                              <>
                                <div className="text-sm">{linkedFee.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {formatCurrency(linkedFee.amount)}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Not linked
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="text-sm">{getYearLabel(discount.academicYearId)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {getTermLabel(discount.termId)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-1.5">
                            <Badge variant={discount.status === "active" ? "default" : "outline"}>
                              {discount.status === "active" ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

