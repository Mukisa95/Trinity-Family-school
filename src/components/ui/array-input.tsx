"use client"

import React, { useState } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Label } from './label';
import { Plus, X } from 'lucide-react';

interface ArrayInputProps {
  label: string;
  name: string;
  value: string[];
  onChange: (name: string, value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function ArrayInput({
  label,
  name,
  value = [],
  onChange,
  placeholder = "Add item...",
  className = ""
}: ArrayInputProps) {
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    
    onChange(name, [...value, newItem.trim()]);
    setNewItem('');
  };

  const handleRemoveItem = (index: number) => {
    onChange(name, value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={name}>{label}</Label>}
      
      <div className="flex gap-2">
        <Input
          id={name}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className={`${className} rounded-2xl border-2 border-gray-300 dark:border-gray-500 bg-white/90 dark:bg-gray-800/90 hover:border-gray-400 dark:hover:border-gray-400 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200`}
          onKeyDown={handleKeyDown}
        />
        <Button 
          type="button" 
          onClick={handleAddItem}
          disabled={!newItem.trim()}
          size="icon"
          className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-secondary-foreground/70 hover:text-secondary-foreground ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
} 