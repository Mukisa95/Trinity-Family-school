"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RequirementModal } from './requirement-modal';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  BookOpen
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

export function RequirementsManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementItem | null>(null);
  const [filterGender, setFilterGender] = useState<RequirementGender | ''>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<RequirementSection | ''>('');
  const [filterGroup, setFilterGroup] = useState<string>('');

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
    const matchesGender = !filterGender || requirement.gender === filterGender || requirement.gender === 'all';
    const matchesClass = !filterClass || 
      requirement.classType === 'all' || 
      (requirement.classType === 'specific' && requirement.classIds?.includes(filterClass));
    const matchesSection = !filterSection || 
      requirement.sectionType === 'all' || 
      (requirement.sectionType === 'specific' && requirement.section === filterSection);
    const matchesGroup = !filterGroup || requirement.group === filterGroup;
    
    return matchesGender && matchesClass && matchesSection && matchesGroup;
  });

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

  // Helper functions for display
  const getGenderLabel = (gender: RequirementGender) => {
    switch (gender) {
      case 'male': return 'Boys Only';
      case 'female': return 'Girls Only';
      default: return 'All Students';
    }
  };

  const getGenderBadgeVariant = (gender: RequirementGender) => {
    switch (gender) {
      case 'male': return 'default';
      case 'female': return 'secondary';
      default: return 'outline';
    }
  };

  const getClassLabel = (classType: string, classIds?: string[]) => {
    if (classType === 'all') return 'All Classes';
    if (!classIds || classIds.length === 0) return 'No Classes';
    
    const selectedClasses = classes.filter((cls: Class) => classIds.includes(cls.id));
    if (selectedClasses.length === 0) return 'Unknown Classes';
    if (selectedClasses.length <= 2) {
      return selectedClasses.map(cls => cls.name).join(', ');
    }
    return `${selectedClasses[0].name} +${selectedClasses.length - 1} more`;
  };

  const getSectionLabel = (sectionType: string, section?: string) => {
    if (sectionType === 'all') return 'All Sections';
    return section === 'Day' ? 'Day Section' : section === 'Boarding' ? 'Boarding Section' : 'Unknown Section';
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'termly': return 'Every Term';
      case 'yearly': return 'Every Year';
      case 'one-time': return 'One Time';
      default: return frequency;
    }
  };

  const getFrequencyBadgeVariant = (frequency: string) => {
    switch (frequency) {
      case 'termly': return 'default';
      case 'yearly': return 'secondary';
      case 'one-time': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Requirements Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage school requirements and supplies
          </p>
        </div>
        <Button onClick={handleOpenAddModal} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Requirement
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Gender Filters */}
            <div>
              <label className="text-sm font-medium mb-2 block">Gender:</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterGender === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterGender('')}
                >
                  All Genders
                </Button>
                <Button
                  variant={filterGender === 'male' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterGender('male')}
                >
                  Boys
                </Button>
                <Button
                  variant={filterGender === 'female' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterGender('female')}
                >
                  Girls
                </Button>
              </div>
            </div>

            {/* Class Filters */}
            <div>
              <label className="text-sm font-medium mb-2 block">Class:</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterClass === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterClass('')}
                >
                  All Classes
                </Button>
                {classes.map((cls: Class) => (
                  <Button
                    key={cls.id}
                    variant={filterClass === cls.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterClass(cls.id)}
                  >
                    {cls.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Section Filters */}
            <div>
              <label className="text-sm font-medium mb-2 block">Section:</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterSection === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterSection('')}
                >
                  All Sections
                </Button>
                <Button
                  variant={filterSection === 'Day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterSection('Day')}
                >
                  Day
                </Button>
                <Button
                  variant={filterSection === 'Boarding' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterSection('Boarding')}
                >
                  Boarding
                </Button>
              </div>
            </div>

            {/* Group Filters */}
            <div>
              <label className="text-sm font-medium mb-2 block">Group:</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterGroup === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterGroup('')}
                >
                  All Groups
                </Button>
                {uniqueGroups.map((group) => (
                  <Button
                    key={group}
                    variant={filterGroup === group ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterGroup(group)}
                  >
                    {group}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements ({filteredRequirements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No requirements found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new requirement.
              </p>
              <div className="mt-6">
                <Button onClick={handleOpenAddModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Requirement
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Gender
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRequirements.map((requirement) => (
                    <tr key={requirement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {requirement.name}
                        </div>
                        {requirement.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {requirement.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {requirement.group}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(requirement.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {requirement.quantity ? `${requirement.quantity}x` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getGenderBadgeVariant(requirement.gender)}>
                          {getGenderLabel(requirement.gender)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline">
                          {getClassLabel(requirement.classType, requirement.classIds)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline">
                          {getSectionLabel(requirement.sectionType, requirement.section)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getFrequencyBadgeVariant(requirement.frequency)}>
                          {getFrequencyLabel(requirement.frequency)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={requirement.isActive ? 'default' : 'secondary'}>
                          {requirement.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(requirement)}
                            title={requirement.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {requirement.isActive ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(requirement)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(requirement)}
                            title="Delete"
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      />
    </div>
  );
} 