"use client"

import React, { useState } from 'react'
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ResponsiveFormDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Responsive Form Demo
      </Button>

      <ModernDialog open={isOpen} onOpenChange={setIsOpen}>
        <ModernDialogContent size="responsive">
          <ModernDialogHeader>
            <ModernDialogTitle>
              Responsive Form Demo
            </ModernDialogTitle>
          </ModernDialogHeader>

          <form className="space-y-4 md:space-y-6">
            {/* This grid will be 1 column on mobile, 2 on tablet, 3 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Section 1 - spans 2 columns on large screens */}
              <div className="lg:col-span-2 space-y-3 md:space-y-4">
                <h3 className="text-sm md:text-base font-semibold">Basic Information</h3>
                
                {/* Nested grid for form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-xs md:text-sm font-medium">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter first name"
                      className="text-sm md:text-base"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="lastName" className="text-xs md:text-sm font-medium">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter last name"
                      className="text-sm md:text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label htmlFor="email" className="text-xs md:text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email"
                      className="text-sm md:text-base"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone" className="text-xs md:text-sm font-medium">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="Enter phone number"
                      className="text-sm md:text-base"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-xs md:text-sm font-medium">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Enter full address"
                    className="text-sm md:text-base resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Section 2 - spans 1 column */}
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-sm md:text-base font-semibold">Preferences</h3>
                
                <div>
                  <Label htmlFor="category" className="text-xs md:text-sm font-medium">Category</Label>
                  <Select>
                    <SelectTrigger className="text-sm md:text-base">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student" className="text-sm md:text-base">Student</SelectItem>
                      <SelectItem value="teacher" className="text-sm md:text-base">Teacher</SelectItem>
                      <SelectItem value="parent" className="text-sm md:text-base">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority" className="text-xs md:text-sm font-medium">Priority</Label>
                  <Select>
                    <SelectTrigger className="text-sm md:text-base">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="text-sm md:text-base">Low</SelectItem>
                      <SelectItem value="medium" className="text-sm md:text-base">Medium</SelectItem>
                      <SelectItem value="high" className="text-sm md:text-base">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes" className="text-xs md:text-sm font-medium">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    className="text-sm md:text-base resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Full width section */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-sm md:text-base font-semibold">Additional Details</h3>
              
              {/* This will be 1 column on mobile, 3 on tablet, 4 on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="field1" className="text-xs md:text-sm font-medium">Field 1</Label>
                  <Input id="field1" placeholder="Value 1" className="text-sm md:text-base" />
                </div>
                
                <div>
                  <Label htmlFor="field2" className="text-xs md:text-sm font-medium">Field 2</Label>
                  <Input id="field2" placeholder="Value 2" className="text-sm md:text-base" />
                </div>
                
                <div>
                  <Label htmlFor="field3" className="text-xs md:text-sm font-medium">Field 3</Label>
                  <Input id="field3" placeholder="Value 3" className="text-sm md:text-base" />
                </div>
                
                <div>
                  <Label htmlFor="field4" className="text-xs md:text-sm font-medium">Field 4</Label>
                  <Input id="field4" placeholder="Value 4" className="text-sm md:text-base" />
                </div>
              </div>
            </div>

            <ModernDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto text-sm md:text-base">
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto text-sm md:text-base">
                Save Changes
              </Button>
            </ModernDialogFooter>
          </form>
        </ModernDialogContent>
      </ModernDialog>
    </>
  )
} 