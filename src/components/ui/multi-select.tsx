"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  maxItems?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search items...",
  emptyMessage = "No items found.",
  className,
  disabled = false,
  maxItems,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      if (maxItems && selected.length >= maxItems) {
        return; // Don't add if max items reached
      }
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedLabels = selected.map(
    (value) => options.find((option) => option.value === value)?.label || value
  );

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 p-2"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedLabels.map((label, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs"
                  >
                    {label}
                                         <span
                       role="button"
                       tabIndex={0}
                       onClick={(e) => {
                         e.stopPropagation();
                         handleRemove(selected[index]);
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           e.preventDefault();
                           e.stopPropagation();
                           handleRemove(selected[index]);
                         }
                       }}
                       className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:bg-muted/50 p-0.5"
                     >
                       <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                     </span>
                  </Badge>
                ))
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="flex items-center space-x-2"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected.includes(option.value)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {selected.length > 0 && (
              <div className="flex items-center justify-between p-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {selected.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-auto p-1 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
