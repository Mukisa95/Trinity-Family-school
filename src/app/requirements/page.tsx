"use client";

import React, { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequirementModal } from '@/components/common/requirement-modal';
import { 
  Plus, 
  Edit, 
  Trash2, 
  BookOpen,
  Filter,
  Package,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  Search,
  X,
  Loader2,
  MoreHorizontal,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatCurrency, parseFormattedMoney } from '@/lib/utils';
import { useClasses } from '@/lib/hooks/use-classes';
import { 
  useRequirements, 
  useCreateRequirement, 
  useUpdateRequirement, 
  useDeleteRequirement,
  useToggleRequirementStatus
} from '@/lib/hooks/use-requirements';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { RecessStatusBanner } from '@/components/common/recess-status-banner';
import type { 
  RequirementItem, 
  RequirementFormData, 
  RequirementGender, 
  RequirementSection,
  Class
} from '@/types';

function RequirementsManagementContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<RequirementGender | ''>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<RequirementSection | ''>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Hooks
  const { data: requirements = [], isLoading } = useRequirements();
  const { data: classes = [] } = useClasses();
  const createRequirementMutation = useCreateRequirement();
  const updateRequirementMutation = useUpdateRequirement();
  const deleteRequirementMutation = useDeleteRequirement();
  const toggleStatusMutation = useToggleRequirementStatus();

  // Get unique groups for filtering
  const uniqueGroups = Array.from(new Set(requirements.map(req => req.group))).sort();

  // Filter requirements
  const filteredRequirements = requirements.filter(requirement => {
    const matchesSearch = !searchTerm || 
      requirement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      requirement.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      requirement.group.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGender = !filterGender || requirement.gender === filterGender || requirement.gender === 'all';
    const matchesClass = !filterClass || 
      requirement.classType === 'all' || 
      (requirement.classType === 'specific' && requirement.classIds?.includes(filterClass));
    const matchesSection = !filterSection || 
      requirement.sectionType === 'all' || 
      (requirement.sectionType === 'specific' && requirement.section === filterSection);
    const matchesGroup = !filterGroup || requirement.group === filterGroup;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && requirement.isActive) ||
      (filterStatus === 'inactive' && !requirement.isActive);
    
    return matchesSearch && matchesGender && matchesClass && matchesSection && matchesGroup && matchesStatus;
  });

  // Calculate stats
  const totalRequirements = requirements.length;
  const activeRequirements = requirements.filter(r => r.isActive).length;
  const totalGroups = uniqueGroups.length;
  const totalValue = requirements.reduce((sum, req) => sum + (req.price || 0), 0);

  // Modal handlers
  const handleOpenAddModal = () => {
    setSelectedRequirement(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (requirement: RequirementItem) => {
    setSelectedRequirement(requirement);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequirement(null);
  };

  const handleSubmit = async (formData: RequirementFormData) => {
    try {
      const requirementData = {
        name: formData.name,
        group: formData.group,
        price: parseFormattedMoney(formData.price),
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        gender: formData.gender,
        classType: formData.classType,
        classIds: formData.classType === 'specific' ? formData.classIds : undefined,
        sectionType: formData.sectionType,
        section: formData.sectionType === 'specific' ? formData.section : undefined,
        frequency: formData.frequency,
        description: formData.description,
        isActive: true
      };

      if (selectedRequirement) {
        await updateRequirementMutation.mutateAsync({
          id: selectedRequirement.id,
          data: requirementData
        });
      } else {
        await createRequirementMutation.mutateAsync(requirementData);
      }
      
      handleCloseModal();
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert('Failed to save requirement. Please try again.');
    }
  };

  const handleDelete = async (requirement: RequirementItem) => {
    if (window.confirm(`Are you sure you want to delete "${requirement.name}"?`)) {
      try {
        await deleteRequirementMutation.mutateAsync(requirement.id);
      } catch (error) {
        console.error('Error deleting requirement:', error);
        alert('Failed to delete requirement. Please try again.');
      }
    }
  };

  const handleToggleStatus = async (requirement: RequirementItem) => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: requirement.id,
        isActive: !requirement.isActive
      });
    } catch (error) {
      console.error('Error toggling requirement status:', error);
      alert('Failed to update requirement status. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterGender('');
    setFilterClass('');
    setFilterSection('');
    setFilterGroup('');
    setFilterStatus('all');
  };

  const hasActiveFilters = searchTerm || filterGender || filterClass || filterSection || filterGroup || filterStatus !== 'all';

  // Helper functions for display
  const getGenderLabel = (gender: RequirementGender) => {
    switch (gender) {
      case 'male': return 'Boys';
      case 'female': return 'Girls';
      default: return 'All';
    }
  };

  const getClassLabel = (classType: string, classIds?: string[]) => {
    if (classType === 'all') return 'All Classes';
    if (!classIds || classIds.length === 0) return 'None';
    
    const selectedClasses = classes.filter((cls: Class) => classIds.includes(cls.id));
    if (selectedClasses.length === 0) return 'Unknown';
    if (selectedClasses.length <= 2) {
      return selectedClasses.map(cls => cls.name).join(', ');
    }
    return `${selectedClasses[0].name} +${selectedClasses.length - 1}`;
  };

  const getSectionLabel = (sectionType: string, section?: string) => {
    if (sectionType === 'all') return 'All';
    return section === 'Day' ? 'Day' : section === 'Boarding' ? 'Boarding' : 'Unknown';
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'termly': return 'Termly';
      case 'yearly': return 'Yearly';
      case 'one-time': return 'One-time';
      default: return frequency;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Requirements</h1>
                <p className="text-sm text-gray-600">Manage school supplies and requirements</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="text-xs"
              >
                <Filter className="w-3 h-3 mr-1" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 text-xs">
                    {[searchTerm, filterGender, filterClass, filterSection, filterGroup, filterStatus !== 'all'].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={handleOpenAddModal}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Recess Status Banner */}
        <RecessStatusBanner />
        
        {/* Compact Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-gray-900">{totalRequirements}</p>
              </div>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-lg font-bold text-green-600">{activeRequirements}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Groups</p>
                <p className="text-lg font-bold text-purple-600">{totalGroups}</p>
              </div>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Value</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(totalValue)}</p>
              </div>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Compact Filters */}
        {showFilters && (
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search requirements..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterGender} onValueChange={(value) => setFilterGender(value as RequirementGender | '')}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="all">All Students</SelectItem>
                      <SelectItem value="male">Boys</SelectItem>
                      <SelectItem value="female">Girls</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue placeholder="Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Classes</SelectItem>
                      {classes.map((cls: Class) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterSection} onValueChange={(value) => setFilterSection(value as RequirementSection | '')}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Boarding">Boarding</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue placeholder="Group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Groups</SelectItem>
                      {uniqueGroups.map((group) => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'active' | 'inactive')}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="h-9 px-2 text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requirements Grid */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Requirements</CardTitle>
                <p className="text-sm text-gray-600">
                  {filteredRequirements.length} of {totalRequirements} requirements
                  {hasActiveFilters && ' (filtered)'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRequirements.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-1">
                  {requirements.length === 0 ? 'No requirements yet' : 'No matching requirements'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {requirements.length === 0 
                    ? 'Get started by adding the first requirement.'
                    : 'Try adjusting your filters.'
                  }
                </p>
                {requirements.length === 0 && (
                  <Button 
                    onClick={handleOpenAddModal}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add First Requirement
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredRequirements.map((requirement) => (
                  <div key={requirement.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Icon and Main Info */}
                      <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-green-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">
                              {requirement.name}
                            </h3>
                            {requirement.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                                {requirement.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant={requirement.isActive ? 'default' : 'outline'}
                              className={`text-xs ${requirement.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {requirement.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="font-medium text-green-700 text-sm">
                              {formatCurrency(requirement.price || 0)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Compact Details */}
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {requirement.group}
                          </span>
                          <span>{getGenderLabel(requirement.gender)}</span>
                          <span>{getClassLabel(requirement.classType, requirement.classIds)}</span>
                          <span>{getSectionLabel(requirement.sectionType, requirement.section)}</span>
                          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                            {getFrequencyLabel(requirement.frequency)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          onClick={() => handleToggleStatus(requirement)}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title={requirement.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {requirement.isActive ? (
                            <EyeOff className="w-3 h-3 text-orange-600" />
                          ) : (
                            <Eye className="w-3 h-3 text-green-600" />
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => handleOpenEditModal(requirement)}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Edit"
                        >
                          <Edit className="w-3 h-3 text-blue-600" />
                        </Button>

                        <Button
                          onClick={() => handleDelete(requirement)}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <RequirementModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        selectedRequirement={selectedRequirement}
        classes={classes}
      />
    </div>
  );
}

export default function RequirementsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Loading...</h2>
          <p className="text-sm text-gray-600">Getting requirements data</p>
        </div>
      </div>
    }>
      <RequirementsManagementContent />
    </Suspense>
  );
} 