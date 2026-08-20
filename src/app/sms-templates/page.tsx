"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useToast } from '@/hooks/use-toast';
import { useFormValidation } from '@/lib/utils/form-validation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
    MessageSquare,
    Plus,
    Pencil,
    Trash2,
    ArrowLeft,
    Loader2,
    FileText,
} from 'lucide-react';
import {
    useSMSTemplates,
    useCreateSMSTemplate,
    useUpdateSMSTemplate,
    useDeleteSMSTemplate,
} from '@/lib/hooks/use-sms-templates';
import { SMSTemplate } from '@/lib/services/sms.service';

const CHAR_LIMIT = 160;

const SMSTemplatesPage: React.FC = () => {
    const router = useRouter();
    const { toast } = useToast();
    const { data: templates = [], isLoading } = useSMSTemplates();
    const { mutateAsync: createTemplate, isPending: creating } = useCreateSMSTemplate();
    const { mutateAsync: updateTemplate, isPending: updating } = useUpdateSMSTemplate();
    const { mutateAsync: deleteTemplate, isPending: deleting } = useDeleteSMSTemplate();

    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const charCount = formContent.length;
    const messageCount = Math.ceil(charCount / CHAR_LIMIT) || 1;
    const formValidation = useFormValidation([
        { id: 'tpl-name', label: 'Template name', value: formName, required: true, message: 'Enter a name for this SMS template.' },
        { id: 'tpl-content', label: 'Message content', value: formContent, required: true, message: 'Enter the SMS message content.' },
    ]);

    const openCreate = () => {
        setEditingTemplate(null);
        setFormName('');
        setFormContent('');
        formValidation.resetValidation();
        setShowForm(true);
    };

    const openEdit = (template: SMSTemplate) => {
        setEditingTemplate(template);
        setFormName(template.name);
        setFormContent(template.content);
        formValidation.resetValidation();
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formValidation.validateAll().isValid) return;
        try {
            if (editingTemplate) {
                await updateTemplate({ id: editingTemplate.id, updates: { name: formName.trim(), content: formContent.trim() } });
                toast({ title: '✅ Template Updated', description: `"${formName}" has been updated.` });
            } else {
                await createTemplate({ name: formName.trim(), content: formContent.trim() } as Omit<SMSTemplate, 'id' | 'createdAt'>);
                toast({ title: '✅ Template Created', description: `"${formName}" has been saved.` });
            }
            setShowForm(false);
        } catch (error) {
            formValidation.setSubmissionError('The template could not be saved. Your message has been kept so you can try again.');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteTemplate(deleteId);
            toast({ title: '🗑️ Template Deleted', description: 'The template has been removed.' });
        } catch {
            toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
            <GlassPageTopBar
                title="SMS Templates"
                subtitle="Create and manage reusable message templates for parent communications"
                backHref="/bulk-sms"
                backLabel="Bulk SMS"
                actions={
                    <GlassActionDock>
                        <GlassActionButton
                            label="New Template"
                            icon={<Plus className="h-4 w-4" />}
                            tone="blue"
                            onClick={openCreate}
                        />
                    </GlassActionDock>
                }
            />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Template List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading templates…
                </div>
            ) : templates.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                        <h3 className="font-semibold text-lg">No templates yet</h3>
                        <p className="text-sm text-muted-foreground">
                            Create reusable message templates to speed up sending SMS.
                        </p>
                        <Button onClick={openCreate} className="gap-2 mt-2">
                            <Plus className="h-4 w-4" />
                            Create First Template
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {templates.map((template) => {
                        const chars = template.content.length;
                        const msgs = Math.ceil(chars / CHAR_LIMIT) || 1;
                        return (
                            <Card key={template.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base leading-tight">{template.name}</CardTitle>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(template)} title="Edit">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => setDeleteId(template.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription className="flex gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">{chars} chars</Badge>
                                        {msgs > 1 && (
                                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                                                {msgs} SMS
                                            </Badge>
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{template.content}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <FormErrorSummary errors={formValidation.errors} submissionError={formValidation.submissionError} onSelectError={formValidation.focusField} />
                        <div className="space-y-2">
                            <Label htmlFor="tpl-name" className={formValidation.getFieldError('tpl-name') ? 'text-red-700' : undefined}>Template Name <span className="text-red-600">*</span></Label>
                            <Input
                                id="tpl-name"
                                placeholder="e.g. Fee Reminder, Meeting Notice…"
                                value={formName}
                                onChange={e => { setFormName(e.target.value); formValidation.handleFieldChange('tpl-name'); }}
                                {...formValidation.getFieldProps('tpl-name')}
                            />
                            <FieldError error={formValidation.getFieldError('tpl-name')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tpl-content" className={formValidation.getFieldError('tpl-content') ? 'text-red-700' : undefined}>Message Content <span className="text-red-600">*</span></Label>
                            <Textarea
                                id="tpl-content"
                                placeholder="Type your SMS message here…"
                                rows={6}
                                value={formContent}
                                onChange={e => { setFormContent(e.target.value); formValidation.handleFieldChange('tpl-content'); }}
                                className="resize-none"
                                {...formValidation.getFieldProps('tpl-content')}
                            />
                            <FieldError error={formValidation.getFieldError('tpl-content')} />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span className={charCount > CHAR_LIMIT ? 'text-amber-600 font-medium' : ''}>
                                    {charCount} characters
                                    {charCount > CHAR_LIMIT && ` · ${messageCount} SMS messages`}
                                </span>
                                <span>{CHAR_LIMIT - (charCount % CHAR_LIMIT || 160)} left in current SMS</span>
                            </div>
                            {/* character progress bar */}
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${charCount <= CHAR_LIMIT ? 'bg-green-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(100, (charCount / CHAR_LIMIT) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={creating || updating}>
                            {(creating || updating) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {editingTemplate ? 'Save Changes' : 'Create Template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The template will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        </div>
    );
};

export default SMSTemplatesPage;
