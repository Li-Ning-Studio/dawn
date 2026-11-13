export type Answers = Record<string, string>;
export type ArchetypeId = string;
export type PersonalityPresentation = {
  title: string;
  line: string;
  description: string;
  image?: string;
};
export type Messages = Record<string, string>;
export type Option = {
  id: string;
  label: string;
  description?: string;
  tags?: string[];
  archetype?: ArchetypeId;
  budget?: number;
  // An explicit weight selection is a constraint, not a scoring preference.
  weight?: string;
};
export type Question = {
  id: string;
  title: string;
  help: string;
  placement: 'quiz' | 'refinement';
  layout: 'rows' | 'compact';
  // A visual default for optional refinements, not an implicitly saved answer.
  defaultOption?: string;
  weight: number;
  options: Option[];
};
export type PlayingStrength = 'power' | 'speed' | 'control';
export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';
export type ProductProfile = {
  handle: string;
  model: string;
  weight: string;
  shaftFlex?: 'Flexible' | 'Medium' | 'Hard Flex';
  balance?: 'Head Heavy' | 'Even Balanced' | 'Head Light';
  playingStrengths: PlayingStrength[];
  playerLevels: PlayerLevel[];
  consideration: string;
  enabled: boolean;
};
export type FinderConfig = {
  version: string;
  currency: string;
  budgetQuestion: string;
  personalityQuestion: string;
  exploration: PersonalityPresentation;
  resultLimit: number;
  concurrency: number;
  questions: Question[];
  archetypes: (PersonalityPresentation & { id: ArchetypeId })[];
  products: ProductProfile[];
};
export type LiveVariant = {
  id: number;
  available: boolean;
  price: number;
  title: string;
  requires_selling_plan?: boolean;
};
export type LiveProduct = {
  handle: string;
  title: string;
  featured_image: string | null;
  variants: LiveVariant[];
  requires_selling_plan?: boolean;
};
export type Recommendation = {
  profile: ProductProfile;
  product: LiveProduct;
  variant: LiveVariant;
  score: number;
  // Reviewed specifications refine equal primary fit scores only.
  specificationScore: number;
  reasons: { question: string; answer: string }[];
};

// Stable answer IDs are the storage and analytics contract. Bump version only
// when their meaning changes; translations and catalogue edits do not reset answers.
export const flow = {
  version: '3.0.0',
  currency: 'INR',
  budgetQuestion: 'budget',
  personalityQuestion: 'style',
  exploration: {
    title: 'exploring_title',
    line: 'exploring_line',
    description: 'exploring_description',
  },
  resultLimit: 3,
  concurrency: 4,
  questions: [
    {
      id: 'experience',
      placement: 'quiz',
      layout: 'rows',
      title: 'experience_title',
      help: 'experience_help',
      weight: 1,
      options: [
        {
          id: 'new',
          label: 'experience_new',
          tags: ['beginner'],
          description: 'experience_new_description',
        },
        {
          id: 'developing',
          label: 'experience_developing',
          tags: ['intermediate'],
          description: 'experience_developing_description',
        },
        {
          id: 'experienced',
          label: 'experience_experienced',
          tags: ['advanced'],
          description: 'experience_experienced_description',
        },
      ],
    },
    {
      id: 'style',
      placement: 'quiz',
      layout: 'rows',
      title: 'style_title',
      help: 'style_help',
      weight: 4,
      options: [
        {
          id: 'attack',
          label: 'style_attack',
          tags: ['power'],
          archetype: 'smash-merchant',
          description: 'style_attack_description',
        },
        {
          id: 'speed',
          label: 'style_speed',
          tags: ['speed'],
          archetype: 'speed-demon',
          description: 'style_speed_description',
        },
        {
          id: 'control',
          label: 'style_control',
          tags: ['control'],
          archetype: 'court-chessmaster',
          description: 'style_control_description',
        },
        {
          id: 'counter',
          label: 'style_counter',
          tags: ['speed', 'control'],
          archetype: 'comeback-kid',
          description: 'style_counter_description',
        },
        {
          id: 'adapt',
          label: 'style_adapt',
          tags: ['power', 'speed', 'control'],
          archetype: 'wild-card',
          description: 'style_adapt_description',
        },
        {
          id: 'unsure',
          label: 'style_unsure',
          description: 'style_unsure_description',
        },
      ],
    },
    {
      id: 'benefit',
      placement: 'quiz',
      layout: 'rows',
      title: 'benefit_title',
      help: 'benefit_help',
      weight: 0,
      options: [
        { id: 'power', label: 'benefit_power', description: 'benefit_power_description' },
        { id: 'handling', label: 'benefit_handling', description: 'benefit_handling_description' },
        { id: 'control', label: 'benefit_control', description: 'benefit_control_description' },
        { id: 'versatility', label: 'benefit_versatility', description: 'benefit_versatility_description' },
        { id: 'unsure', label: 'benefit_unsure', description: 'benefit_unsure_description' },
      ],
    },
    {
      id: 'budget',
      placement: 'quiz',
      layout: 'compact',
      title: 'budget_title',
      help: 'budget_help',
      weight: 0,
      options: [
        {
          id: '2000',
          label: 'budget_2000',
          budget: 200000,
        },
        {
          id: '3500',
          label: 'budget_3500',
          budget: 350000,
        },
        {
          id: '5000',
          label: 'budget_5000',
          budget: 500000,
        },
        {
          id: '10000',
          label: 'budget_10000',
          budget: 1000000,
        },
        {
          id: 'unlimited',
          label: 'budget_unlimited',
        },
      ],
    },
    {
      id: 'handling',
      placement: 'refinement',
      layout: 'compact',
      defaultOption: 'unsure',
      title: 'refine',
      help: 'handling_help',
      weight: 0,
      options: [
        {
          id: 'light',
          label: 'handling_light',
          weight: '5U',
        },
        {
          id: 'substantial',
          label: 'handling_substantial',
          weight: '3U',
        },
        {
          id: 'middle',
          label: 'handling_middle',
          weight: '4U',
        },
        {
          id: 'unsure',
          label: 'handling_unsure',
        },
      ],
    },
  ],
  archetypes: [
    {
      id: 'smash-merchant',
      title: 'smash_merchant_title',
      line: 'smash_merchant_line',
      description: 'smash_merchant_description',
    },
    {
      id: 'speed-demon',
      title: 'speed_demon_title',
      line: 'speed_demon_line',
      description: 'speed_demon_description',
    },
    {
      id: 'court-chessmaster',
      title: 'court_chessmaster_title',
      line: 'court_chessmaster_line',
      description: 'court_chessmaster_description',
    },
    {
      id: 'comeback-kid',
      title: 'comeback_kid_title',
      line: 'comeback_kid_line',
      description: 'comeback_kid_description',
    },
    {
      id: 'wild-card',
      title: 'wild_card_title',
      line: 'wild_card_line',
      description: 'wild_card_description',
    },
  ],
} satisfies Omit<FinderConfig, 'products'>;
