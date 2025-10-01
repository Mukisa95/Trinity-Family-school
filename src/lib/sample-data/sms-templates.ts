import { SMSTemplate } from '../services/sms.service';

export const sampleSMSTemplates: Omit<SMSTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Welcome Message',
    content: 'Welcome to Trinity Family School! We are excited to have your child join our school community. For any questions, please contact us at +256-XXX-XXXXXX.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Fee Reminder',
    content: 'Dear Parent/Guardian, this is a friendly reminder that school fees for this term are due. Please visit the school office or use our online payment system. Thank you.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Parent Meeting',
    content: 'You are invited to attend a parent-teacher meeting on [DATE] at [TIME]. Your presence is important for your child\'s academic progress. Venue: School Hall.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Exam Schedule',
    content: 'Dear Parent, the end of term examinations will begin on [DATE]. Please ensure your child is well prepared and arrives at school on time. Good luck!',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Holiday Notice',
    content: 'School will be closed for holidays from [START_DATE] to [END_DATE]. Classes will resume on [RESUME_DATE]. Have a wonderful holiday!',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Emergency Closure',
    content: 'Due to unforeseen circumstances, school will be closed today [DATE]. All students should return home safely. Normal classes will resume tomorrow.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Academic Performance',
    content: 'Congratulations! Your child has shown excellent academic performance this term. Keep up the good work. For detailed results, please visit the school.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Medical Reminder',
    content: 'Please ensure your child has completed all required medical checkups and vaccinations. Submit medical forms to the school nurse by [DATE].',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Sports Day',
    content: 'Our annual Sports Day will be held on [DATE] at [TIME]. All parents are invited to attend and cheer for their children. Venue: School Sports Ground.',
    createdBy: 'system',
    isActive: true,
  },
  {
    name: 'Uniform Reminder',
    content: 'Please ensure your child is wearing the complete school uniform daily. Students not in proper uniform may not be allowed to attend classes.',
    createdBy: 'system',
    isActive: true,
  },
]; 