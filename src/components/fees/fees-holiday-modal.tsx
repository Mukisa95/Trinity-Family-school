"use client";

import * as React from "react";
import { X, Save, Loader2, Calendar, Percent, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateFeesHoliday,
  useUpdateFeesHoliday,
  useDeleteFeesHoliday,
} from "@/lib/hooks/use-fees-holiday";
import type { FeesHoliday, FeesHolidayCategory, FeesHolidayDiscountType } from "@/types";
import { Badge } from "@/components/ui/badge";

interface FeesHolidayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pupilId: string;
  pupilName?: string;
  existingHoliday?: FeesHoliday | null;
}

export function FeesHolidayModal({
  open,
  onOpenChange,
  pupilId,
  pupilName,
  existingHoliday,
}: FeesHolidayModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateFeesHoliday();
  const updateMutation = useUpdateFeesHoliday();
  const deleteMutation = useDeleteFeesHoliday();

  const [categories, setCategories] = React.useState<FeesHolidayCategory[]>(["required"]);
  const [discountType, setDiscountType] = React.useState<FeesHolidayDiscountType>("full");
  const [discountValue, setDiscountValue] = React.useState<string>("");
  const [isActive, setIsActive] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Initialize form when modal opens or existingHoliday changes
  React.useEffect(() => {
    if (open) {
      if (existingHoliday) {
        // Handle both old format (single category) and new format (array of categories)
        setCategories(
          Array.isArray(existingHoliday.categories)
            ? existingHoliday.categories
            : existingHoliday.category
            ? [existingHoliday.category as FeesHolidayCategory]
            : ["required"]
        );
        setDiscountType(existingHoliday.discountType);
        setDiscountValue(existingHoliday.discountValue?.toString() || "");
        setIsActive(existingHoliday.isActive);
      } else {
        // Reset form for new holiday
        setCategories(["required"]);
        setDiscountType("full");
        setDiscountValue("");
        setIsActive(true);
      }
    }
  }, [open, existingHoliday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Validate percentage discount
      if (discountType === "percentage") {
        const value = parseFloat(discountValue);
        if (isNaN(value) || value < 0 || value > 100) {
          toast({
            variant: "destructive",
            title: "Invalid Percentage",
            description: "Percentage must be between 0 and 100.",
          });
          setIsSaving(false);
          return;
        }
      }

      // Validate that at least one category is selected
      if (categories.length === 0) {
        toast({
          variant: "destructive",
          title: "Category Required",
          description: "Please select at least one fee category.",
        });
        setIsSaving(false);
        return;
      }

      // Build holiday data, excluding undefined values
      const holidayData: any = {
        pupilId,
        categories, // Array of categories
        discountType,
        reason: "staff privilege", // Default reason
        isActive,
      };

      // Only include discountValue if it's a percentage discount
      if (discountType === "percentage") {
        holidayData.discountValue = parseFloat(discountValue);
      }

      // Remove undefined values to avoid Firebase errors
      Object.keys(holidayData).forEach(key => {
        if (holidayData[key] === undefined) {
          delete holidayData[key];
        }
      });

      if (existingHoliday) {
        await updateMutation.mutateAsync({
          id: existingHoliday.id,
          data: holidayData,
        });
        toast({
          title: "Fees Holiday Updated",
          description: "The fees holiday has been successfully updated.",
        });
      } else {
        await createMutation.mutateAsync(holidayData);
        toast({
          title: "Fees Holiday Created",
          description: "The fees holiday has been successfully created.",
        });
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving fees holiday:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save fees holiday. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingHoliday) return;

    if (!confirm(`Are you sure you want to delete this fees holiday? This will not affect payment history.`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(existingHoliday.id);
      toast({
        title: "Fees Holiday Deleted",
        description: "The fees holiday has been successfully deleted.",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting fees holiday:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete fees holiday. Please try again.",
      });
    }
  };

  const getDiscountLabel = (type: FeesHolidayDiscountType) => {
    switch (type) {
      case "full":
        return "100% (Full)";
      case "half":
        return "50% (Half)";
      case "quarter":
        return "25% (Quarter)";
      case "percentage":
        return "Custom Percentage";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingHoliday ? "Edit Fees Holiday" : "Create Fees Holiday"}
          </DialogTitle>
          <DialogDescription>
            {pupilName && `For ${pupilName}`}
            {!pupilName && `For selected pupil`}
            <br />
            Set a discount that will apply to all fees in the selected category until disabled.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selection - Checkboxes */}
          <div className="space-y-2">
            <Label>Fee Categories *</Label>
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="category-required"
                  checked={categories.includes("required")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCategories([...categories, "required"]);
                    } else {
                      setCategories(categories.filter((c) => c !== "required"));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="category-required" className="cursor-pointer font-medium">
                  Required Fees
                </Label>
              </div>
              <p className="text-xs text-gray-600 ml-6">
                Applies to all required fees (fees marked as required)
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="category-non-required"
                  checked={categories.includes("non-required")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCategories([...categories, "non-required"]);
                    } else {
                      setCategories(categories.filter((c) => c !== "non-required"));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="category-non-required" className="cursor-pointer font-medium">
                  Non-Required Fees
                </Label>
              </div>
              <p className="text-xs text-gray-600 ml-6">
                Applies to all non-required fees (optional fees)
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Select one or both categories. The discount will apply to all fees in the selected categories.
            </p>
          </div>

          {/* Discount Type */}
          <div className="space-y-2">
            <Label htmlFor="discountType">Discount Type *</Label>
            <Select
              value={discountType}
              onValueChange={(value) => {
                setDiscountType(value as FeesHolidayDiscountType);
                if (value !== "percentage") {
                  setDiscountValue("");
                }
              }}
            >
              <SelectTrigger id="discountType">
                <SelectValue placeholder="Select discount type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full (100%)</SelectItem>
                <SelectItem value="half">Half (50%)</SelectItem>
                <SelectItem value="quarter">Quarter (25%)</SelectItem>
                <SelectItem value="percentage">Custom Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Percentage Value (only for percentage type) */}
          {discountType === "percentage" && (
            <div className="space-y-2">
              <Label htmlFor="discountValue">Discount Percentage *</Label>
              <div className="relative">
                <Input
                  id="discountValue"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Enter percentage (0-100)"
                  className="pr-8"
                  required
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Enter a value between 0 and 100 (e.g., 15 for 15% discount)
              </p>
            </div>
          )}

          {/* Discount Preview */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Discount Preview</span>
            </div>
            <div className="text-sm text-blue-800">
              <span>This will apply a </span>
              <Badge variant="outline" className="mx-1">
                {getDiscountLabel(discountType)}
                {discountType === "percentage" && discountValue && ` (${discountValue}%)`}
              </Badge>
              <span> discount to all </span>
              {categories.map((cat, index) => (
                <React.Fragment key={cat}>
                  <Badge variant="outline" className="mx-1">
                    {cat === "required" ? "Required" : "Non-Required"}
                  </Badge>
                  {index < categories.length - 1 && <span> and </span>}
                </React.Fragment>
              ))}
              <span> fees for this pupil.</span>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (discount will be applied)
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {existingHoliday && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSaving || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {existingHoliday ? "Update" : "Create"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

