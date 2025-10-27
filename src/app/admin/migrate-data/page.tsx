"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, Database, AlertCircle } from 'lucide-react';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function MigrateDataPage() {
  const [exportedData, setExportedData] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const exportAcademicYears = async () => {
    try {
      setIsProcessing(true);
      setStatus('📥 Fetching academic years from current database...');

      const snapshot = await getDocs(collection(db, 'academicYears'));
      
      if (snapshot.empty) {
        setStatus('❌ No academic years found in this database!');
        setIsProcessing(false);
        return;
      }

      const academicYears: any[] = [];
      snapshot.forEach(doc => {
        academicYears.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setExportedData(academicYears);
      setStatus(`✅ Exported ${academicYears.length} academic years successfully!`);

      // Auto-download as JSON
      const dataStr = JSON.stringify(academicYears, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `academic-years-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setIsProcessing(false);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      setIsProcessing(false);
      console.error('Export error:', error);
    }
  };

  const importFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setExportedData(data);
        setStatus(`✅ Loaded ${data.length} academic years from file. Ready to import!`);
      } catch (error: any) {
        setStatus(`❌ Error reading file: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  const importToCurrentDatabase = async () => {
    if (!exportedData || exportedData.length === 0) {
      setStatus('❌ No data to import! Please export or load a file first.');
      return;
    }

    if (!confirm(`⚠️ This will import ${exportedData.length} academic years to the CURRENT database. Continue?`)) {
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('📤 Importing academic years to current database...');

      const batch = writeBatch(db);
      let count = 0;

      for (const year of exportedData) {
        const { id, ...data } = year;
        const docRef = doc(db, 'academicYears', id);
        batch.set(docRef, data);
        count++;
      }

      await batch.commit();
      
      setStatus(`✅ Successfully imported ${count} academic years!`);
      setIsProcessing(false);
    } catch (error: any) {
      setStatus(`❌ Import error: ${error.message}`);
      setIsProcessing(false);
      console.error('Import error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600" />
          Data Migration Tool
        </h1>
        <p className="text-gray-600 mb-8">
          Export and import academic years between dev and production databases
        </p>

        {/* Instructions */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              How to Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-blue-800">
              <p><strong>Dev → Production Migration:</strong></p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>On <strong>DEV</strong> environment (localhost:9004 with trinity-family-schools): Click <strong>"Export Academic Years"</strong></li>
                <li>File will download automatically</li>
                <li>Switch to <strong>PRODUCTION</strong> environment (change .env.local to trinity-family-ganda)</li>
                <li>Click <strong>"Import from File"</strong> and select the downloaded file</li>
                <li>Click <strong>"Import to Current Database"</strong></li>
                <li>Done! Academic years are now in production.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Export from Current Database</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={exportAcademicYears}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Academic Years
            </Button>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 2: Import to Current Database</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select JSON file to import:
              </label>
              <input
                type="file"
                accept=".json"
                onChange={importFromFile}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {exportedData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✅ Loaded {exportedData.length} academic years
                </p>
              </div>
            )}

            <Button
              onClick={importToCurrentDatabase}
              disabled={!exportedData || isProcessing}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import to Current Database
            </Button>
          </CardContent>
        </Card>

        {/* Status */}
        {status && (
          <Card>
            <CardContent className="pt-6">
              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                {status}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Preview Data */}
        {exportedData && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Preview Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exportedData.map((year: any, i: number) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-semibold text-gray-900">
                      {i + 1}. Year: {year.year}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      ID: {year.id} • Active: {year.isActive ? '✅' : '❌'} • 
                      Current Term: {year.currentTermId || 'Not set'} • 
                      Terms: {year.terms?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

