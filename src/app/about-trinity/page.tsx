import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, BookOpen, GraduationCap, Heart, MapPin, Target, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const description = 'Learn about Trinity Family Nursery & Primary School in Kawaala, Kampala, Uganda: our learning approach, nursery and primary education, school values, and official online portal.';

export const metadata: Metadata = {
  title: 'About Trinity Family Nursery & Primary School in Kawaala',
  description,
  keywords: [
    'trinity family school',
    'trinity family school kawaala',
    'trinity family primary school',
    'trinity family nursery and primary school',
    'trinity school kawaala',
    'nursery and primary school in kawaala',
  ],
  alternates: {
    canonical: '/about-trinity',
  },
  openGraph: {
    type: 'website',
    locale: 'en_UG',
    url: '/about-trinity',
    title: 'About Trinity Family Nursery & Primary School in Kawaala',
    description,
    siteName: 'Trinity Family School',
  },
};

export default function AboutTrinityPage() {
  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Trinity Family Nursery & Primary School"
        description="Serving children and families in Kawaala, Kampala, Uganda."
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              About our school
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              Trinity Family Nursery &amp; Primary School is a nursery and primary school in
              Kawaala, Kampala. Families may also know us as Trinity Family School,
              Trinity Family Primary School, or Trinity School Kawaala.
            </p>
            <p>
              This is the school&apos;s official digital platform for school information,
              communication, and secure portal access for authorised members of our community.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Find Trinity Family School
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>
              We are located in Kawaala, Kampala, Uganda, and serve learners at nursery and
              primary level.
            </p>
            <Button asChild>
              <Link href="/login">Visit the school website and portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Child-centred learning
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We nurture every child&apos;s potential in a safe, caring, and supportive school community.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Nursery and primary education
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Our learning programme builds strong foundations and prepares pupils for continued academic growth.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Academic and personal growth
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We support learning, character, confidence, creativity, and responsible participation in the community.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Our approach
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Trinity Family School combines classroom learning with practical skills,
            co-curricular activities, ICT, and opportunities that help pupils grow into
            confident lifelong learners.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Our school community
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Teachers, families, and school leaders work together to support each learner
            throughout their nursery and primary school journey.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
