import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CreditCard, RefreshCw, Monitor } from 'lucide-react';

interface WizaSMSDashboardProps {
  children?: React.ReactNode;
}

export const WizaSMSDashboard: React.FC<WizaSMSDashboardProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenDashboard = () => {
    setIsOpen(true);
    setIsLoading(true);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    const iframe = document.getElementById('wiza-dashboard-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={handleOpenDashboard}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Monitor className="h-4 w-4" />
          Balance
        </Button>
      </DialogTrigger>
      
                    <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col">
         <DialogHeader className="p-3 border-b bg-gray-50 flex-shrink-0">
           <div className="flex items-center justify-between">
             <DialogTitle className="flex items-center gap-2 text-lg">
               <CreditCard className="h-5 w-5" />
               Balance
               <Badge variant="outline" className="text-xs">
                 Wiza SMS Dashboard
               </Badge>
             </DialogTitle>
             
             <div className="flex items-center gap-2">
               <Button
                 onClick={handleRefresh}
                 variant="ghost"
                 size="sm"
                 disabled={isLoading}
                 className="h-8 w-8 p-0"
                 title="Refresh dashboard"
               >
                 <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </Button>
               
               <Button
                 onClick={() => window.open('https://wizasms.ug/dashboard', '_blank')}
                 variant="ghost"
                 size="sm"
                 className="h-8 px-3"
                 title="Open in new tab"
               >
                 <ExternalLink className="h-4 w-4" />
               </Button>
             </div>
           </div>
           
           <p className="text-sm text-muted-foreground mt-1">
             View your real-time balance, transaction history, and recharge your account directly
           </p>
         </DialogHeader>
         
         <div className="flex-1 relative" style={{ height: 'calc(100% - 120px)' }}>
           {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
               <div className="flex flex-col items-center gap-2">
                 <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                 <p className="text-sm text-muted-foreground">Loading Wiza SMS Dashboard...</p>
               </div>
             </div>
           )}
           
           <iframe
             id="wiza-dashboard-iframe"
             src="https://wizasms.ug/dashboard"
             className="w-full h-full border-0"
             onLoad={handleIframeLoad}
             title="Wiza SMS Dashboard"
             sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
             style={{ 
               width: '100%', 
               height: '100%', 
               minHeight: '100%',
               display: 'block'
             }}
           />
         </div>
         
         <div className="p-3 border-t bg-gray-50 flex-shrink-0">
           <div className="flex items-center justify-between text-sm text-muted-foreground">
             <div className="flex items-center gap-4">
               <span>🔐 Secure connection to Wiza SMS</span>
               <span>💳 Direct recharge available</span>
               <span>📊 Real-time balance updates</span>
             </div>
             
             <Button
               onClick={() => setIsOpen(false)}
               variant="outline"
               size="sm"
             >
               Close Dashboard
             </Button>
           </div>
         </div>
       </DialogContent>
    </Dialog>
  );
};
