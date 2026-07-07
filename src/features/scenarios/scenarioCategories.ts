import { type ScenarioCategory } from '@/types';
import { Brain, Heart, Sparkles, Shield, MessageSquare } from 'lucide-react';

/**
 * Visual + display metadata per scenario category. Colors are plain Tailwind
 * utility classes (not theme tokens) so each category stays visually distinct
 * regardless of the active theme. The app has no `.dark` class strategy (themes
 * are driven entirely via `var(--theme-*)`), so we use translucent `x/10`
 * backgrounds that read well on both light and dark themes.
 */
export const CATEGORY_META = {
  assistant: {
    /** Tailwind classes for the icon chip: text color + translucent background. */
    chipClass: 'text-sky-600 bg-sky-500/10',
    /** Solid translucent bar color for the card left accent. */
    barClass: 'bg-sky-500',
    /** Default lucide icon for the category. */
    icon: Brain,
    /** Default emoji used when a scenario has no explicit emoji. */
    emoji: '🧠',
    /** Translation key for the category label. */
    labelKey: 'scenariosCategoryAssistant',
  },
  roleplay: {
    chipClass: 'text-rose-600 bg-rose-500/10',
    barClass: 'bg-rose-500',
    icon: Heart,
    emoji: '💖',
    labelKey: 'scenariosCategoryRoleplay',
  },
  creative: {
    chipClass: 'text-amber-600 bg-amber-500/10',
    barClass: 'bg-amber-500',
    icon: Sparkles,
    emoji: '✨',
    labelKey: 'scenariosCategoryCreative',
  },
  system: {
    chipClass: 'text-indigo-600 bg-indigo-500/10',
    barClass: 'bg-indigo-500',
    icon: Shield,
    emoji: '🛡️',
    labelKey: 'scenariosCategorySystem',
  },
  custom: {
    chipClass: 'text-emerald-600 bg-emerald-500/10',
    barClass: 'bg-emerald-500',
    icon: MessageSquare,
    emoji: '💬',
    labelKey: 'scenariosCategoryCustom',
  },
};

type CategoryMeta = (typeof CATEGORY_META)[ScenarioCategory];

export const DEFAULT_CATEGORY: ScenarioCategory = 'custom';

/** Resolve a scenario category, falling back to `custom` when unset. */
export const getCategory = (category?: ScenarioCategory): ScenarioCategory => category ?? DEFAULT_CATEGORY;

/** Resolve metadata, always falling back to the custom category. */
export const getCategoryMeta = (category?: ScenarioCategory): CategoryMeta => CATEGORY_META[getCategory(category)];

/** Ordered list of categories for the filter tabs. */
export const CATEGORY_ORDER: ScenarioCategory[] = ['assistant', 'roleplay', 'creative', 'system', 'custom'];
