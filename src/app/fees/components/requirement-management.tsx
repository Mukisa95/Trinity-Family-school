"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RequirementModal } from '@/components/common/requirement-modal';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  DollarSign, 
  Search, 
  X, 
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
import type { 
  RequirementItem, 
  RequirementFormData, 
  RequirementGender, 
  RequirementSection,
  Class
} from '@/types';

interface RequirementManagementProps {
  showFilters: boolean;
  addTrigger: number;
}

export function RequirementManagement({ showFilters, addTrigger }: RequirementManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<RequirementGender | ''>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<RequirementSection | ''>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Hooks
  const { data: requirements = [], isLoading } = useRequirements();
  const { data: classes = [] } = useClasses();
  const createRequirementMutation = useCreateRequirement();
  const updateRequirementMutation = useUpdateRequirement();
  const deleteRequirementMutation = useDeleteRequirement();
  const toggleStatusMutation = useToggleRequirementStatus();

  // Handle parent adding trigger
  useEffect(() => {
    if (addTrigger > 0) {
      handleOpenAddModal();
    }
  }, [addTrigger]);

  // Get unique groups for filtering
  const uniqueGroups = Array.from(new Set((requirements || []).map(req => req.group).filter(Boolean))).sort();

  // Filter requirements
  const filteredRequirements = (requirements || []).filter(requirement => {
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
  const totalRequirements = requirements?.length || 0;

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
    
    const selectedClasses = (classes || []).filter((cls: Class) => classIds.includes(cls.id));
    if (selectedClasses.length === 0) return 'Unknown';
    if (selectedClasses.length <= 2) {
      return selectedClasses.map(cls => cls.name).join(', ');
    }
    return `${selectedClasses[0].name} +${selectedClasses.length - 1}`;
  };

  const getSectionLabel = (sectionType: string, section?: string) => {
    if (sectionType === 'all') return 'All Sections';
    return section ? `${section} Section` : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <Card className="border-gray-200 dark:border-slate-700">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Filter Requirements</CardTitle>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40"
              >
                <X className="w-3 h-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full p-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Gender Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Gender</label>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value as RequirementGender | '')}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All Genders</option>
                  <option value="all">All Students</option>
                  <option value="male">Boys Only</option>
                  <option value="female">Girls Only</option>
                </select>
              </div>

              {/* Class Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Class</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All Classes</option>
                  {(classes || []).map((cls: Class) => (
                    <option key={cls?.id} value={cls?.id}>{cls?.name}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Section</label>
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value as RequirementSection | '')}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All Sections</option>
                  <option value="Day">Day Section</option>
                  <option value="Boarding">Boarding Section</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements List */}
      <Card className="border-gray-200 shadow-sm dark:border-slate-700">
        <CardHeader className="py-4 px-6">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-slate-100">Required Items</CardTitle>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {filteredRequirements.length} of {totalRequirements} requirements
            {filteredRequirements.length !== totalRequirements && ' (filtered)'}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg dark:bg-slate-900">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 dark:bg-slate-900">
                <Package className="w-8 h-8 text-gray-400 dark:text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-slate-100">
                {requirements.length === 0 ? 'No requirements setup yet' : 'No matching requirements'}
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto dark:text-slate-300">
                {requirements.length === 0 
                  ? 'Setup the standard requirements list (like brooms, books, toilet papers) that students should bring.'
                  : 'Try adjusting your filters or search query.'
                }
              </p>
              {requirements.length === 0 && (
                <Button 
                  onClick={handleOpenAddModal}
                  className="bg-gradient-to-r from-green-600 to-brand-surface-600 hover:from-green-700 hover:to-brand-surface-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Requirement
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredRequirements.map((requirement) => (
                <div key={requirement.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors dark:hover:bg-slate-900">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-50 border border-green-100 rounded-lg shrink-0 dark:bg-green-950/40 dark:border-green-800/60">
                          <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="text-base font-semibold text-gray-900 truncate dark:text-slate-100">
                              {requirement.name}
                            </h3>
                            <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-900">
                              {requirement.group}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getGenderLabel(requirement.gender)}
                            </Badge>
                            <Badge 
                              variant={requirement.isActive ? 'default' : 'secondary'}
                              className={`text-xs ${requirement.isActive ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-slate-900 dark:text-slate-300'}`}
                            >
                              {requirement.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          
                          {requirement.description && (
                            <p className="text-sm text-gray-600 mb-3 dark:text-slate-300">
                              {requirement.description}
                            </p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600 dark:text-slate-300">
                            <div>
                              <span className="text-xs text-gray-400 block dark:text-slate-400">Class</span>
                              <span className="font-medium text-gray-900 dark:text-slate-100">{getClassLabel(requirement.classType, requirement.classIds)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 block dark:text-slate-400">Section</span>
                              <span className="font-medium text-gray-900 dark:text-slate-100">{getSectionLabel(requirement.sectionType, requirement.section)}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 block dark:text-slate-400">Quantity</span>
                              <span className="font-medium text-gray-900 dark:text-slate-100">
                                {requirement.quantity || 1} ({requirement.frequency || 'once'})
                              </span>
                            </div>
                            {requirement.price && (
                              <div>
                                <span className="text-xs text-gray-400 block dark:text-slate-400">Or Pay Equivalent</span>
                                <span className="font-semibold text-green-700 dark:text-green-300">
                                  {formatCurrency(requirement.price)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center lg:justify-end gap-1 shrink-0">
                      <Button
                        onClick={() => handleToggleStatus(requirement)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title={requirement.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {requirement.isActive ? (
                          <EyeOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => handleOpenEditModal(requirement)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-brand-ink-600 dark:text-brand-ink-400" />
                      </Button>

                      <Button
                        onClick={() => handleDelete(requirement)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
