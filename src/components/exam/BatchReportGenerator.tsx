import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import PupilBatchReportFetcher from './PupilBatchReportFetcher';

// Define API constants directly since we're having import issues
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const BatchReportGenerator = () => {
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Fetch exams
  const { data: exams, isLoading: examsLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const response = await api.get('/exams');
      return response.data;
    }
  });

  // Fetch classes
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await api.get('/classes');
      return response.data;
    }
  });

  const handleGenerateReports = () => {
    if (!selectedExam || !selectedClass) {
      setError(new Error('Please select both an exam and a class.'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
  };

  const handleGenerateComplete = (blob: Blob) => {
    setIsGenerating(false);
    
    // Create a download URL for the generated PDF
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
  };

  const handleGenerateError = (error: Error) => {
    setIsGenerating(false);
    setError(error);
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate Batch Report Cards</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Exam
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            disabled={examsLoading || isGenerating}
          >
            <option value="">Select an exam</option>
            {exams?.map((exam: any) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.term.name}, {exam.academicYear.name})
              </option>
            ))}
          </select>
          {examsLoading && <p className="mt-1 text-sm text-gray-500">Loading exams...</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Class
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={classesLoading || isGenerating}
          >
            <option value="">Select a class</option>
            {classes?.map((classItem: any) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>
          {classesLoading && <p className="mt-1 text-sm text-gray-500">Loading classes...</p>}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <button
          className={`px-4 py-2 rounded-md text-white font-medium ${
            isGenerating || !selectedExam || !selectedClass
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={handleGenerateReports}
          disabled={isGenerating || !selectedExam || !selectedClass}
        >
          {isGenerating ? 'Generating...' : 'Generate Reports'}
        </button>
        
        {downloadUrl && (
          <a
            href={downloadUrl}
            download="batch-report-cards.pdf"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Download PDF
          </a>
        )}
      </div>
      
      {isGenerating && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <p className="text-blue-800">Generating report cards, please wait...</p>
        </div>
      )}
      
      {/* Hidden component that does the actual work */}
      {isGenerating && selectedExam && selectedClass && (
        <div className="hidden">
          <PupilBatchReportFetcher
            examId={selectedExam}
            classId={selectedClass}
            onGenerateComplete={handleGenerateComplete}
            onError={handleGenerateError}
          />
        </div>
      )}
    </div>
  );
};

export default BatchReportGenerator; 