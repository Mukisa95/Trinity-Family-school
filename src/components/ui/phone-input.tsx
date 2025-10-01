import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = "", onChange, onFocus, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);

    // Initialize with + if empty
    React.useEffect(() => {
      if (!value) {
        setDisplayValue("+");
      } else if (!value.startsWith("+")) {
        setDisplayValue("+" + value);
      } else {
        setDisplayValue(value);
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ensure + is always present when focused
      if (!displayValue || displayValue === "") {
        const newValue = "+";
        setDisplayValue(newValue);
        onChange?.(newValue);
      }
      // Move cursor to end
      setTimeout(() => {
        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
      }, 0);
      onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Always ensure it starts with +
      if (!inputValue.startsWith("+")) {
        inputValue = "+" + inputValue.replace(/^\+*/, "");
      }

      // Remove any non-numeric characters except the leading +
      const cleanValue = "+" + inputValue.slice(1).replace(/\D/g, "");
      
      // Handle special case: if user types 0 after +, convert to +256
      if (cleanValue === "+0") {
        const newValue = "+256";
        setDisplayValue(newValue);
        onChange?.(newValue);
        return;
      }

      // Prevent deletion of the + sign
      if (cleanValue.length < 1) {
        const newValue = "+";
        setDisplayValue(newValue);
        onChange?.(newValue);
        return;
      }

      setDisplayValue(cleanValue);
      onChange?.(cleanValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      const cursorPosition = target.selectionStart || 0;
      
      // Prevent deletion of + sign
      if ((e.key === "Backspace" || e.key === "Delete") && cursorPosition <= 1) {
        e.preventDefault();
        return;
      }

      // Only allow numeric keys, backspace, delete, arrow keys, tab
      const allowedKeys = [
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab",
        "Home", "End"
      ];

      if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn(className)}
        placeholder="+256XXXXXXXXX"
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput }; 