import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { cleanAnswers, complete, identify, quizQuestions, rank } from './engine.ts';
import { downloadCard, forgetAnswers, loadProducts, message, saveAnswers, track } from './platform.ts';
import type {
  Answers,
  FinderConfig,
  LiveProduct,
  Messages,
  ProductProfile,
  Question,
  Recommendation,
} from './config.ts';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

type QuestionTransition = { phase: 'answering' } | { phase: 'waiting' | 'leaving'; navigate: () => void };
type QuestionEvent = { type: 'request'; navigate: () => void; wait: boolean } | { type: 'leave' | 'finish' | 'cancel' };

// A new selection replaces the pending destination. Once the outgoing fade
// starts, navigation is locked until it finishes. Keep this local to the finder:
// catalogue requests and result refinements do not participate in navigation.
export function transitionQuestion(state: QuestionTransition, event: QuestionEvent): QuestionTransition {
  switch (event.type) {
    case 'request':
      return state.phase === 'leaving'
        ? state
        : { phase: event.wait ? 'waiting' : 'leaving', navigate: event.navigate };
    case 'leave':
      return state.phase === 'waiting' ? { ...state, phase: 'leaving' } : state;
    case 'finish':
      return state.phase === 'leaving' ? { phase: 'answering' } : state;
    case 'cancel':
      return { phase: 'answering' };
  }
}

// Show only reviewed profile specifications. In particular, do not derive exact
// grams or infer shaft flex/balance from a model name or playing-style score.
export function racketSpecs(profile: ProductProfile, t: Translate) {
  const flex = ['Flexible', 'Medium', 'Hard Flex'];
  const balance = ['Head Light', 'Even Balanced', 'Head Heavy'];
  const flexLabels = ['spec_flexible', 'spec_medium', 'spec_hard_flex'];
  const balanceLabels = ['spec_head_light', 'spec_even', 'spec_head_heavy'];
  const flexPosition = flex.indexOf(profile.shaftFlex || '');
  const balancePosition = balance.indexOf(profile.balance || '');
  // These are ordered categories, not performance scores or equal physical
  // intervals. Keep the exact U class visible: 5U+ is lighter, 4U is middle,
  // and 2U/3U is heavier. Unknown values never acquire a midpoint marker.
  const weightClass = /^[2-8]U$/.test(profile.weight) ? Number(profile.weight[0]) : null;
  return [
    {
      label: t('spec_weight_label'),
      value: weightClass === null ? t('spec_unknown') : profile.weight,
      position: weightClass === null ? -1 : weightClass >= 5 ? 0 : weightClass === 4 ? 1 : 2,
      ends: [t('spec_lighter'), t('spec_heavier')],
    },
    {
      label: t('spec_flex_label'),
      value: flexPosition < 0 ? t('spec_unknown') : t(flexLabels[flexPosition]),
      position: flexPosition,
      ends: [t('spec_flexible'), t('spec_hard_flex')],
    },
    {
      label: t('spec_balance_label'),
      value: balancePosition < 0 ? t('spec_unknown') : t(balanceLabels[balancePosition]),
      position: balancePosition,
      ends: [t('spec_head_light'), t('spec_head_heavy')],
    },
  ];
}

export function reasonTexts(config: FinderConfig, item: Recommendation, t: Translate) {
  return item.reasons
    .filter((reason) => reason.question !== 'benefit')
    .sort(
      (a, b) =>
        ['style', 'handling', 'experience'].indexOf(a.question) -
        ['style', 'handling', 'experience'].indexOf(b.question),
    )
    .slice(0, 2)
    .map((reason) => {
      const option = config.questions
        .find((q) => q.id === reason.question)
        ?.options.find((o) => o.id === reason.answer);
      return t(`reason_${reason.question}`, {
        answer: option ? t(option.label).toLocaleLowerCase() : '',
        weight: item.profile.weight,
      });
    });
}

// Match Stringing2's selection pause and MultiStepForm's fade duration. Keep
// these local so independently cached PDP entries gain no shared dependency.
const AUTO_ADVANCE_DELAY_MS = 320;
const STEP_FADE_DURATION_MS = 180;
const RESULT_PREPARATION_MS = 2500;

type Props = {
  config: FinderConfig;
  messages: Messages;
  root: string;
  browseUrl: string;
  currency: string;
  saved: Answers;
  section: HTMLElement;
  onHome: () => void;
};

// Same chevron geometry as the theme's icon-caret asset; kept local to this entry
// so independently cached PDP bundles do not acquire a new shared dependency.
function Caret() {
  return (
    <svg
      class="icon icon-caret"
      aria-hidden="true"
      fill="none"
      strokeWidth="1.5"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m19.5 8.25-7.5 7.5-7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Finder({ config, messages, root, browseUrl, currency, saved, section, onHome }: Props) {
  const questions = quizQuestions(config);
  const [answers, setAnswers] = useState<Answers>(saved);
  const [mode, setMode] = useState<'quiz' | 'preparing' | 'results'>(complete(config, saved) ? 'results' : 'quiz');
  const [step, setStep] = useState(() => questions.find((q) => !saved[q.id])?.id || questions[0].id);
  const [reveal, setReveal] = useState<'idle' | 'waiting' | 'revealing'>('idle');
  const hasCompleted = useRef(complete(config, saved));
  const [catalogue, setCatalogue] = useState<{
    status: 'idle' | 'loading' | 'ready';
    products: LiveProduct[];
    failed: string[];
  }>({ status: 'idle', products: [], failed: [] });
  const { products, failed } = catalogue;
  const loading = catalogue.status === 'loading';
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [transition, dispatchTransition] = useReducer(transitionQuestion, { phase: 'answering' });
  const stepLeaving = transition.phase === 'leaving';
  const request = useRef<AbortController>();
  const fetchedAt = useRef(0);
  const t = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const refinements = config.questions.filter((q) => q.placement === 'refinement');
  const position = Math.max(
    0,
    questions.findIndex((q) => q.id === step),
  );
  const question = questions[position];
  const identity = identify(config, answers);
  const exploring = identity === null;
  const archetype = config.archetypes.find((a) => a.id === identity) || config.exploration;
  const profileLine = t(archetype.line);
  const profileDescription = t(archetype.description);
  const selectedWeight = config.questions
    .map((q) => q.options.find((o) => o.id === answers[q.id])?.weight)
    .find(Boolean);
  const recommendations = useMemo(
    () => (currency === config.currency ? rank(config, answers, products) : []),
    [config, answers, products, currency],
  );
  const price = (value: number) =>
    new Intl.NumberFormat(document.documentElement.lang || 'en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value / 100);
  const productLink = (item: Recommendation) => `${root}products/${item.profile.handle}?variant=${item.variant.id}`;

  // This is a bounded presentation pause, independent of catalogue requests.
  // Restored results and edits bypass it; leaving this view cancels the timer.
  useLayoutEffect(() => {
    if (mode !== 'preparing') return;
    const timer = setTimeout(() => {
      setMode('results');
      setReveal('waiting');
    }, RESULT_PREPARATION_MS);
    return () => clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (reveal !== 'waiting' || loading) return;
    setReveal(recommendations.length > 0 ? 'revealing' : 'idle');
  }, [reveal, loading, recommendations.length]);
  useEffect(() => {
    if (reveal !== 'revealing') return;
    const timeout = setTimeout(() => setReveal('idle'), 450);
    return () => clearTimeout(timeout);
  }, [reveal]);

  async function refresh() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setCatalogue((current) => ({ ...current, status: 'loading' }));
    const result = await loadProducts(config, root, controller.signal);
    if (controller.signal.aborted || request.current !== controller) return;
    setCatalogue({ status: 'ready', ...result });
    fetchedAt.current = Date.now();
  }

  useEffect(() => {
    if (currency === config.currency) void refresh();
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - fetchedAt.current > 60000 &&
        currency === config.currency
      )
        void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      request.current?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const rect = section.getBoundingClientRect();
    if (rect.top < -80 || rect.top > window.innerHeight * 0.65)
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
    setStatus('');
  }, [mode, step]);

  // Start timing at the committed phase, without useEffect's deferred start.
  // One timer owns both stages and is cancelled on replacement or unmount.
  useLayoutEffect(() => {
    if (transition.phase === 'answering') return;
    const timer = setTimeout(
      () => {
        if (transition.phase === 'waiting') dispatchTransition({ type: 'leave' });
        else {
          dispatchTransition({ type: 'finish' });
          transition.navigate();
        }
      },
      transition.phase === 'waiting' ? AUTO_ADVANCE_DELAY_MS : STEP_FADE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [transition]);

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function transitionStep(navigate: () => void, wait = false) {
    if (stepLeaving) return;
    if (reducedMotion()) {
      dispatchTransition({ type: 'cancel' });
      navigate();
      return;
    }
    dispatchTransition({ type: 'request', navigate, wait });
  }

  function change(option: string) {
    if (stepLeaving) return;
    const next = cleanAnswers(config, { ...answers, [question.id]: option });
    setAnswers(next);
    track(config, 'answered', { question: question.id, answer: option });
    transitionStep(() => advance(next), true);
  }

  function refine(questionId: string, option: string) {
    setReveal('idle');
    const next = cleanAnswers(config, { ...answers, [questionId]: option });
    setAnswers(next);
    saveAnswers(config, next);
    setStatus(t('refined'));
    track(config, 'answered', { question: questionId, answer: option });
    // Refining keeps focus and the result view intact; it is not a new completion.
    if (Date.now() - fetchedAt.current > 60000 && currency === config.currency) void refresh();
  }

  function choices(q: Question, onChange: (value: string) => void) {
    const selected = answers[q.id] || q.defaultOption;
    return (
      <fieldset
        class={`rf-options ${q.layout === 'compact' ? 'rf-options--pills' : ''}`}
        aria-label={t(q.title)}
        aria-describedby={`${section.id}-${q.id}-help`}
        disabled={q.placement === 'quiz' && stepLeaving}
      >
        {q.options.map((option) => {
          const id = `${section.id}-${q.id}-${option.id}`;
          return (
            <label class="rf-option" key={id}>
              <input
                type="radio"
                class="visually-hidden"
                name={`${section.id}-${q.id}`}
                value={option.id}
                checked={selected === option.id}
                // Click also fires when revisiting an already selected answer.
                // Keep refinements on change so they only update the shortlist.
                onClick={q.placement === 'quiz' ? () => onChange(option.id) : undefined}
                onChange={q.placement === 'refinement' ? () => onChange(option.id) : undefined}
                aria-labelledby={`${id}-label`}
                aria-describedby={option.description ? `${id}-description` : undefined}
              />
              <span class="rf-option-copy">
                <span id={`${id}-label`} class="s3_subtitle">
                  {t(option.label)}
                </span>
                {option.description ? (
                  <span id={`${id}-description`} class="rf-option-description s3_paragraph">
                    {t(option.description)}
                  </span>
                ) : null}
              </span>
              {q.layout === 'rows' ? (
                <span class="rf-option-mark" aria-hidden="true">
                  <span class="rf-icon rf-icon--check" />
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
    );
  }

  function advance(updatedAnswers: Answers) {
    if (!updatedAnswers[question.id]) return;
    if (position < questions.length - 1) setStep(questions[position + 1].id);
    else if (complete(config, updatedAnswers)) {
      const prepare = !hasCompleted.current && section.dataset.shortlistReveal === 'true';
      hasCompleted.current = true;
      saveAnswers(config, updatedAnswers);
      setMode(prepare ? 'preparing' : 'results');
      track(config, 'completed', { archetype: identify(config, updatedAnswers) ?? 'exploring' });
      if (Date.now() - fetchedAt.current > 60000 && currency === config.currency) void refresh();
    }
  }

  function restart() {
    forgetAnswers();
    setAnswers({});
    setStep(questions[0].id);
    setMode('quiz');
    setReveal('idle');
    dispatchTransition({ type: 'cancel' });
    hasCompleted.current = false;
    track(config, 'started');
  }

  function edit(id: string) {
    setReveal('idle');
    dispatchTransition({ type: 'cancel' });
    setStep(id);
    setMode('quiz');
  }

  async function download() {
    if (exporting || !archetype.image) return;
    setExporting(true);
    try {
      await downloadCard(archetype.image);
      setStatus(t('downloaded'));
      track(config, 'card_downloaded', { archetype: identity ?? 'exploring' });
    } catch {
      setStatus(t('download_error'));
    } finally {
      setExporting(false);
    }
  }

  function card(item: Recommendation, index: number) {
    const image = item.product.featured_image;
    const link = productLink(item);
    const onProductClick = () =>
      track(config, 'product_clicked', {
        archetype: identity ?? 'exploring',
        handle: item.profile.handle,
        variant: item.variant.id,
        position: index + 1,
      });
    const reasons = reasonTexts(config, item, t);
    const specs = racketSpecs(item.profile, t);
    return (
      <article class={`rf-product s3_paragraph ${index === 0 ? 'rf-product--lead' : ''}`} key={item.profile.handle}>
        {image ? (
          <a class="rf-product-image" href={link} tabIndex={-1} aria-hidden="true" onClick={onProductClick}>
            <img
              src={`${image}${image.includes('?') ? '&' : '?'}width=640`}
              alt=""
              width="640"
              height="640"
              loading="lazy"
            />
          </a>
        ) : null}
        <div class="rf-product-copy">
          <p class="rf-label s3_caption">{index === 0 ? t('recommended') : t('alternatives')}</p>
          <h3 class="s3_title">{item.product.title}</h3>
          <p class="rf-price">{price(item.variant.price)}</p>
          <p class="rf-product-guidance">{item.profile.consideration}</p>
          <dl class="rf-racket-specs">
            {specs.map((spec) => (
              <div class="rf-spec" key={spec.label}>
                <dt>{spec.label}</dt>
                <dd class="rf-spec-value">{spec.value}</dd>
                <dd class="rf-spec-visual" aria-hidden="true">
                  <span class="rf-spec-track">
                    {[0, 1, 2].map((position) => (
                      <span class={position === spec.position ? 'is-active' : ''} key={position} />
                    ))}
                  </span>
                  <span class="rf-spec-ends">
                    <span>{spec.ends[0]}</span>
                    <span>{spec.ends[1]}</span>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          {reasons.length ? (
            <>
              <h4 class="s3_subtitle">{t('why')}</h4>
              <ul>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t('neutral_note')}</p>
          )}
          <a class="button button--primary button--large rf-action" href={link} onClick={onProductClick}>
            {t('view')} <span class="rf-icon rf-icon--arrow rf-icon--diagonal" aria-hidden="true" />
          </a>
        </div>
      </article>
    );
  }

  if (mode === 'preparing')
    return (
      <div class="rf-preparing">
        <h1 class="s3_title" ref={heading} tabIndex={-1} aria-describedby={`${section.id}-preparing-detail`}>
          {t(exploring ? 'preparing_exploration_title' : 'preparing_title')}
        </h1>
        <p class="s3_paragraph" id={`${section.id}-preparing-detail`}>
          {t(exploring ? 'preparing_exploration_detail' : 'preparing_detail')}
        </p>
      </div>
    );

  if (mode === 'quiz')
    return (
      <div class="rf-quiz">
        <div class="rf-quiz-top s3_caption">
          <button
            type="button"
            class="link underlined-link rf-text-button"
            disabled={stepLeaving}
            onClick={() => transitionStep(() => (position ? setStep(questions[position - 1].id) : onHome()))}
          >
            <span class="rf-icon rf-icon--arrow rf-icon--back" aria-hidden="true" /> {t('back')}
          </button>
        </div>
        <div key={question.id} class={`rf-question-layout${stepLeaving ? ' rf-question-layout--leaving' : ''}`}>
          <aside class="rf-question-aside">
            <progress class="visually-hidden" aria-label={t('progress')} max={questions.length} value={position + 1} />
            <h1 class="s3_title" ref={heading} tabIndex={-1} id={`${section.id}-question`}>
              {t(question.title)}
            </h1>
            <p class="rf-question-help s3_paragraph" id={`${section.id}-${question.id}-help`}>
              {t(question.help)}
            </p>
            <p class="rf-step s3_caption">{t('step', { current: position + 1, total: questions.length })}</p>
          </aside>
          <div class="rf-question-answers">
            {choices(question, change)}
            <div class="rf-question-actions">
              <button
                type="button"
                class="button button--primary button--large rf-next"
                disabled={!answers[question.id] || stepLeaving}
                onClick={() => transitionStep(() => advance(answers))}
              >
                {t(position === questions.length - 1 ? 'reveal' : 'next')}{' '}
                <span class="rf-icon rf-icon--arrow" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div class="rf-results">
      <div class="rf-personality s3_paragraph">
        {archetype.image ? (
          <img class="rf-personality-art" src={archetype.image} alt={t(archetype.title)} width="1024" height="1536" />
        ) : null}
        <div class="rf-personality-content">
          <div class="rf-personality-copy">
            {!exploring ? (
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }} class="s3_paragraph">
                {t('personality_intro')}
              </p>
            ) : null}
            <h1 class="s3_title" tabIndex={-1} ref={heading}>
              {t(archetype.title)}
            </h1>
            <p class="rf-tagline s3_subtitle">{profileLine}</p>
            <p>{profileDescription}</p>
          </div>
          {archetype.image ? (
            <div class="rf-card-actions">
              <button
                type="button"
                class="button button--secondary button--large rf-action"
                disabled={exporting}
                onClick={download}
              >
                {t('download')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div class="rf-result-tools s3_paragraph">
        <p>{t(exploring ? 'neutral_note' : 'profile_note')}</p>
        <button type="button" class="link underlined-link rf-text-button" onClick={() => edit(questions[0].id)}>
          {t('edit')}
        </button>
      </div>
      <p role="status" class="rf-status s3_caption">
        {status}
      </p>
      <div class="rf-shortlist-heading">
        <h2 class="s3_title">{t('results')}</h2>
        <button type="button" class="link underlined-link rf-text-button" onClick={() => edit(config.budgetQuestion)}>
          {t('change_budget')}
        </button>
      </div>
      {refinements.map((q) => (
        <section key={q.id} class="rf-refinement" aria-labelledby={`${section.id}-${q.id}-title`}>
          <h3 class="s3_subtitle" id={`${section.id}-${q.id}-title`}>
            {t(q.title)}
          </h3>
          <p class="s3_paragraph" id={`${section.id}-${q.id}-help`}>
            {t(q.help)}
          </p>
          {choices(q, (option) => refine(q.id, option))}
        </section>
      ))}
      <div aria-busy={loading}>
        {currency !== config.currency ? (
          <p class="rf-notice s3_paragraph" role="status">
            {t('currency_error')}
          </p>
        ) : loading ? (
          <p class="rf-notice s3_paragraph" role="status">
            {t('loading')}
          </p>
        ) : (
          <>
            {failed.length ? (
              <div class="rf-notice s3_paragraph" role="status">
                <p>{t(products.length ? 'partial' : 'catalogue_error')}</p>
                <button type="button" class="link underlined-link rf-text-button" onClick={refresh}>
                  {t('retry')}
                </button>
              </div>
            ) : null}
            {recommendations.length ? (
              <div class={`rf-products${reveal === 'revealing' ? ' rf-products--reveal' : ''}`}>
                {recommendations.map(card)}
              </div>
            ) : products.length || !failed.length ? (
              <p class="rf-notice s3_paragraph">
                {selectedWeight ? t('empty_weight', { weight: selectedWeight }) : t('empty')}
              </p>
            ) : null}
          </>
        )}
      </div>
      <p class="rf-meta s3_caption">{t('unstrung')}</p>
      {browseUrl ? (
        <a class="link underlined-link rf-text-button" href={browseUrl}>
          {t('browse')} <span class="rf-icon rf-icon--arrow rf-icon--diagonal" aria-hidden="true" />
        </a>
      ) : null}
      <div class="accordion rf-answer-summary">
        <details>
          <summary>
            <span class="summary__title s3_subtitle">{t('edit_summary')}</span>
            <Caret />
          </summary>
          <dl class="accordion__content s3_paragraph">
            {questions.map((q) => (
              <div key={q.id}>
                <dt>{t(q.title)}</dt>
                <dd>
                  {t(q.options.find((o) => o.id === answers[q.id])?.label || '')}{' '}
                  <button type="button" class="link underlined-link rf-text-button" onClick={() => edit(q.id)}>
                    {t('edit')}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
      <div class="rf-storage s3_caption">
        <p>{t('local_note')}</p>
        <button
          type="button"
          class="link underlined-link rf-text-button"
          onClick={() => {
            forgetAnswers();
            setStatus(t('forgotten'));
          }}
        >
          {t('forget')}
        </button>
        <button type="button" class="link underlined-link rf-text-button" onClick={restart}>
          {t('restart')}
        </button>
      </div>
    </div>
  );
}
