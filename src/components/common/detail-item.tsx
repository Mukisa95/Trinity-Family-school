import React from 'react';

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
  clickable?: boolean;
  onClick?: () => void;
}

export function DetailItem({ label, value, clickable = false, onClick }: DetailItemProps) {
  const baseClasses = "flex justify-between items-center py-1";
  const clickableClasses = clickable ? "cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2" : "";
  
  return (
    <div 
      className={`${baseClasses} ${clickableClasses}`}
      onClick={clickable ? onClick : undefined}
    >
      <span className="text-muted-foreground text-xs font-medium">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
