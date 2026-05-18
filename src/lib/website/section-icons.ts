// =============================================================================
// Section icon library — a curated, professional icon set for section content
// (feature grids, trust signals, …). Backed by lucide-react (MIT-licensed,
// tree-shakeable line icons). Sections store an icon *id*; the renderer and
// the IconField picker resolve it through here.
//
// Curated, not the full 1700-icon lucide set — these are the icons that earn
// their place on a service-business website. Add an entry to grow the set.
// =============================================================================

import {
  Award,
  BadgeCheck,
  Bath,
  Briefcase,
  Brush,
  Building2,
  Calendar,
  Camera,
  Car,
  CircleCheck,
  Clock,
  Compass,
  CreditCard,
  DollarSign,
  Drill,
  Droplet,
  Droplets,
  Fan,
  Flag,
  Flame,
  Gauge,
  Gift,
  Globe,
  Hammer,
  Handshake,
  HardHat,
  Headphones,
  Heart,
  Hourglass,
  House,
  Key,
  Layers,
  Leaf,
  LifeBuoy,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  PaintRoller,
  Paintbrush,
  Phone,
  Plug,
  Recycle,
  Rocket,
  Ruler,
  Scissors,
  Settings,
  Shield,
  ShieldCheck,
  ShowerHead,
  Snowflake,
  Sparkles,
  SprayCan,
  Sprout,
  Star,
  Sun,
  Tag,
  Target,
  Thermometer,
  ThumbsUp,
  Trash2,
  TreePine,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  WashingMachine,
  Wifi,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';

/** A lucide icon component (all share one signature). */
export type SectionIconComponent = typeof Wrench;

export type SectionIconDef = {
  /** Stable id stored in section data. */
  id: string;
  /** Human label, shown in the picker tooltip. */
  label: string;
  /** Coarse grouping shown as a picker section header. */
  group: string;
  /** Extra search synonyms (space-separated). */
  keywords: string;
  Icon: SectionIconComponent;
};

export const SECTION_ICONS: readonly SectionIconDef[] = [
  // -- Trust & reputation --
  { id: 'users', label: 'People', group: 'Trust', keywords: 'customers community team clients', Icon: Users },
  { id: 'star', label: 'Star', group: 'Trust', keywords: 'rating review favourite', Icon: Star },
  { id: 'shield-check', label: 'Shield check', group: 'Trust', keywords: 'licensed insured verified secure', Icon: ShieldCheck },
  { id: 'shield', label: 'Shield', group: 'Trust', keywords: 'protected safe security', Icon: Shield },
  { id: 'badge-check', label: 'Verified badge', group: 'Trust', keywords: 'certified approved verified', Icon: BadgeCheck },
  { id: 'award', label: 'Award', group: 'Trust', keywords: 'medal recognition quality', Icon: Award },
  { id: 'trophy', label: 'Trophy', group: 'Trust', keywords: 'winner best results', Icon: Trophy },
  { id: 'thumbs-up', label: 'Thumbs up', group: 'Trust', keywords: 'approve satisfaction recommend', Icon: ThumbsUp },
  { id: 'heart', label: 'Heart', group: 'Trust', keywords: 'love care loyalty', Icon: Heart },
  { id: 'handshake', label: 'Handshake', group: 'Trust', keywords: 'partnership deal agreement trust', Icon: Handshake },
  { id: 'check', label: 'Check', group: 'Trust', keywords: 'done complete guaranteed tick', Icon: CircleCheck },
  { id: 'gauge', label: 'Gauge', group: 'Trust', keywords: 'performance speed measure', Icon: Gauge },
  { id: 'trending-up', label: 'Trending up', group: 'Trust', keywords: 'growth results increase', Icon: TrendingUp },

  // -- Trades & repair --
  { id: 'wrench', label: 'Wrench', group: 'Trades', keywords: 'repair plumbing fix tool', Icon: Wrench },
  { id: 'hammer', label: 'Hammer', group: 'Trades', keywords: 'build carpentry tool repair', Icon: Hammer },
  { id: 'drill', label: 'Drill', group: 'Trades', keywords: 'tool power install', Icon: Drill },
  { id: 'ruler', label: 'Ruler', group: 'Trades', keywords: 'measure precision design', Icon: Ruler },
  { id: 'hard-hat', label: 'Hard hat', group: 'Trades', keywords: 'construction safety builder', Icon: HardHat },
  { id: 'plug', label: 'Plug', group: 'Trades', keywords: 'electrical power socket', Icon: Plug },
  { id: 'zap', label: 'Lightning bolt', group: 'Trades', keywords: 'electrical power energy fast', Icon: Zap },
  { id: 'lightbulb', label: 'Lightbulb', group: 'Trades', keywords: 'electrical light idea', Icon: Lightbulb },
  { id: 'paint-roller', label: 'Paint roller', group: 'Trades', keywords: 'painting decorating', Icon: PaintRoller },
  { id: 'paintbrush', label: 'Paintbrush', group: 'Trades', keywords: 'painting decorating creative', Icon: Paintbrush },
  { id: 'settings', label: 'Cog', group: 'Trades', keywords: 'settings service mechanical maintenance', Icon: Settings },

  // -- Heating, cooling & plumbing --
  { id: 'snowflake', label: 'Snowflake', group: 'Climate', keywords: 'cooling hvac air conditioning cold', Icon: Snowflake },
  { id: 'flame', label: 'Flame', group: 'Climate', keywords: 'heating fire gas hot', Icon: Flame },
  { id: 'fan', label: 'Fan', group: 'Climate', keywords: 'cooling ventilation air hvac', Icon: Fan },
  { id: 'thermometer', label: 'Thermometer', group: 'Climate', keywords: 'temperature heating cooling', Icon: Thermometer },
  { id: 'wind', label: 'Wind', group: 'Climate', keywords: 'air ventilation breeze', Icon: Wind },
  { id: 'droplet', label: 'Droplet', group: 'Climate', keywords: 'water plumbing leak', Icon: Droplet },
  { id: 'droplets', label: 'Droplets', group: 'Climate', keywords: 'water plumbing wet', Icon: Droplets },
  { id: 'bath', label: 'Bath', group: 'Climate', keywords: 'bathroom plumbing renovation', Icon: Bath },
  { id: 'shower-head', label: 'Shower head', group: 'Climate', keywords: 'bathroom plumbing water', Icon: ShowerHead },

  // -- Cleaning --
  { id: 'spray-can', label: 'Spray can', group: 'Cleaning', keywords: 'cleaning spray housework', Icon: SprayCan },
  { id: 'sparkles', label: 'Sparkles', group: 'Cleaning', keywords: 'clean shine spotless quality', Icon: Sparkles },
  { id: 'brush', label: 'Brush', group: 'Cleaning', keywords: 'cleaning scrub housework', Icon: Brush },
  { id: 'trash', label: 'Bin', group: 'Cleaning', keywords: 'rubbish waste removal cleaning', Icon: Trash2 },
  { id: 'recycle', label: 'Recycle', group: 'Cleaning', keywords: 'green eco waste sustainable', Icon: Recycle },
  { id: 'washing-machine', label: 'Washing machine', group: 'Cleaning', keywords: 'laundry appliance cleaning', Icon: WashingMachine },

  // -- Property & outdoors --
  { id: 'house', label: 'House', group: 'Property', keywords: 'home residential real estate', Icon: House },
  { id: 'building', label: 'Building', group: 'Property', keywords: 'commercial office business', Icon: Building2 },
  { id: 'key', label: 'Key', group: 'Property', keywords: 'locksmith access real estate', Icon: Key },
  { id: 'lock', label: 'Lock', group: 'Property', keywords: 'security locksmith safe', Icon: Lock },
  { id: 'tree', label: 'Tree', group: 'Property', keywords: 'landscaping garden outdoor', Icon: TreePine },
  { id: 'leaf', label: 'Leaf', group: 'Property', keywords: 'garden eco green landscaping', Icon: Leaf },
  { id: 'sprout', label: 'Sprout', group: 'Property', keywords: 'garden growth landscaping plant', Icon: Sprout },
  { id: 'sun', label: 'Sun', group: 'Property', keywords: 'solar outdoor weather warm', Icon: Sun },
  { id: 'car', label: 'Car', group: 'Property', keywords: 'vehicle auto driveway transport', Icon: Car },
  { id: 'truck', label: 'Truck', group: 'Property', keywords: 'delivery removal transport fleet', Icon: Truck },

  // -- Contact & service --
  { id: 'phone', label: 'Phone', group: 'Contact', keywords: 'call contact support', Icon: Phone },
  { id: 'mail', label: 'Mail', group: 'Contact', keywords: 'email contact message', Icon: Mail },
  { id: 'calendar', label: 'Calendar', group: 'Contact', keywords: 'booking schedule appointment', Icon: Calendar },
  { id: 'clock', label: 'Clock', group: 'Contact', keywords: 'time fast hours availability', Icon: Clock },
  { id: 'map-pin', label: 'Map pin', group: 'Contact', keywords: 'location area local serving', Icon: MapPin },
  { id: 'message', label: 'Message', group: 'Contact', keywords: 'chat enquiry contact support', Icon: MessageSquare },
  { id: 'headphones', label: 'Headphones', group: 'Contact', keywords: 'support service help', Icon: Headphones },
  { id: 'life-buoy', label: 'Life buoy', group: 'Contact', keywords: 'support help rescue emergency', Icon: LifeBuoy },
  { id: 'hourglass', label: 'Hourglass', group: 'Contact', keywords: 'time wait fast turnaround', Icon: Hourglass },

  // -- Business --
  { id: 'briefcase', label: 'Briefcase', group: 'Business', keywords: 'professional work commercial', Icon: Briefcase },
  { id: 'megaphone', label: 'Megaphone', group: 'Business', keywords: 'marketing announce promote', Icon: Megaphone },
  { id: 'rocket', label: 'Rocket', group: 'Business', keywords: 'fast launch growth', Icon: Rocket },
  { id: 'target', label: 'Target', group: 'Business', keywords: 'goal focus accurate', Icon: Target },
  { id: 'gift', label: 'Gift', group: 'Business', keywords: 'offer reward bonus referral', Icon: Gift },
  { id: 'tag', label: 'Tag', group: 'Business', keywords: 'price offer deal label', Icon: Tag },
  { id: 'dollar', label: 'Dollar', group: 'Business', keywords: 'price cost value money', Icon: DollarSign },
  { id: 'credit-card', label: 'Card', group: 'Business', keywords: 'payment billing finance', Icon: CreditCard },
  { id: 'package', label: 'Package', group: 'Business', keywords: 'product bundle delivery', Icon: Package },
  { id: 'layers', label: 'Layers', group: 'Business', keywords: 'range options stack', Icon: Layers },
  { id: 'globe', label: 'Globe', group: 'Business', keywords: 'web online global', Icon: Globe },
  { id: 'compass', label: 'Compass', group: 'Business', keywords: 'guide direction find', Icon: Compass },
  { id: 'camera', label: 'Camera', group: 'Business', keywords: 'photo media inspection', Icon: Camera },
  { id: 'wifi', label: 'Wi-Fi', group: 'Business', keywords: 'network smart connectivity', Icon: Wifi },
  { id: 'scissors', label: 'Scissors', group: 'Business', keywords: 'cut grooming salon trim', Icon: Scissors },
  { id: 'flag', label: 'Flag', group: 'Business', keywords: 'milestone goal mark', Icon: Flag },
];

/** The fallback icon id — used for fresh items and unknown ids. */
export const DEFAULT_SECTION_ICON = 'sparkles';

const ICON_BY_ID = new Map(SECTION_ICONS.map((d) => [d.id, d]));

/** Resolve an icon id to its definition (undefined when unknown / empty). */
export function getSectionIcon(id: string | undefined | null): SectionIconDef | undefined {
  if (!id) return undefined;
  return ICON_BY_ID.get(id);
}

/** Filter the curated set by a free-text query (id / label / keywords). */
export function searchSectionIcons(query: string): readonly SectionIconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return SECTION_ICONS;
  return SECTION_ICONS.filter(
    (d) =>
      d.id.includes(q) ||
      d.label.toLowerCase().includes(q) ||
      d.keywords.includes(q),
  );
}
