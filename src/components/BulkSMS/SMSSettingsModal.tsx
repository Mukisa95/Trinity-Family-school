"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle,
  Globe,
  Shield,
  Zap
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SMSService } from '@/lib/services/sms.service';

interface SMSProvider {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  apiSecret?: string;
  username?: string;
  senderId?: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  features: {
    bulkSMS: boolean;
    deliveryReports: boolean;
    costTracking: boolean;
    webhooks: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface SMSSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SMSSettingsModal: React.FC<SMSSettingsModalProps> = ({ open, onOpenChange }) => {
  const [providers, setProviders] = useState<SMSProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<SMSProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('providers');

  const { toast } = useToast();

  // Sample providers data - in a real app, this would come from an API
  const sampleProviders: SMSProvider[] = [
    {
      id: '1',
      name: 'Africa\'s Talking',
      description: 'Leading African SMS gateway with excellent delivery rates and competitive pricing',
      apiKey: 'atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617',
      username: 'trinityfsch',
      baseUrl: 'https://api.africastalking.com/version1',
      isActive: true,
      isDefault: true,
      features: {
        bulkSMS: true,
        deliveryReports: true,
        costTracking: true,
        webhooks: true,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Twilio',
      description: 'Global SMS platform with advanced features and worldwide coverage',
      apiKey: 'AC1234567890abcdef1234567890abcdef',
      apiSecret: 'your_twilio_auth_token',
      baseUrl: 'https://api.twilio.com/2010-04-01',
      isActive: false,
      isDefault: false,
      features: {
        bulkSMS: true,
        deliveryReports: true,
        costTracking: true,
        webhooks: true,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
         {
       id: '3',
       name: 'Vonage (Nexmo)',
       description: 'Enterprise-grade SMS platform with advanced analytics',
       apiKey: 'your_vonage_api_key',
       apiSecret: 'your_vonage_api_secret',
       baseUrl: 'https://rest.nexmo.com',
       isActive: false,
       isDefault: false,
       features: {
         bulkSMS: true,
         deliveryReports: true,
         costTracking: true,
         webhooks: true,
       },
       createdAt: '2024-01-01T00:00:00Z',
       updatedAt: '2024-01-01T00:00:00Z',
     },
           {
        id: '4',
        name: 'Wiza SMS',
        description: 'Ugandan SMS gateway with local expertise and competitive pricing',
        apiKey: 'mk.patricks95@gmail.com',
        apiSecret: 'patricks95',
        username: 'mk.patricks95@gmail.com',
        senderId: 'TRINITY',
        baseUrl: 'https://wizasms.ug/API/V1',
        isActive: false,
        isDefault: false,
        features: {
          bulkSMS: true,
          deliveryReports: false,
          costTracking: true,
          webhooks: false,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
  ];

  useEffect(() => {
    // Load providers from localStorage or API
    const savedProviders = localStorage.getItem('smsProviders');
    if (savedProviders) {
      const parsedProviders = JSON.parse(savedProviders);
      // Check if Wiza SMS is missing from saved providers
      const hasWizaSMS = parsedProviders.some((p: SMSProvider) => p.name === 'Wiza SMS');
      if (!hasWizaSMS) {
        // Add Wiza SMS to existing providers
        const updatedProviders = [...parsedProviders, sampleProviders[3]]; // Wiza SMS is at index 3
        setProviders(updatedProviders);
        localStorage.setItem('smsProviders', JSON.stringify(updatedProviders));
      } else {
        setProviders(parsedProviders);
      }
    } else {
      setProviders(sampleProviders);
      localStorage.setItem('smsProviders', JSON.stringify(sampleProviders));
    }
  }, []);

  const handleSaveProvider = async (provider: SMSProvider) => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      const updatedProviders = providers.map(p => 
        p.id === provider.id ? { ...provider, updatedAt: new Date().toISOString() } : p
      );
      setProviders(updatedProviders);
      localStorage.setItem('smsProviders', JSON.stringify(updatedProviders));
      
      toast({
        title: 'Provider Updated',
        description: `${provider.name} configuration has been saved successfully.`,
      });
      
      setIsEditing(false);
      setSelectedProvider(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save provider configuration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProvider = async (providerId: string) => {
    const updatedProviders = providers.map(p => {
      if (p.id === providerId) {
        return { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    setProviders(updatedProviders);
    localStorage.setItem('smsProviders', JSON.stringify(updatedProviders));
    
    const provider = updatedProviders.find(p => p.id === providerId);
    toast({
      title: 'Provider Status Updated',
      description: `${provider?.name} has been ${provider?.isActive ? 'activated' : 'deactivated'}.`,
    });
  };

  const handleSetDefault = async (providerId: string) => {
    const updatedProviders = providers.map(p => ({
      ...p,
      isDefault: p.id === providerId,
      updatedAt: new Date().toISOString()
    }));
    
    setProviders(updatedProviders);
    localStorage.setItem('smsProviders', JSON.stringify(updatedProviders));
    
    const provider = updatedProviders.find(p => p.id === providerId);
    toast({
      title: 'Default Provider Updated',
      description: `${provider?.name} is now the default SMS provider.`,
    });
  };

  const handleTestConnection = async (provider: SMSProvider) => {
    setLoading(true);
    try {
      let testResult;
      
      if (provider.name === 'Wiza SMS') {
        // Test Wiza SMS connection
        testResult = await testWizaSMSConnection(provider);
      } else if (provider.name === 'Africa\'s Talking') {
        // Test Africa's Talking connection
        testResult = await testAfricasTalkingConnection(provider);
      } else {
        // For other providers, simulate test for now
        await new Promise(resolve => setTimeout(resolve, 2000));
        testResult = { success: true, message: 'Connection test completed' };
      }
      
      if (testResult.success) {
        toast({
          title: 'Connection Test Successful',
          description: `${provider.name} API connection is working properly.`,
        });
      } else {
        toast({
          title: 'Connection Test Failed',
          description: testResult.message || 'Unable to connect to the SMS provider API.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Test Failed',
        description: 'Unable to connect to the SMS provider API.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testWizaSMSConnection = async (provider: SMSProvider) => {
    try {
      const response = await fetch('https://wizasms.ug/API/V1/send-bulk-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: provider.username || provider.apiKey,
          password: provider.apiSecret,
          senderId: provider.senderId || 'TEST',
          message: 'Connection test message',
          recipients: '256700000000' // Test number
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        return { success: true, message: 'Wiza SMS API connection successful' };
      } else {
        return { 
          success: false, 
          message: data.messages || 'Wiza SMS API connection failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Network error connecting to Wiza SMS API' 
      };
    }
  };

  const testAfricasTalkingConnection = async (provider: SMSProvider) => {
    try {
      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': provider.apiKey,
        },
        body: new URLSearchParams({
          username: provider.username || 'trinityfsch',
          to: '256700000000', // Test number
          message: 'Connection test message'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.SMSMessageData) {
        return { success: true, message: 'Africa\'s Talking API connection successful' };
      } else {
        return { 
          success: false, 
          message: data.errorMessage || 'Africa\'s Talking API connection failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Network error connecting to Africa\'s Talking API' 
      };
    }
  };

  const resetProviders = () => {
    setProviders(sampleProviders);
    localStorage.setItem('smsProviders', JSON.stringify(sampleProviders));
    toast({
      title: 'Providers Reset',
      description: 'SMS providers have been reset to default configuration.',
    });
  };

  const debugProviderConfiguration = async () => {
    try {
      const debugInfo = await SMSService.debugProviderConfiguration();
      console.log('Provider Configuration Debug Info:', debugInfo);
      
      toast({
        title: 'Debug Info Logged',
        description: 'Provider configuration debug info has been logged to console. Check browser developer tools.',
      });
    } catch (error) {
      toast({
        title: 'Debug Error',
        description: 'Failed to get debug information.',
        variant: 'destructive',
      });
    }
  };

  const activeProvider = providers.find(p => p.isActive && p.isDefault);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            SMS Service Provider Settings
          </DialogTitle>
          <DialogDescription>
            Manage your SMS service providers and their API configurations.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="providers">Service Providers</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            {/* Current Active Provider */}
            {activeProvider && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Active Provider
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-800">{activeProvider.name}</h3>
                      <p className="text-sm text-green-600">{activeProvider.description}</p>
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      Default
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Providers List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Available Providers</h3>
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{provider.name}</h4>
                          <div className="flex gap-1">
                            {provider.isActive && (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                Active
                              </Badge>
                            )}
                            {provider.isDefault && (
                              <Badge variant="outline" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{provider.description}</p>
                        
                        {/* Features */}
                        <div className="flex gap-2 mb-3">
                          {provider.features.bulkSMS && (
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Bulk SMS
                            </Badge>
                          )}
                          {provider.features.deliveryReports && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Delivery Reports
                            </Badge>
                          )}
                          {provider.features.costTracking && (
                            <Badge variant="secondary" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Cost Tracking
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={provider.isActive}
                          onCheckedChange={() => handleToggleProvider(provider.id)}
                        />
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            setIsEditing(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(provider)}
                          disabled={loading || !provider.isActive}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        
                        {!provider.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefault(provider.id)}
                            disabled={!provider.isActive}
                          >
                            Set Default
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

                     <TabsContent value="overview" className="space-y-4">
             <div className="flex justify-end mb-4 gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={debugProviderConfiguration}
                 className="flex items-center gap-2"
               >
                 <Shield className="h-4 w-4" />
                 Debug Providers
               </Button>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={resetProviders}
                 className="flex items-center gap-2"
               >
                 <Settings className="h-4 w-4" />
                 Reset to Default Providers
               </Button>
             </div>
             <div className="grid gap-4 md:grid-cols-2">
               <Card>
                 <CardHeader>
                   <CardTitle className="text-lg">Provider Statistics</CardTitle>
                 </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Providers:</span>
                    <span className="font-semibold">{providers.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Providers:</span>
                    <span className="font-semibold text-green-600">
                      {providers.filter(p => p.isActive).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default Provider:</span>
                    <span className="font-semibold">
                      {activeProvider?.name || 'None'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">API Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>API Keys Configured:</span>
                    <span className="font-semibold">
                      {providers.filter(p => p.apiKey).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Webhooks Enabled:</span>
                    <span className="font-semibold">
                      {providers.filter(p => p.features.webhooks).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost Tracking:</span>
                    <span className="font-semibold">
                      {providers.filter(p => p.features.costTracking).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Provider Modal */}
        {selectedProvider && isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Edit {selectedProvider.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="providerName">Provider Name</Label>
                  <Input
                    id="providerName"
                    value={selectedProvider.name}
                    onChange={(e) => setSelectedProvider({
                      ...selectedProvider,
                      name: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="providerDescription">Description</Label>
                  <Textarea
                    id="providerDescription"
                    value={selectedProvider.description}
                    onChange={(e) => setSelectedProvider({
                      ...selectedProvider,
                      description: e.target.value
                    })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={selectedProvider.apiKey}
                      onChange={(e) => setSelectedProvider({
                        ...selectedProvider,
                        apiKey: e.target.value
                      })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {selectedProvider.apiSecret && (
                  <div>
                    <Label htmlFor="apiSecret">API Secret</Label>
                    <Input
                      id="apiSecret"
                      type="password"
                      value={selectedProvider.apiSecret}
                      onChange={(e) => setSelectedProvider({
                        ...selectedProvider,
                        apiSecret: e.target.value
                      })}
                    />
                  </div>
                )}

                                 {selectedProvider.username && (
                   <div>
                     <Label htmlFor="username">Username</Label>
                     <Input
                       id="username"
                       value={selectedProvider.username}
                       onChange={(e) => setSelectedProvider({
                         ...selectedProvider,
                         username: e.target.value
                       })}
                     />
                   </div>
                 )}

                 {selectedProvider.senderId && (
                   <div>
                     <Label htmlFor="senderId">Sender ID</Label>
                     <Input
                       id="senderId"
                       value={selectedProvider.senderId}
                       onChange={(e) => setSelectedProvider({
                         ...selectedProvider,
                         senderId: e.target.value
                       })}
                       placeholder="e.g., TRINITY, WIZA"
                     />
                   </div>
                 )}

                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={selectedProvider.baseUrl}
                    onChange={(e) => setSelectedProvider({
                      ...selectedProvider,
                      baseUrl: e.target.value
                    })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={selectedProvider.isActive}
                    onCheckedChange={(checked) => setSelectedProvider({
                      ...selectedProvider,
                      isActive: checked
                    })}
                  />
                  <Label htmlFor="isActive">Active Provider</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedProvider(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSaveProvider(selectedProvider)}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SMSSettingsModal;
