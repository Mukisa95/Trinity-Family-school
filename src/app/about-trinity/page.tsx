import { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Users, BookOpen, Award, Target, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Trinity School Online - Our Mission & Vision',
  description: 'Learn about Trinity School Online - our comprehensive school management system, mission, vision, and commitment to educational excellence. Discover how Trinity School leverages technology for better education.',
  keywords: [
    'trinity school online',
    'trinity school',
    'about trinity school',
    'trinity school mission',
    'trinity school vision',
    'trinity education',
    'school management system',
    'educational technology'
  ],
  openGraph: {
    title: 'About Trinity School Online - Our Mission & Vision',
    description: 'Learn about Trinity School Online - our comprehensive school management system, mission, vision, and commitment to educational excellence.',
  },
};

export default function AboutTrinityPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <PageHeader
        title="About Trinity School Online"
        description="Empowering education through innovative technology and comprehensive school management solutions."
      />
      
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              Trinity School Online is dedicated to revolutionizing educational administration through 
              cutting-edge technology. We provide comprehensive school management solutions that streamline 
              operations, enhance communication, and improve academic outcomes for students, teachers, and administrators.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Our Vision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              To be the leading digital platform that transforms how educational institutions operate, 
              making quality education more accessible, efficient, and effective for communities worldwide. 
              Trinity School Online envisions a future where technology seamlessly supports educational excellence.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive student information system with enrollment tracking, 
              academic records, attendance monitoring, and performance analytics.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Academic Excellence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Advanced curriculum management, examination systems, grade tracking, 
              and detailed academic reporting for continuous improvement.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Administrative Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Streamlined fee management, staff administration, resource allocation, 
              and automated reporting for enhanced operational efficiency.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Why Choose Trinity School Online?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">🚀 Modern Technology</h4>
              <p className="text-sm text-muted-foreground">
                Built with cutting-edge web technologies for fast, reliable, and secure operations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📱 Mobile-First Design</h4>
              <p className="text-sm text-muted-foreground">
                Responsive design that works seamlessly across all devices and platforms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🔒 Data Security</h4>
              <p className="text-sm text-muted-foreground">
                Enterprise-grade security measures to protect sensitive student and institutional data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Real-time Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Comprehensive dashboards and reports for data-driven decision making.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trinity School Online Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Student Information System</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Attendance Management</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Fee Collection & Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Examination Management</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Staff Administration</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Academic Performance Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Class & Subject Management</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Parent Communication Portal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Real-time Reporting & Analytics</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 