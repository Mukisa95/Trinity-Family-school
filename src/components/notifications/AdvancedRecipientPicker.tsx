'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Users,
    GraduationCap,
    Briefcase,
    Search,
    CheckSquare,
    Square,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemUser, NotificationRecipient } from '@/types';
import { useUsers } from '@/lib/hooks/use-users';

interface AdvancedRecipientPickerProps {
    selectedRecipients: NotificationRecipient[];
    onRecipientsChange: (recipients: NotificationRecipient[]) => void;
}

type RecipientGroup = 'quick' | 'parents' | 'staff';

/**
 * 🎯 Advanced Recipient Picker
 * 
 * Uses the SAME useUsers hook as the Users Management page.
 * Fetches all SystemUser accounts from the 'users' Firestore collection.
 */
export function AdvancedRecipientPicker({
    selectedRecipients,
    onRecipientsChange
}: AdvancedRecipientPickerProps) {
    const [activeGroup, setActiveGroup] = useState<RecipientGroup>('quick');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // 🔥 Use the same optimized useUsers hook as the Users Management page
    // This hook has a real-time listener and React Query caching for instant loading
    const { data: allUsers = [], isLoading: isLoadingUsers } = useUsers();

    console.log(`📊 AdvancedRecipientPicker: Loaded ${allUsers.length} users from useUsers hook`);
    
    // Filter to only show ACTIVE users
    const activeUsers = useMemo(() => {
        const active = allUsers.filter(u => u.isActive !== false);
        console.log(`✅ Active users: ${active.length} (${active.filter(u => u.role === 'Staff' || u.role === 'Admin').length} staff, ${active.filter(u => u.role === 'Parent').length} parents)`);
        return active;
    }, [allUsers]);

    // Separate users by role
    const staffUsers = useMemo(() => {
        const staff = activeUsers.filter(u => u.role === 'Staff' || u.role === 'Admin');
        return staff;
    }, [activeUsers]);

    const parentUsers = useMemo(() => {
        const parents = activeUsers.filter(u => u.role === 'Parent');
        return parents;
    }, [activeUsers]);

    // Filtered lists based on search
    const filteredStaff = useMemo(() => {
        return staffUsers.filter(user => {
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const name = `${user.firstName || ''} ${user.lastName || ''} ${user.username || ''}`.toLowerCase();
            const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
            return matchesRole && matchesSearch;
        });
    }, [staffUsers, roleFilter, searchQuery]);

    const filteredParents = useMemo(() => {
        return parentUsers.filter(user => {
            const name = `${user.firstName || ''} ${user.lastName || ''} ${user.username || ''}`.toLowerCase();
            const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [parentUsers, searchQuery]);

    // Check if a recipient is selected
    const isSelected = (id: string, type: string) => {
        return selectedRecipients.some(r => r.id === id && r.type === type);
    };

    // Toggle a recipient
    const toggleRecipient = (recipient: NotificationRecipient) => {
        if (isSelected(recipient.id, recipient.type)) {
            onRecipientsChange(selectedRecipients.filter(r => !(r.id === recipient.id && r.type === recipient.type)));
        } else {
            onRecipientsChange([...selectedRecipients, recipient]);
        }
    };

    // Select all filtered items
    const selectAllFiltered = (users: SystemUser[]) => {
        const newRecipients = users
            .filter(user => !isSelected(user.id, 'user'))
            .map(user => ({
                id: user.id,
                type: 'user' as const,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.id
            }));
        onRecipientsChange([...selectedRecipients, ...newRecipients]);
    };

    // Deselect all filtered items  
    const deselectAllFiltered = (users: SystemUser[]) => {
        const idsToRemove = new Set(users.map(u => u.id));
        onRecipientsChange(selectedRecipients.filter(r => !(idsToRemove.has(r.id) && r.type === 'user')));
    };

    // Count selected in current filter
    const countSelected = (users: SystemUser[]) => {
        return users.filter(user => isSelected(user.id, 'user')).length;
    };

    // Get display name for a user
    const getUserDisplayName = (user: SystemUser) => {
        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`;
        }
        return user.username || user.email || 'Unknown User';
    };

    // Quick select options
    const quickOptions: NotificationRecipient[] = [
        { id: 'all_users', type: 'all_users', name: 'All Users' },
        { id: 'all_staff', type: 'all_staff', name: 'All Staff Members' },
        { id: 'all_parents', type: 'all_parents', name: 'All Parents' },
        { id: 'all_admins', type: 'all_admins', name: 'All Administrators' },
    ];

    return (
        <div className="space-y-4">
            {/* Selected Recipients Summary */}
            {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Selected ({selectedRecipients.length}):
                    </span>
                    {selectedRecipients.slice(0, 5).map(r => (
                        <Badge
                            key={`${r.type}-${r.id}`}
                            variant="secondary"
                            className="cursor-pointer hover:bg-red-100"
                            onClick={() => toggleRecipient(r)}
                        >
                            {r.name} ×
                        </Badge>
                    ))}
                    {selectedRecipients.length > 5 && (
                        <Badge variant="outline">+{selectedRecipients.length - 5} more</Badge>
                    )}
                </div>
            )}

            {/* User Stats */}
            <div className="flex gap-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {allUsers.length} total users
                </span>
                <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {staffUsers.length} staff
                </span>
                <span className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4" />
                    {parentUsers.length} parents
                </span>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b">
                <button
                    onClick={() => setActiveGroup('quick')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeGroup === 'quick'
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Users className="w-4 h-4 inline mr-2" />
                    Quick Select
                </button>
                <button
                    onClick={() => { setActiveGroup('parents'); setSearchQuery(''); }}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeGroup === 'parents'
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <GraduationCap className="w-4 h-4 inline mr-2" />
                    Parents ({parentUsers.length})
                </button>
                <button
                    onClick={() => { setActiveGroup('staff'); setSearchQuery(''); }}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeGroup === 'staff'
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                >
                    <Briefcase className="w-4 h-4 inline mr-2" />
                    Staff ({staffUsers.length})
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
                {isLoadingUsers ? (
                    <div className="flex flex-col justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                        <p className="text-gray-500">Loading users...</p>
                    </div>
                ) : (
                    <>
                        {/* Quick Select */}
                        {activeGroup === 'quick' && (
                            <div className="grid grid-cols-2 gap-3">
                                {quickOptions.map(option => (
                                    <div
                                        key={option.id}
                                        onClick={() => toggleRecipient(option)}
                                        className={cn(
                                            "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                                            isSelected(option.id, option.type)
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                : "border-gray-200 hover:border-gray-300"
                                        )}
                                    >
                                        <Checkbox checked={isSelected(option.id, option.type)} />
                                        <div>
                                            <p className="font-medium">{option.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {option.id === 'all_users' && `${allUsers.length} users`}
                                                {option.id === 'all_staff' && `${staffUsers.length} staff`}
                                                {option.id === 'all_parents' && `${parentUsers.length} parents`}
                                                {option.id === 'all_admins' && `${allUsers.filter(u => u.role === 'Admin').length} admins`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Parents Tab */}
                        {activeGroup === 'parents' && (
                            <div className="space-y-3">
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            placeholder="Search parents..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    {filteredParents.length > 0 && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => selectAllFiltered(filteredParents)}
                                                disabled={countSelected(filteredParents) === filteredParents.length}
                                            >
                                                <CheckSquare className="w-4 h-4 mr-1" />
                                                Select All ({filteredParents.length})
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => deselectAllFiltered(filteredParents)}
                                                disabled={countSelected(filteredParents) === 0}
                                            >
                                                <Square className="w-4 h-4 mr-1" />
                                                Deselect All
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-[400px] overflow-y-auto space-y-2">
                                    {filteredParents.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No parents found</p>
                                    ) : (
                                        filteredParents.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleRecipient({
                                                    id: user.id,
                                                    type: 'user',
                                                    name: getUserDisplayName(user)
                                                })}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                    isSelected(user.id, 'user')
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                        : "border-gray-200 hover:border-gray-300"
                                                )}
                                            >
                                                <Checkbox checked={isSelected(user.id, 'user')} />
                                                <div className="flex-1">
                                                    <p className="font-medium">{getUserDisplayName(user)}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {user.email || user.username || 'No contact'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Staff Tab */}
                        {activeGroup === 'staff' && (
                            <div className="space-y-3">
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            placeholder="Search staff..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    {filteredStaff.length > 0 && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => selectAllFiltered(filteredStaff)}
                                                disabled={countSelected(filteredStaff) === filteredStaff.length}
                                            >
                                                <CheckSquare className="w-4 h-4 mr-1" />
                                                Select All ({filteredStaff.length})
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => deselectAllFiltered(filteredStaff)}
                                                disabled={countSelected(filteredStaff) === 0}
                                            >
                                                <Square className="w-4 h-4 mr-1" />
                                                Deselect All
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-[400px] overflow-y-auto space-y-2">
                                    {filteredStaff.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No staff found</p>
                                    ) : (
                                        filteredStaff.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleRecipient({
                                                    id: user.id,
                                                    type: 'user',
                                                    name: getUserDisplayName(user)
                                                })}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                    isSelected(user.id, 'user')
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                                        : "border-gray-200 hover:border-gray-300"
                                                )}
                                            >
                                                <Checkbox checked={isSelected(user.id, 'user')} />
                                                <div className="flex-1">
                                                    <p className="font-medium">{getUserDisplayName(user)}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {user.email || user.username || user.role}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default AdvancedRecipientPicker;
