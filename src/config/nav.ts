import type { NavigationItem } from '@/types';
import { LayoutDashboard, Users, UserSquare, BookOpen, Presentation, Settings, GraduationCap, ArrowRightLeft, Info, CalendarDays, FileText, CheckSquare, DollarSign, Shirt, Package, CreditCard, Receipt, MessageSquare, Mail, ShoppingCart, Calendar, History, TrendingUp, MessageCircle, Shield, Tag, Bed, Warehouse, TableProperties, Zap, Bell, Gauge, Sprout, ServerCog, Files, WalletCards } from 'lucide-react';

export const navItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    section: 'Overview',
  },
  {
    title: 'Timetable',
    href: '/timetable',
    icon: TableProperties,
    section: 'Overview',
  },
  {
    title: 'Events & Calendar',
    href: '/events',
    icon: Calendar,
    section: 'Overview',
  },
  {
    title: 'Pupils',
    icon: UserSquare,
    section: 'Academics',
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
        title: 'Birthdays',
        href: '/birthdays',
        icon: CalendarDays,
      },
      {
        title: 'In-House',
        href: '/boarding/dormitory',
        icon: Bed,
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
    section: 'Academics',
  },
  {
    title: 'Classes',
    href: '/classes',
    icon: Presentation,
    section: 'Academics',
  },
  {
    title: 'Exams',
    href: '/exams',
    icon: FileText,
    section: 'Academics',
  },
  {
    title: 'Duty & Service',
    href: '/duty-service',
    icon: Shield,
    section: 'Academics',
  },
  {
    title: 'Accounts',
    icon: Receipt,
    section: 'Finance',
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
      {
        title: 'SchoolPay Feed',
        href: '/accounts/schoolpay-feed',
        icon: Zap,
      },
      {
        title: 'Banking',
        href: '/banking/list',
        icon: CreditCard,
      },
      {
        title: 'Staff Payroll',
        href: '/payroll',
        icon: WalletCards,
      },
      {
        title: 'Procurement',
        href: '/procurement',
        icon: ShoppingCart,
      },
      {
        title: 'Assign',
        href: '/assign',
        icon: Tag,
      },
      {
        title: 'Inventory',
        href: '/inventory',
        icon: Warehouse,
      },
    ],
  },
  {
    title: 'Communications',
    icon: Mail,
    section: 'Communications',
    items: [
      {
        title: 'Bulk SMS',
        href: '/bulk-sms',
        icon: MessageSquare,
      },
      {
        title: 'Push Notifications',
        href: '/push-notifications',
        icon: Bell,
      },
      {
        title: 'DocX',
        href: '/docx',
        icon: Files,
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
    title: 'Settings',
    icon: Settings,
    section: 'Administration',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: Users,
      },
      {
        title: 'Accounts',
        href: '/fees',
        icon: DollarSign,
      },
      {
        title: 'Academic Setup',
        href: '/academic-years',
        icon: CalendarDays,
      },
      {
        title: 'Seeding',
        href: '/pupils/historical-seeding',
        icon: Sprout,
      },
      {
        title: 'About School',
        href: '/about-school',
        icon: Info,
      },
      {
        title: 'History Log',
        href: '/history-log',
        icon: History,
      },
      {
        title: 'Firebase Usage',
        href: '/settings/firebase-usage',
        icon: Gauge,
      },
      {
        title: 'Deployment Control',
        href: '/settings/deployment',
        icon: ServerCog,
      },
    ],
  },
];
