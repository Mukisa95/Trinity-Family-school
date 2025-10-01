"use client";

import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Users, Save, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useClasses } from '@/lib/hooks/use-classes';
import { useRecordParentAttendance } from '@/lib/hooks/use-event-attendance';
import { useToast } from '@/hooks/use-toast';
import type { Event, Pupil } from '@/types';
import type { ParentAttendanceFormData } from '@/types/attendance';

interface ParentAttendanceFormProps {
  eventId: string;
  event: Event;
}

interface SelectedPupil {
  pupilId: string;
  pupilName: string;
  className: string;
}

interface AttendeeDetails {
  id: string;
  name: string;
  contacts: string[];
  address?: string;
  relationship?: string;
  reason?: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

interface AttendeeGroup {
  id: string;
  representedPupils: SelectedPupil[];
  attendees: AttendeeDetails[];
}

export function ParentAttendanceForm({ eventId, event }: ParentAttendanceFormProps) {
  const [attendeeGroups, setAttendeeGroups] = useState<AttendeeGroup[]>([]);
  const [pupilSearchTerm, setPupilSearchTerm] = useState('');
  const [selectedPupils, setSelectedPupils] = useState<SelectedPupil[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { data: allPupils = [] } = usePupils();
  const { data: allClasses = [] } = useClasses();
  const { recordAttendance, loading: isRecording, error } = useRecordParentAttendance();
  const { toast } = useToast();

  // Search pupils functionality
  const searchResults = useMemo(() => {
    if (!pupilSearchTerm.trim()) return [];
    
    const searchLower = pupilSearchTerm.toLowerCase().trim();
    const filteredPupils = allPupils.filter(pupil => {
      const fullName = `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ''}`.toLowerCase();
      const className = allClasses.find(cls => cls.id === pupil.classId)?.name || '';
      return (
        fullName.includes(searchLower) || 
        className.toLowerCase().includes(searchLower) ||
        pupil.id.toLowerCase().includes(searchLower)
      );
    });

    return filteredPupils.slice(0, 10); // Limit to 10 results
  }, [pupilSearchTerm, allPupils, allClasses]);

  const addPupilToSelection = (pupil: Pupil) => {
    const className = allClasses.find(cls => cls.id === pupil.classId)?.name || 'Unknown Class';
    const selectedPupil: SelectedPupil = {
      pupilId: pupil.id,
      pupilName: `${pupil.firstName} ${pupil.lastName}`,
      className,
    };

    if (!selectedPupils.some(p => p.pupilId === pupil.id)) {
      setSelectedPupils(prev => [...prev, selectedPupil]);
    }
    setPupilSearchTerm('');
  };

  const removePupilFromSelection = (pupilId: string) => {
    setSelectedPupils(prev => prev.filter(p => p.pupilId !== pupilId));
  };

  const createAttendeeGroup = () => {
    if (selectedPupils.length === 0) {
      alert('Please select at least one pupil first');
      return;
    }

    const newGroup: AttendeeGroup = {
      id: Date.now().toString(),
      representedPupils: [...selectedPupils],
      attendees: [createNewAttendee()],
    };

    setAttendeeGroups(prev => [...prev, newGroup]);
    setSelectedPupils([]);
  };

  const createNewAttendee = (): AttendeeDetails => ({
    id: Date.now().toString(),
    name: '',
    contacts: [''],
    address: '',
    relationship: '',
    reason: '',
    status: 'present',
    notes: '',
  });

  const addAttendeeToGroup = (groupId: string) => {
    const newAttendee = createNewAttendee();
    setAttendeeGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, attendees: [...group.attendees, newAttendee] }
        : group
    ));
  };

  const updateAttendee = (groupId: string, attendeeId: string, updates: Partial<AttendeeDetails>) => {
    setAttendeeGroups(prev => prev.map(group => 
      group.id === groupId 
        ? {
            ...group,
            attendees: group.attendees.map(attendee =>
              attendee.id === attendeeId ? { ...attendee, ...updates } : attendee
            )
          }
        : group
    ));
  };

  const removeAttendee = (groupId: string, attendeeId: string) => {
    setAttendeeGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, attendees: group.attendees.filter(a => a.id !== attendeeId) }
        : group
    ));
  };

  const removeGroup = (groupId: string) => {
    setAttendeeGroups(prev => prev.filter(group => group.id !== groupId));
  };

  const addContactToAttendee = (groupId: string, attendeeId: string) => {
    const group = attendeeGroups.find(g => g.id === groupId);
    const attendee = group?.attendees.find(a => a.id === attendeeId);
    if (attendee) {
      updateAttendee(groupId, attendeeId, {
        contacts: [...attendee.contacts, '']
      });
    }
  };

  const updateContact = (groupId: string, attendeeId: string, contactIndex: number, value: string) => {
    const group = attendeeGroups.find(g => g.id === groupId);
    const attendee = group?.attendees.find(a => a.id === attendeeId);
    if (attendee) {
      const newContacts = [...attendee.contacts];
      newContacts[contactIndex] = value;
      updateAttendee(groupId, attendeeId, { contacts: newContacts });
    }
  };

  const removeContact = (groupId: string, attendeeId: string, contactIndex: number) => {
    const group = attendeeGroups.find(g => g.id === groupId);
    const attendee = group?.attendees.find(a => a.id === attendeeId);
    if (attendee && attendee.contacts.length > 1) {
      const newContacts = attendee.contacts.filter((_, index) => index !== contactIndex);
      updateAttendee(groupId, attendeeId, { contacts: newContacts });
    }
  };

  const handleSubmit = async () => {
    if (attendeeGroups.length === 0) {
      alert('Please add at least one attendee group');
      return;
    }

    // Validate all groups have attendees with required fields
    for (const group of attendeeGroups) {
      if (group.attendees.length === 0) {
        alert('Each group must have at least one attendee');
        return;
      }
      
      for (const attendee of group.attendees) {
        if (!attendee.name.trim()) {
          alert('All attendees must have a name');
          return;
        }
        if (attendee.contacts.length === 0 || !attendee.contacts[0].trim()) {
          alert('All attendees must have at least one contact');
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const formData: ParentAttendanceFormData = {
        groups: attendeeGroups.map(group => ({
          pupilId: group.representedPupils[0]?.pupilId || '',
          pupilName: group.representedPupils[0]?.pupilName || '',
          className: group.representedPupils[0]?.className || '',
                      attendees: group.attendees.map(attendee => ({
              name: attendee.name,
              relationship: attendee.relationship || '',
              primaryContact: attendee.contacts[0] || '',
              secondaryContact: attendee.contacts[1] || '',
              address: attendee.address || '',
              reason: attendee.reason || '',
            })),
          status: group.attendees[0]?.status || 'present',
        })),
      };

              // Record parent attendance using the new hook
        const success = await recordAttendance(eventId, event, formData);

        if (success) {
          // Show success message
          toast({
            title: "Parent Attendance Recorded",
            description: `Successfully recorded attendance for ${getTotalAttendees()} parent attendee(s).`,
          });
          
          // Reset form
          setAttendeeGroups([]);
          setSelectedPupils([]);
        } else {
          throw new Error('Failed to record attendance');
        }
        
      } catch (error) {
        console.error('Error submitting parent attendance:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record parent attendance. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
  };

  const getTotalAttendees = () => {
    return attendeeGroups.reduce((total, group) => total + group.attendees.length, 0);
  };

  return (
    <div className="space-y-6">
      {/* Pupil Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Select Pupils Being Represented
          </CardTitle>
          <CardDescription>
            Search and select the pupils that the attendees will be representing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Input */}
            <div>
              <Label htmlFor="pupil-search">Search Pupils</Label>
              <Input
                id="pupil-search"
                placeholder="Type pupil name, class, or ID to search..."
                value={pupilSearchTerm}
                onChange={(e) => setPupilSearchTerm(e.target.value)}
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-md">
                <div className="p-2 text-sm text-muted-foreground bg-muted">
                  Search Results ({searchResults.length})
                </div>
                <ScrollArea className="h-48">
                  <div className="p-2 space-y-1">
                    {searchResults.map(pupil => {
                      const className = allClasses.find(cls => cls.id === pupil.classId)?.name || 'Unknown Class';
                      const isSelected = selectedPupils.some(p => p.pupilId === pupil.id);
                      
                      return (
                        <div 
                          key={pupil.id}
                          className={`p-2 rounded-md cursor-pointer hover:bg-muted ${isSelected ? 'bg-green-50 border border-green-200' : ''}`}
                          onClick={() => !isSelected && addPupilToSelection(pupil)}
                        >
                          <div className="font-medium">
                            {pupil.firstName} {pupil.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Class: {className} • ID: {pupil.id}
                          </div>
                          {isSelected && (
                            <Badge variant="secondary" className="mt-1">Already Selected</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Selected Pupils */}
            {selectedPupils.length > 0 && (
              <div>
                <Label>Selected Pupils ({selectedPupils.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPupils.map(pupil => (
                    <Badge key={pupil.pupilId} variant="outline" className="flex items-center gap-1">
                      {pupil.pupilName} ({pupil.className})
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-red-600"
                        onClick={() => removePupilFromSelection(pupil.pupilId)}
                      />
                    </Badge>
                  ))}
                </div>
                <Button 
                  onClick={createAttendeeGroup}
                  className="mt-3"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Attendee Group for These Pupils
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendee Groups */}
      {attendeeGroups.map((group, groupIndex) => (
        <Card key={group.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Attendee Group {groupIndex + 1} 
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({group.attendees.length} attendee{group.attendees.length !== 1 ? 's' : ''})
                </span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeGroup(group.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Representing: {group.representedPupils.map(p => p.pupilName).join(', ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {group.attendees.map((attendee, attendeeIndex) => (
                <div key={attendee.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Attendee {attendeeIndex + 1}</h4>
                    {group.attendees.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAttendee(group.id, attendee.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <Label>Attendee Name *</Label>
                      <Input
                        value={attendee.name}
                        onChange={(e) => updateAttendee(group.id, attendee.id, { name: e.target.value })}
                        placeholder="Full name of attendee"
                      />
                    </div>

                    {/* Relationship */}
                    <div>
                      <Label>Relationship</Label>
                      <Select
                        value={attendee.relationship}
                        onValueChange={(value) => updateAttendee(group.id, attendee.id, { relationship: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Parent">Parent</SelectItem>
                          <SelectItem value="Guardian">Guardian</SelectItem>
                          <SelectItem value="Grandparent">Grandparent</SelectItem>
                          <SelectItem value="Sibling">Sibling</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Contacts */}
                    <div className="md:col-span-2">
                      <Label>Contact Information *</Label>
                      <div className="space-y-2">
                        {attendee.contacts.map((contact, contactIndex) => (
                          <div key={contactIndex} className="flex gap-2">
                            <Input
                              value={contact}
                              onChange={(e) => updateContact(group.id, attendee.id, contactIndex, e.target.value)}
                              placeholder="Phone number or email"
                            />
                            {attendee.contacts.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeContact(group.id, attendee.id, contactIndex)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addContactToAttendee(group.id, attendee.id)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Contact
                        </Button>
                      </div>
                    </div>

                    {/* Status and Notes in one row */}
                    <div>
                      <Label>Attendance Status</Label>
                      <Select
                        value={attendee.status}
                        onValueChange={(value: 'present' | 'absent' | 'late') => 
                          updateAttendee(group.id, attendee.id, { status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Reason for Attendance</Label>
                      <Input
                        value={attendee.reason}
                        onChange={(e) => updateAttendee(group.id, attendee.id, { reason: e.target.value })}
                        placeholder="Why attending?"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => addAttendeeToGroup(group.id)}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Another Attendee for This Group
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Summary and Submit */}
      {attendeeGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{attendeeGroups.length}</div>
                  <div className="text-sm text-muted-foreground">Groups</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{getTotalAttendees()}</div>
                  <div className="text-sm text-muted-foreground">Attendees</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {attendeeGroups.reduce((total, group) => 
                      total + group.representedPupils.length, 0
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Pupils Represented</div>
                </div>
              </div>

              <Separator />

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || attendeeGroups.length === 0}
                className="w-full"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : `Save Parent Attendance (${getTotalAttendees()} attendees)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
