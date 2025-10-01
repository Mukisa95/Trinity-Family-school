"use client";

import { useRouter } from 'next/navigation';
import { useStaffById, useUpdateStaff } from '@/lib/hooks/use-staff';
import { useState, use } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Briefcase,
  Building2,
  HeartPulse,
  Clock,
  ArrowLeft,
  Pencil,
  Lock,
  X,
  CreditCard,
  BookOpen,
  Lightbulb,
  Heart,
  Pill,
  ShieldAlert,
  UserCircle2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserX,
  Settings,
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  Award,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { StaffService } from '@/lib/services/staff.service';
import { UsersService } from '@/lib/services/users.service';
import { formatStaffRoles } from '@/lib/utils/format';

type StaffStatus = 'active' | 'inactive' | 'suspended';

export default function StaffDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { data: staff, isLoading, error } = useStaffById(resolvedParams.id);
  const { mutate: updateStaff } = useUpdateStaff();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    employment: true,
    qualifications: false,
    medical: false,
    emergency: false
  });

  const handleViewDocument = (url: string) => {
    setSelectedDocument(url);
    window.open(url, '_blank');
  };

  const handleStatusChange = async (newStatus: StaffStatus) => {
    if (!staff) return;
    
    setStatusUpdating(true);
    try {
      // Update staff status using the mutation
      updateStaff({ 
        id: resolvedParams.id, 
        data: { status: newStatus } 
      }, {
        onSuccess: async () => {
          // Update user access based on status
          try {
            const users = await UsersService.getAllUsers();
            const staffUser = users.find(user => user.staffId === resolvedParams.id);
            
            if (staffUser) {
              const isActive = newStatus === 'active';
              await UsersService.updateUser(staffUser.id, { isActive });
            }
            
            toast({
              title: "Status Updated",
              description: `Staff member status changed to ${newStatus}. User access has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`,
              variant: "default",
            });
          } catch (userError) {
            console.error('Error updating user access:', userError);
            toast({
              title: "Partial Update",
              description: `Staff status updated to ${newStatus}, but failed to update user access. Please check user settings manually.`,
              variant: "default",
            });
          }
        },
        onError: (error) => {
          console.error('Error updating status:', error);
          toast({
            title: "Error",
            description: "Failed to update staff status. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update staff status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'suspended':
        return <UserX className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading staff details...</p>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
            <p className="text-muted-foreground mb-4">The staff member you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => router.push('/staff')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staff List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <Button
            variant="ghost"
            className="flex items-center gap-2 hover:bg-white/80"
            onClick={() => router.push('/staff')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Staff List
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex items-center gap-2 bg-white/80 hover:bg-white"
              onClick={() => router.push(`/staff/form?id=${resolvedParams.id}`)}
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Header Card */}
        <Card className="mb-6 overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-24 relative">
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <CardContent className="p-6 -mt-12 relative">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-shrink-0">
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                  <AvatarImage src={staff.photo} alt={`${staff.firstName} ${staff.lastName}`} />
                  <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {staff.firstName?.[0]}{staff.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                    {staff.firstName} {staff.otherNames} {staff.lastName}
                  </h1>
                  <p className="text-lg text-gray-600 mt-1">{formatStaffRoles(staff.role)}</p>
                </div>

                {/* Status Management */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(staff.status || 'active')}
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(staff.status || 'active')} font-medium`}
                    >
                      {(staff.status || 'active').charAt(0).toUpperCase() + (staff.status || 'active').slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-gray-500" />
                    <Select 
                      value={staff.status || 'active'} 
                      onValueChange={handleStatusChange}
                      disabled={statusUpdating}
                    >
                      <SelectTrigger className="w-36 h-8 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Active
                          </div>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-gray-500" />
                            Inactive
                          </div>
                        </SelectItem>
                        <SelectItem value="suspended">
                          <div className="flex items-center gap-2">
                            <UserX className="h-3 w-3 text-red-500" />
                            Suspended
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{staff.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    {staff.contactNumber ? (
                      <a 
                        href={`tel:${staff.contactNumber}`}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        {staff.contactNumber}
                      </a>
                    ) : (
                      staff.contactNumber
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span>{Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>Joined {staff.joinDate ? new Date(staff.joinDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Personal Information */}
            <Collapsible open={expandedSections.personal} onOpenChange={() => toggleSection('personal')}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-md">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-gray-50/50 rounded-t-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">Personal Information</CardTitle>
                    </div>
                    {expandedSections.personal ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date of Birth</label>
                        <p className="mt-1 text-sm font-medium">{staff.dateOfBirth ? new Date(staff.dateOfBirth).toLocaleDateString() : 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</label>
                        <p className="mt-1 text-sm font-medium">{staff.gender || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">National ID</label>
                        <p className="mt-1 text-sm font-medium">{staff.nationalId || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Marital Status</label>
                        <p className="mt-1 text-sm font-medium">{staff.maritalStatus || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Religion</label>
                        <p className="mt-1 text-sm font-medium">{staff.religion || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</label>
                        <p className="mt-1 text-sm font-medium">
                          {staff.address ? `${staff.address}, ${staff.city || ''}, ${staff.country || ''}` : 'Not provided'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Employment Information */}
            <Collapsible open={expandedSections.employment} onOpenChange={() => toggleSection('employment')}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-md">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-gray-50/50 rounded-t-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">Employment Details</CardTitle>
                    </div>
                    {expandedSections.employment ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employee ID</label>
                        <p className="mt-1 text-sm font-medium">{staff.employeeId}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contract Type</label>
                        <p className="mt-1 text-sm font-medium">{staff.contractType || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department</label>
                        <p className="mt-1 text-sm font-medium">{Array.isArray(staff.department) ? staff.department.join(', ') : staff.department}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Position</label>
                        <p className="mt-1 text-sm font-medium">{formatStaffRoles(staff.role)}</p>
                      </div>
                    </div>
                    
                    {staff.cvPhotos && staff.cvPhotos.length > 0 && (
                      <div className="mt-6">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">CV Documents</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {staff.cvPhotos.map((photo: string, index: number) => (
                            <div key={index} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
                              <img 
                                src={photo} 
                                alt={`CV page ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onClick={() => handleViewDocument(photo)}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Qualifications */}
            <Collapsible open={expandedSections.qualifications} onOpenChange={() => toggleSection('qualifications')}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-md">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-gray-50/50 rounded-t-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-lg">Qualifications & Specializations</CardTitle>
                    </div>
                    {expandedSections.qualifications ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Qualifications</label>
                        {staff.qualifications && staff.qualifications.length > 0 ? (
                          <ul className="space-y-2">
                            {staff.qualifications.map((qual: string, index: number) => (
                              <li key={index} className="flex items-center gap-2 text-sm">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                                {qual}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No qualifications listed</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Specializations</label>
                        {staff.specializations && staff.specializations.length > 0 ? (
                          <ul className="space-y-2">
                            {staff.specializations.map((spec: string, index: number) => (
                              <li key={index} className="flex items-center gap-2 text-sm">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                                {spec}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No specializations listed</p>
                        )}
                      </div>
                    </div>
                    
                    {staff.qualificationPhotos && staff.qualificationPhotos.length > 0 && (
                      <div className="mt-6">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">Qualification Documents</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {staff.qualificationPhotos.map((photo: string, index: number) => (
                            <div key={index} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
                              <img 
                                src={photo} 
                                alt={`Qualification document ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onClick={() => handleViewDocument(photo)}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-4">
            {/* Medical Information */}
            <Collapsible open={expandedSections.medical} onOpenChange={() => toggleSection('medical')}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-md">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-gray-50/50 rounded-t-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-base">Medical Info</CardTitle>
                    </div>
                    {expandedSections.medical ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blood Group</label>
                      <p className="mt-1 text-sm font-medium">{staff.bloodGroup || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Insurance</label>
                      <p className="mt-1 text-sm font-medium">{staff.insuranceProvider || 'Not provided'}</p>
                      {staff.insuranceNumber && (
                        <p className="text-xs text-gray-500 mt-1">#{staff.insuranceNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Allergies</label>
                      {staff.allergies && staff.allergies.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {staff.allergies.map((allergy: string, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <div className="w-1 h-1 bg-red-400 rounded-full" />
                              {allergy}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">None listed</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medical Conditions</label>
                      {staff.medicalConditions && staff.medicalConditions.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {staff.medicalConditions.map((condition: string, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <div className="w-1 h-1 bg-orange-400 rounded-full" />
                              {condition}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">None listed</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medications</label>
                      {staff.medications && staff.medications.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {staff.medications.map((medication: string, index: number) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <div className="w-1 h-1 bg-blue-400 rounded-full" />
                              {medication}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">None listed</p>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Emergency Contact */}
            <Collapsible open={expandedSections.emergency} onOpenChange={() => toggleSection('emergency')}>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-md">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-gray-50/50 rounded-t-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-base">Emergency Contact</CardTitle>
                    </div>
                    {expandedSections.emergency ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 pt-0 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                      <p className="mt-1 text-sm font-medium">{staff.emergencyContact?.name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relationship</label>
                      <p className="mt-1 text-sm font-medium">{staff.emergencyContact?.relationship || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
                      <p className="mt-1 text-sm font-medium">
                        {staff.emergencyContact?.phone ? (
                          <a 
                            href={`tel:${staff.emergencyContact.phone}`}
                            className="text-primary hover:underline font-medium cursor-pointer"
                          >
                            {staff.emergencyContact.phone}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</label>
                      <p className="mt-1 text-sm">{staff.emergencyContact?.address || 'Not provided'}</p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>

        {/* Document Viewer Modal */}
        {selectedDocument && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">Document Viewer</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedDocument}
                    alt="Document"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 