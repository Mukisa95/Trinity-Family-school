"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { commentaryService } from '@/services/commentaryService';
import { CommentTemplate } from '@/types';

export default function TestDbPage() {
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFetchTemplates = async () => {
    setLoading(true);
    setError(null);
    addTestResult('🔄 Starting fetch test...');
    
    try {
      const result = await commentaryService.getAllCommentTemplates();
      setTemplates(result);
      addTestResult(`✅ Fetch successful: Found ${result.length} templates`);
      console.log('Test fetch result:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addTestResult(`❌ Fetch failed: ${errorMessage}`);
      console.error('Test fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testAddTemplate = async () => {
    setLoading(true);
    addTestResult('🔄 Starting add test...');
    
    try {
      const testTemplate = {
        status: 'good' as const,
        type: 'class_teacher' as const,
        comment: 'Test comment created at ' + new Date().toISOString(),
        isActive: true
      };
      
      const id = await commentaryService.addCommentTemplate(testTemplate);
      addTestResult(`✅ Add successful: Created template with ID ${id}`);
      
      // Refresh templates
      await testFetchTemplates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addTestResult(`❌ Add failed: ${errorMessage}`);
      console.error('Test add error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setTemplates([]);
    setError(null);
  };

  useEffect(() => {
    addTestResult('🚀 Test page loaded');
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Firebase Database Connection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={testFetchTemplates} disabled={loading}>
                Test Fetch Templates
              </Button>
              <Button onClick={testAddTemplate} disabled={loading}>
                Test Add Template
              </Button>
              <Button onClick={clearResults} variant="outline">
                Clear Results
              </Button>
            </div>
            
            {loading && <div className="text-blue-600">Loading...</div>}
            {error && <div className="text-red-600">Error: {error}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500">No test results yet</p>
              ) : (
                <div className="space-y-1">
                  {testResults.map((result, index) => (
                    <div key={index} className="text-sm font-mono">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Templates ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-gray-500">No templates found</p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="bg-gray-50 p-3 rounded border">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{template.status} - {template.type}</p>
                        <p className="text-sm text-gray-600">{template.comment}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {template.isActive ? 'Active' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 