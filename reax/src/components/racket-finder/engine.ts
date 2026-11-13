import type { Answers, ArchetypeId, FinderConfig, LiveProduct, Recommendation } from './config.ts';

// Rules deliberately have no DOM, Shopify, storage or analytics dependencies.
// Keep ranking reproducible so catalogue/editorial changes can be reviewed with fixtures.
export function quizQuestions(config: FinderConfig) {
  return config.questions.filter((q) => q.placement === 'quiz');
}

export function cleanAnswers(config: FinderConfig, value: unknown): Answers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Answers;
  const result: Answers = {};
  for (const q of config.questions) {
    if (q.options.some((option) => option.id === raw[q.id])) result[q.id] = raw[q.id];
  }
  return result;
}

export function complete(config: FinderConfig, answers: Answers) {
  const safe = cleanAnswers(config, answers);
  return quizQuestions(config).every((question) => !!safe[question.id]);
}

export function identify(config: FinderConfig, answers: Answers): ArchetypeId | null {
  const safe = cleanAnswers(config, answers);
  return (
    config.questions
      .find((q) => q.id === config.personalityQuestion)
      ?.options.find((o) => o.id === safe[config.personalityQuestion])?.archetype || null
  );
}

export function rank(config: FinderConfig, answers: Answers, products: LiveProduct[]): Recommendation[] {
  const safe = cleanAnswers(config, answers);
  if (!complete(config, safe)) return [];
  const budget =
    config.questions
      .find((q) => q.id === config.budgetQuestion)
      ?.options.find((o) => o.id === safe[config.budgetQuestion])?.budget ?? Infinity;
  const weights = config.questions
    .filter((q) => q.id !== 'benefit')
    .map((q) => q.options.find((o) => o.id === safe[q.id])?.weight)
    .filter((weight): weight is string => !!weight);
  const live = new Map(products.map((p) => [p.handle, p]));
  const candidates: Recommendation[] = [];
  for (const profile of config.products) {
    if (!profile.enabled) continue;
    // Match the reviewed weight field, not an optional suitability tag. Never
    // silently substitute another class when the chosen weight is unavailable.
    if (weights.some((weight) => profile.weight !== weight)) continue;
    const product = live.get(profile.handle);
    if (!product || product.requires_selling_plan) continue;
    const variant = product.variants
      .filter(
        (v) =>
          v.available && !v.requires_selling_plan && Number.isSafeInteger(v.price) && v.price >= 0 && v.price <= budget,
      )
      .sort((a, b) => a.price - b.price || a.id - b.id)[0];
    if (!variant) continue;
    let score = 0;
    const reasons: Recommendation['reasons'] = [];
    for (const q of config.questions) {
      if (!['style', 'experience'].includes(q.id)) continue;
      const answer = q.options.find((o) => o.id === safe[q.id]);
      const tags = answer?.tags || [];
      const suitability: readonly string[] = q.id === 'style' ? profile.playingStrengths : profile.playerLevels;
      const matches = tags.filter((tag) => suitability.includes(tag)).length;
      if (matches && q.weight) {
        score += (q.weight * matches) / tags.length;
        reasons.push({ question: q.id, answer: answer!.id });
      }
    }
    if (weights.length) reasons.push({ question: 'handling', answer: safe.handling });
    candidates.push({ profile, product, variant, score, specificationScore: 0, reasons });
  }

  const scoringQuestions = config.questions.filter((q) => q.id !== 'benefit' && q.weight > 0);
  const style = scoringQuestions.find((q) => q.id === config.personalityQuestion);
  const styleTags = style?.options.find((o) => o.id === safe[style.id])?.tags || [];
  const power = styleTags.includes('power');
  const speed = styleTags.includes('speed');
  const control = styleTags.includes('control');
  const preferredBalances: NonNullable<Recommendation['profile']['balance']>[] =
    power && speed && control
      ? ['Even Balanced']
      : power && !speed && !control
        ? ['Head Heavy']
        : speed && !power
          ? control
            ? ['Head Light', 'Even Balanced']
            : ['Head Light']
          : [];
  const beginner = scoringQuestions.some((q) => q.options.find((o) => o.id === safe[q.id])?.tags?.includes('beginner'));

  // Specifications refine ties, rather than counting playing style twice in
  // the primary score. Evaluate coverage within each eligible fit group so
  // missing catalogue evidence cannot masquerade as a specification mismatch.
  // Eligibility (stock, budget and weight) is already resolved above.
  const fitGroups = new Map<number, Recommendation[]>();
  for (const candidate of candidates) {
    const group = fitGroups.get(candidate.score) || [];
    group.push(candidate);
    fitGroups.set(candidate.score, group);
  }
  for (const group of fitGroups.values()) {
    const balanceKnown = group.every((candidate) => !!candidate.profile.balance);
    const flexKnown = group.every((candidate) => !!candidate.profile.shaftFlex);
    for (const candidate of group) {
      if (balanceKnown && preferredBalances.includes(candidate.profile.balance!)) candidate.specificationScore += 0.5;
      // Beginner assistance is a modest editorial preference. Experience alone
      // does not establish swing speed, so intermediate/advanced flex is neutral.
      if (flexKnown && beginner && ['Flexible', 'Medium'].includes(candidate.profile.shaftFlex!))
        candidate.specificationScore += 0.25;
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.specificationScore - a.specificationScore ||
      b.variant.price - a.variant.price ||
      a.profile.handle.localeCompare(b.profile.handle, 'en'),
  );
  const models = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (models.has(candidate.profile.model)) return false;
      models.add(candidate.profile.model);
      return true;
    })
    .slice(0, config.resultLimit);
}

function validChoices(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => allowed.includes(item));
}

export function validateConfig(config: FinderConfig): string[] {
  const errors: string[] = [];
  // Quiz definitions are compiled code. Validate the external catalogue and
  // section setting here; tests cover the fixed flow and translation contract.
  if (!Number.isInteger(config.resultLimit) || config.resultLimit < 1 || config.resultLimit > 3)
    errors.push('Result limit must be 1–3');
  if (!Array.isArray(config.products)) return [...errors, 'Missing profiles'];
  const handles = new Set<string>();
  for (const p of config.products) {
    if (!p || typeof p !== 'object') {
      errors.push('Invalid profile');
      continue;
    }
    if (p.shaftFlex && !['Flexible', 'Medium', 'Hard Flex'].includes(p.shaftFlex))
      errors.push(`Invalid shaft flex: ${p.handle}`);
    if (p.balance && !['Head Heavy', 'Even Balanced', 'Head Light'].includes(p.balance))
      errors.push(`Invalid balance: ${p.handle}`);
    if (
      !['handle', 'model', 'weight', 'consideration'].every((key) => {
        const value = p[key as keyof typeof p];
        return typeof value === 'string' && !!value.trim();
      }) ||
      !/^[a-z0-9-]+$/.test(p.handle) ||
      handles.has(p.handle) ||
      !/^[2-8]U$/.test(p.weight) ||
      typeof p.consideration !== 'string' ||
      !p.consideration.trim() ||
      !validChoices(p.playingStrengths, ['power', 'speed', 'control']) ||
      !validChoices(p.playerLevels, ['beginner', 'intermediate', 'advanced']) ||
      typeof p.enabled !== 'boolean'
    )
      errors.push(`Invalid profile: ${p.handle}`);
    handles.add(p.handle);
  }
  return errors;
}
