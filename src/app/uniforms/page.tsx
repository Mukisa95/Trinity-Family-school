"use client";

import React, { useState, Suspense } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Filter, Package, DollarSign, Users, CheckCircle, XCircle, Loader2, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { UniformModal } from '@/components/common/uniform-modal';
import { useUniforms, useCreateUniform, useUpdateUniform, useDeleteUniform, useToggleUniformStatus } from '@/lib/hooks/use-uniforms';
import { useClasses } from '@/lib/hooks/use-classes';
import { formatCurrency, parseFormattedMoney } from '@/lib/utils';
import type { UniformItem, UniformFormData, UniformGender, UniformSection } from '@/types';

function UniformManagementContent() {
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
  const [showFilters, setShowFilters] = useState(false);
  
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
  const filteredUniforms = (uniforms || []).filter(uniform => {
    if (!uniform) return false;
    
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
  const uniqueGroups = Array.from(new Set((uniforms || []).map(u => u?.group).filter(Boolean))).sort();

  // Calculate stats
  const totalUniforms = uniforms?.length || 0;
  const activeUniforms = uniforms?.filter(u => u.isActive).length || 0;
  const totalGroups = uniqueGroups?.length || 0;
  const averagePrice = totalUniforms > 0 ? 
    uniforms.reduce((sum, u) => sum + (u.price || 0), 0) / totalUniforms : 0;

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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-200 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Uniforms</h2>
          <p className="text-gray-600 mb-6">Failed to load uniforms. Please try again later.</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pb-20">
      {/* Modern Header */}
      <div className="bg-white/80 border-b shadow-sm backdrop-blur-xl sticky top-0 z-10 border-b-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            {/* Title and Actions */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-purple-900 mb-2 flex items-center gap-2">
                  👕 Uniform Management
                  <Shirt className="w-7 h-7" />
                </h1>
                <p className="text-gray-600 text-sm">
                  Manage school uniform items, pricing, and availability for different classes and sections
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
                <Button
                  onClick={handleOpenAddModal}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Uniform
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Uniforms */}
          <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Total Uniforms</h3>
                  <p className="text-2xl font-bold text-purple-900">{totalUniforms}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shirt className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Uniforms */}
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Active Uniforms</h3>
                  <p className="text-2xl font-bold text-blue-900">{activeUniforms}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalUniforms - activeUniforms} inactive
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Groups */}
          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Uniform Groups</h3>
                  <p className="text-2xl font-bold text-green-900">{totalGroups}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Price */}
          <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Average Price</h3>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatCurrency(averagePrice)}
                  </p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Filter Uniforms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Gender Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Gender</label>
                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value as UniformGender | '')}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Genders</option>
                    <option value="all">All Students</option>
                    <option value="male">Boys Only</option>
                    <option value="female">Girls Only</option>
                  </select>
                </div>

                {/* Class Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Class</label>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Classes</option>
                    {(classes || []).map((cls) => (
                      <option key={cls?.id} value={cls?.id}>{cls?.name}</option>
                    ))}
                  </select>
                </div>

                {/* Section Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Section</label>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value as UniformSection | '')}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Sections</option>
                    <option value="Day">Day Section</option>
                    <option value="Boarding">Boarding Section</option>
                  </select>
                </div>

                {/* Group Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Group</label>
                  <select
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Groups</option>
                    {uniqueGroups.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uniforms Grid */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Uniform Items</CardTitle>
            <p className="text-sm text-gray-600">
              {filteredUniforms.length} of {totalUniforms} uniforms
              {filteredUniforms.length !== totalUniforms && ' (filtered)'}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUniforms.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Shirt className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {uniforms.length === 0 ? 'No uniforms yet' : 'No matching uniforms'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {uniforms.length === 0 
                    ? 'Get started by adding the first uniform item for your school.'
                    : 'Try adjusting your filters to see more uniforms.'
                  }
                </p>
                {uniforms.length === 0 && (
                  <Button 
                    onClick={handleOpenAddModal}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Uniform
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUniforms.map((uniform) => (
                  <div key={uniform.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Uniform Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Shirt className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-base font-semibold text-gray-900 truncate">
                                {uniform.name}
                              </h3>
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {uniform.group}
                              </Badge>
                              <Badge 
                                variant={getGenderBadgeVariant(uniform.gender)}
                                className="text-xs"
                              >
                                {getGenderLabel(uniform.gender)}
                              </Badge>
                              <Badge 
                                variant={uniform.isActive ? 'default' : 'outline'}
                                className={`text-xs ${uniform.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                              >
                                {uniform.isActive ? '✅ Active' : '❌ Inactive'}
                              </Badge>
                            </div>
                            
                            {uniform.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {uniform.description}
                              </p>
                            )}

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500 text-xs">Price</p>
                                <p className="font-medium text-purple-700">
                                  {formatCurrency(uniform.price)}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-gray-500 text-xs">Classes</p>
                                <p className="font-medium text-gray-900">
                                  {getClassLabel(uniform.classType, uniform.classIds)}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-gray-500 text-xs">Section</p>
                                <p className="font-medium text-gray-900">
                                  {getSectionLabel(uniform.sectionType, uniform.section)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 justify-center lg:justify-end">
                        <Button
                          onClick={() => handleToggleStatus(uniform.id, uniform.isActive)}
                          size="sm"
                          variant="outline"
                          className={`text-xs ${uniform.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                        >
                          {uniform.isActive ? (
                            <>
                              <EyeOff className="w-3 h-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => handleOpenEditModal(uniform)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>

                        <Button
                          onClick={() => handleDelete(uniform.id)}
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
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
      <UniformModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        mode={modalMode}
        selectedUniform={selectedUniform}
        classes={classes || []}
      />
    </div>
  );
}

export default function UniformsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Getting uniform data</p>
        </div>
      </div>
    }>
      <UniformManagementContent />
    </Suspense>
  );
} 