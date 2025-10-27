import type { NavigationItem } from '@/types';
import { LayoutDashboard, Users, UserSquare, BookOpen, Presentation, Settings, GraduationCap, ArrowRightLeft, Info, CalendarDays, FileText, CheckSquare, DollarSign, Images, Shirt, Package, CreditCard, Receipt, MessageSquare, Bell, Mail, ShoppingCart, Calendar, History, TrendingUp, MessageCircle, Shield } from 'lucide-react';

export const navItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Pupils',
    icon: UserSquare,
    items: [
      {
        title: 'Pupils Management',
        href: '/pupils',
        icon: Users,
      },
      {
        title: 'Attendance',
        href: '/attendance',
        icon: CheckSquare,
      },
      {
        title: 'Promote/Demote',
        href: '/pupils/promote',
        icon: ArrowRightLeft,
      },
      {
        title: 'Enrollment Trends',
        href: '/enrollment-trends',
        icon: TrendingUp,
      },
      {
        title: 'Pupil History',
        href: '/pupil-history',
        icon: History,
      },
    ],
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: GraduationCap,
  },
  {
    title: 'Classes',
    href: '/classes',
    icon: Presentation,
  },
  {
    title: 'Exams',
    href: '/exams',
    icon: FileText,
  },
  {
    title: 'Events & Calendar',
    href: '/events',
    icon: Calendar,
  },
  {
    title: 'Communications',
    icon: Mail,
    items: [
      {
        title: 'Bulk SMS',
        href: '/bulk-sms',
        icon: MessageSquare,
      },
      {
        title: 'Notifications',
        href: '/notifications',
        icon: Bell,
      },
      {
        title: 'WhatsApp Group',
        href: 'https://chat.whatsapp.com/LfKtwT6Qn5eDImR4gagwU3?mode=ac_t',
        icon: MessageCircle,
        external: true,
      },
    ],
  },
  {
    title: 'Fees Collection',
    icon: Receipt,
    items: [
      {
        title: 'Collect Fees',
        href: '/fees/collection',
        icon: Receipt,
      },
      {
        title: 'Collection Analytics',
        href: '/fees/analytics',
        icon: TrendingUp,
      },
    ],
  },
  {
    title: 'Banking',
    href: '/banking/list',
    icon: CreditCard,
  },
  {
    title: 'Procurement',
    href: '/procurement',
    icon: ShoppingCart,
  },
  {
    title: 'Duty & Service',
    href: '/duty-service',
    icon: Shield,
  },
  {
    title: 'Settings',
    icon: Settings,
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: Users,
      },
      {
        title: 'Access Levels',
        href: '/access-levels',
        icon: Shield,
      },
      {
        title: 'Fees Management',
        href: '/fees',
        icon: DollarSign,
      },
      {
        title: 'Requirements',
        href: '/requirements',
        icon: Package,
      },
      {
        title: 'Uniform Management',
        href: '/uniforms',
        icon: Shirt,
      },
      {
        title: 'Academic Years',
        href: '/academic-years',
        icon: CalendarDays,
      },
      {
        title: 'Subjects',
        href: '/subjects',
        icon: BookOpen,
      },
      {
        title: 'Commentary Box',
        href: '/admin/commentary-box',
        icon: MessageSquare,
      },
      {
        title: 'Photos Manager',
        href: '/admin/photos',
        icon: Images,
      },
      {
        title: 'About School',
        href: '/about-school',
        icon: Info,
      },
    ],
  },
];
