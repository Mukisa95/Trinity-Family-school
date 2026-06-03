"use client";

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UniformModal } from './uniform-modal';
import { useUniforms, useCreateUniform, useUpdateUniform, useDeleteUniform, useToggleUniformStatus } from '@/lib/hooks/use-uniforms';
import { useClasses } from '@/lib/hooks/use-classes';
import { formatCurrency, parseFormattedMoney } from '@/lib/utils';
import type { UniformItem, UniformFormData, UniformGender, UniformSection } from '@/types';

export function UniformManagement() {
  const { toast } = useToast();
  const { data: uniforms = [], isLoading, error } = useUniforms();
  const { data: classes = [] } = useClasses();
  const createUniform = useCreateUniform();
  const updateUniform = useUpdateUniform();
  const deleteUniform = useDeleteUniform();
  const toggleStatus = useToggleUniformStatus();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUniform, setSelectedUniform] = useState<UniformItem | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  
  // Filters
  const [filterGender, setFilterGender] = useState<UniformGender | ''>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterSection, setFilterSection] = useState<UniformSection | ''>('');
  const [filterGroup, setFilterGroup] = useState<string>('');

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedUniform(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (uniform: UniformItem) => {
    setModalMode('edit');
    setSelectedUniform(uniform);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUniform(null);
  };

  const handleSubmit = async (formData: UniformFormData) => {
    try {
      const uniformData = {
        name: formData.name,
        group: formData.group,
        price: parseFormattedMoney(formData.price),
        gender: formData.gender,
        classType: formData.classType,
        classIds: formData.classType === 'specific' ? formData.classIds || [] : undefined,
        sectionType: formData.sectionType,
        section: formData.sectionType === 'specific' ? formData.section : undefined,
        description: formData.description,
        isActive: true
      };

      if (modalMode === 'add') {
        await createUniform.mutateAsync(uniformData);
        toast({
          title: "Success",
          description: "Uniform item created successfully",
        });
      } else if (selectedUniform) {
        await updateUniform.mutateAsync({
          id: selectedUniform.id,
          data: uniformData
        });
        toast({
          title: "Success",
          description: "Uniform item updated successfully",
        });
      }
      
      handleCloseModal();
    } catch (error) {
      console.error('Error saving uniform:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save uniform item",
      });
    }
  };

  const handleDelete = async (uniformId: string) => {
    if (window.confirm('Are you sure you want to delete this uniform item?')) {
      try {
        await deleteUniform.mutateAsync(uniformId);
        toast({
          title: "Success",
          description: "Uniform item deleted successfully",
        });
      } catch (error) {
        console.error('Error deleting uniform:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete uniform item",
        });
      }
    }
  };

  const handleToggleStatus = async (uniformId: string, currentStatus: boolean) => {
    try {
      await toggleStatus.mutateAsync({ id: uniformId, isActive: !currentStatus });
      toast({
        title: "Success",
        description: `Uniform item ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling uniform status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update uniform status",
      });
    }
  };

  // Filter uniforms based on selected filters
  const filteredUniforms = uniforms.filter(uniform => {
    const matchesGender = !filterGender || uniform.gender === filterGender || uniform.gender === 'all';
    const matchesClass = !filterClass || 
      uniform.classType === 'all' || 
      (uniform.classType === 'specific' && uniform.classIds?.includes(filterClass));
    const matchesSection = !filterSection || 
      uniform.sectionType === 'all' || 
      (uniform.sectionType === 'specific' && uniform.section === filterSection);
    const matchesGroup = !filterGroup || uniform.group === filterGroup;
    
    return matchesGender && matchesClass && matchesSection && matchesGroup;
  });

  // Get unique groups for filter
  const uniqueGroups = Array.from(new Set(uniforms.map(u => u.group))).sort();

  const getGenderBadgeVariant = (gender: UniformGender) => {
    switch (gender) {
      case 'male': return 'default';
      case 'female': return 'secondary';
      default: return 'outline';
    }
  };

  const getGenderLabel = (gender: UniformGender) => {
    switch (gender) {
      case 'male': return 'Boys Only';
      case 'female': return 'Girls Only';
      default: return 'All Students';
    }
  };

  const getClassLabel = (classType: string, classIds?: string[]) => {
    if (classType === 'all') return 'All Classes';
    if (!classIds || classIds.length === 0) return 'No Classes';
    
    const selectedClasses = classes.filter(cls => classIds.includes(cls.id));
    if (selectedClasses.length === 0) return 'Unknown Classes';
    if (selectedClasses.length === 1) return selectedClasses[0].name;
    return `${selectedClasses.length} Classes`;
  };

  const getSectionLabel = (sectionType: string, section?: string) => {
    if (sectionType === 'all') return 'All Sections';
    return section ? `${section} Section` : 'Unknown Section';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading uniforms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load uniforms. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Uniform Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage school uniform items and pricing</p>
        </div>
        <Button onClick={handleOpenAddModal} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add New Uniform
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
                {classes.map((cls) => (
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
            {uniqueGroups.length > 0 && (
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uniforms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Uniform Items ({filteredUniforms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUniforms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No uniform items found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUniforms.map((uniform) => (
                    <TableRow key={uniform.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{uniform.name}</div>
                          {uniform.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {uniform.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{uniform.group}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(uniform.price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getGenderBadgeVariant(uniform.gender)}>
                          {getGenderLabel(uniform.gender)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getClassLabel(uniform.classType, uniform.classIds)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getSectionLabel(uniform.sectionType, uniform.section)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={uniform.isActive ? 'default' : 'secondary'}>
                          {uniform.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(uniform.id, uniform.isActive)}
                            title={uniform.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {uniform.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(uniform)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(uniform.id)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <UniformModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={selectedUniform ? {
          name: selectedUniform.name,
          price: selectedUniform.price.toString(),
          group: selectedUniform.group,
          gender: selectedUniform.gender,
          classType: selectedUniform.classType,
          classIds: selectedUniform.classIds || [],
          sectionType: selectedUniform.sectionType,
          section: selectedUniform.section,
          description: selectedUniform.description || ''
        } : undefined}
        mode={modalMode}
      />
    </div>
  );
} 