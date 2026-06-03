"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { SmartBackButton } from '@/components/common/SmartBackButton';
import { SUBJECT_COMMENT_TYPES, SUBJECT_STATUS_OPTIONS } from '@/lib/constants/subject-comments';
import { useClasses } from '@/lib/hooks/use-classes';
import { commentaryService } from '@/services/commentaryService';
import { SubjectCommentType, SubjectStatus } from '@/types';

interface CommentField {
  id: string;
  text: string;
}

type SubjectCommentsMap = Record<SubjectCommentType, CommentField[]>;

const TERM_OPTIONS = [
  { value: 'all', label: 'All Terms' },
  { value: 'term_1', label: 'Term 1' },
  { value: 'term_2', label: 'Term 2' },
  { value: 'term_3', label: 'Term 3' },
];

function makeId() {
  return Math.random().toString(36).slice(2);
}

function buildInitialSubjectMap(): SubjectCommentsMap {
  const map = {} as SubjectCommentsMap;
  for (const s of SUBJECT_COMMENT_TYPES) {
    map[s.value] = [{ id: makeId(), text: '' }];
  }
  return map;
}

export default function SeedSubjectsPage() {
  const { data: allClasses = [] } = useClasses();
  const nurseryClasses = allClasses.filter((c) => c.level === 'Nursery');

  // ── Global settings ────────────────────────────────────────────────
  const [subjectStatus, setSubjectStatus] = useState<SubjectStatus>('good');
  // Multi-class: empty = All Nursery Classes (general)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [applicableTerms, setApplicableTerms] = useState<string[]>(['all']);

  // ── Per-subject comment fields ──────────────────────────────────────
  const [commentMap, setCommentMap] = useState<SubjectCommentsMap>(buildInitialSubjectMap);
  const [saving, setSaving] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────
  function toggleClass(id: string, checked: boolean) {
    setSelectedClassIds((prev) => checked ? [...prev, id] : prev.filter((c) => c !== id));
  }

  function toggleTerm(term: string, checked: boolean) {
    if (term === 'all') {
      setApplicableTerms(checked ? ['all'] : []);
      return;
    }
    setApplicableTerms((prev) => {
      const without = prev.filter((t) => t !== 'all' && t !== term);
      return checked ? [...without, term] : without;
    });
  }

  function addCommentField(subject: SubjectCommentType) {
    setCommentMap((prev) => ({
      ...prev,
      [subject]: [...prev[subject], { id: makeId(), text: '' }],
    }));
  }

  function removeCommentField(subject: SubjectCommentType, fieldId: string) {
    setCommentMap((prev) => {
      const filtered = prev[subject].filter((f) => f.id !== fieldId);
      return {
        ...prev,
        [subject]: filtered.length > 0 ? filtered : [{ id: makeId(), text: '' }],
      };
    });
  }

  function updateCommentText(subject: SubjectCommentType, fieldId: string, text: string) {
    setCommentMap((prev) => ({
      ...prev,
      [subject]: prev[subject].map((f) => (f.id === fieldId ? { ...f, text } : f)),
    }));
  }

  // ── Save all ───────────────────────────────────────────────────────
  async function handleSave() {
    const toSave: Array<{ subject: SubjectCommentType; comment: string }> = [];

    for (const subjectType of SUBJECT_COMMENT_TYPES) {
      for (const field of commentMap[subjectType.value]) {
        if (field.text.trim()) {
          toSave.push({ subject: subjectType.value, comment: field.text.trim() });
        }
      }
    }

    if (toSave.length === 0) {
      toast({ title: 'No comments to save', description: 'Please enter at least one comment before saving.', variant: 'destructive' });
      return;
    }

    // Determine class targets: if nothing selected → save as general (undefined classId)
    const classTargets: Array<string | undefined> =
      selectedClassIds.length === 0 ? [undefined] : selectedClassIds;

    setSaving(true);
    let saved = 0;
    let failed = 0;

    try {
      await Promise.all(
        toSave.flatMap(({ subject, comment }) =>
          classTargets.map(async (cid) => {
            try {
              await commentaryService.addCommentTemplate({
                type: 'subject',
                subject,
                subjectStatus,
                comment,
                isActive: true,
                classId: cid,
                applicableTerms,
              });
              saved++;
            } catch {
              failed++;
            }
          })
        )
      );

      toast({
        title: 'Saved successfully',
        description: `${saved} comment${saved !== 1 ? 's' : ''} saved${classTargets.length > 1 ? ` across ${classTargets.length} classes` : ''}.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });

      if (failed === 0) {
        setCommentMap(buildInitialSubjectMap());
      }
    } finally {
      setSaving(false);
    }
  }

  const statusOption = SUBJECT_STATUS_OPTIONS.find((s) => s.value === subjectStatus);

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <SmartBackButton fallbackHref="/commentary-management" className="h-5 w-5">
          <ArrowLeft className="h-5 w-5" />
        </SmartBackButton>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Seed Subject Comments</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Add comments for all subjects at once. Choose a status, which classes and which terms they apply to.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </div>

      {/* ── Global settings ── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Subject Status</label>
            <Select value={subjectStatus} onValueChange={(v) => setSubjectStatus(v as SubjectStatus)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-class selector */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Classes <span className="text-gray-400 font-normal">(leave all unchecked for All Nursery Classes)</span>
            </label>
            <div className="border rounded-lg p-3 flex flex-wrap gap-4 max-h-40 overflow-y-auto">
              {nurseryClasses.length === 0 ? (
                <p className="text-sm text-gray-400">No nursery classes found</p>
              ) : (
                nurseryClasses.map((cls) => (
                  <label key={cls.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={selectedClassIds.includes(cls.id)}
                      onCheckedChange={(checked) => toggleClass(cls.id, !!checked)}
                    />
                    <span className="text-sm">{cls.name}</span>
                  </label>
                ))
              )}
            </div>
            {selectedClassIds.length === 0 ? (
              <p className="text-xs text-gray-500 mt-1">→ Saving as General (All Nursery Classes)</p>
            ) : (
              <p className="text-xs text-purple-600 mt-1">
                → Saving for {selectedClassIds.length} class{selectedClassIds.length !== 1 ? 'es' : ''}: {selectedClassIds.map(id => nurseryClasses.find(c => c.id === id)?.name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Applicable Terms */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Applicable Terms <span className="text-gray-400 font-normal text-xs">(select which terms this applies to)</span>
            </label>
            <div className="flex flex-wrap gap-4">
              {TERM_OPTIONS.map((t) => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={applicableTerms.includes(t.value)}
                    disabled={t.value !== 'all' && applicableTerms.includes('all')}
                    onCheckedChange={(checked) => toggleTerm(t.value, !!checked)}
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Per-subject comment cards ── */}
      <div className="grid gap-4">
        {SUBJECT_COMMENT_TYPES.map((subject) => {
          const fields = commentMap[subject.value];
          return (
            <Card key={subject.value}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{subject.label}</CardTitle>
                  {statusOption && (
                    <Badge className={statusOption.color}>{statusOption.label}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Textarea
                        value={field.text}
                        onChange={(e) => updateCommentText(subject.value, field.id, e.target.value)}
                        placeholder={`Comment ${idx + 1} — use [He/She], [his/her], [him/her] for gender-aware text`}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                    {fields.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCommentField(subject.value, field.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 mt-0.5 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCommentField(subject.value)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add comment
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky bottom save bar */}
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save All Comments'}
        </Button>
      </div>
    </div>
  );
}
