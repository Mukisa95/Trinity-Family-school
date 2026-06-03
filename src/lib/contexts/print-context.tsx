"use client";

import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface PrintContextType {
  registerPrintHandler: (handler: () => void, priority?: number) => () => void;
  triggerPrint: () => void;
}

const PrintContext = createContext<PrintContextType | undefined>(undefined);

interface PrintHandler {
  handler: () => void;
  priority: number;
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const printHandlersRef = useRef<PrintHandler[]>([]);

  const registerPrintHandler = useCallback((handler: () => void, priority: number = 0) => {
    const handlerObj: PrintHandler = { handler, priority };
    printHandlersRef.current.push(handlerObj);
    
    // Sort by priority (higher priority first)
    printHandlersRef.current.sort((a, b) => b.priority - a.priority);

    // Return unregister function
    return () => {
      printHandlersRef.current = printHandlersRef.current.filter(h => h !== handlerObj);
    };
  }, []);

  const triggerPrint = useCallback(() => {
    // Get the highest priority handler (first in sorted array)
    const handler = printHandlersRef.current[0];
    if (handler) {
      handler.handler();
    } else {
      // Fallback to browser print if no handler is registered
      window.print();
    }
  }, []);

  return (
    <PrintContext.Provider value={{ registerPrintHandler, triggerPrint }}>
      {children}
    </PrintContext.Provider>
  );
}

export function usePrint() {
  const context = useContext(PrintContext);
  if (context === undefined) {
    throw new Error('usePrint must be used within a PrintProvider');
  }
  return context;
}














