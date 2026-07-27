import { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export type MultiStepFormStep<TState> = {
  id: string;
  canContinue: (state: TState) => boolean;
  render: (controls: MultiStepFormStepControls) => ComponentChildren;
};

export type MultiStepFormStepControls = {
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (nextStepIndex: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
};

type MultiStepFormProps<TState> = {
  steps: MultiStepFormStep<TState>[];
  state: TState;
  className?: string;
  labels: {
    back: string;
    next: string;
    submit: string;
  };
  onSubmit: () => void;
  hideBackButton?: boolean;
  actionsAlign?: 'space-between' | 'flex-end';
  actionsClassName?: string;
  showTopBar?: boolean;
  onRequestClose?: () => void;
  closeLabel?: string;
  renderActionsLeft?: (args: {
    state: TState;
    currentStepIndex: number;
    totalSteps: number;
    isLastStep: boolean;
    canContinue: boolean;
  }) => ComponentChildren;
  renderSummary?: (args: {
    state: TState;
    currentStepIndex: number;
    totalSteps: number;
    isLastStep: boolean;
    canContinue: boolean;
  }) => ComponentChildren;
};

const STEP_FADE_DURATION_MS = 180;

function MultiStepForm<TState>({
  steps,
  state,
  className,
  labels,
  onSubmit,
  hideBackButton = false,
  actionsAlign = 'space-between',
  actionsClassName,
  showTopBar = false,
  onRequestClose,
  closeLabel,
  renderActionsLeft,
  renderSummary,
}: MultiStepFormProps<TState>) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [visibleStepIndex, setVisibleStepIndex] = useState(0);
  const [isStepVisible, setIsStepVisible] = useState(true);
  const stepTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTransitionTimeoutRef.current) {
        clearTimeout(stepTransitionTimeoutRef.current);
      }
    };
  }, []);

  const goToStep = (nextStepIndex: number) => {
    if (nextStepIndex < 0 || nextStepIndex >= steps.length || nextStepIndex === activeStepIndex) {
      return;
    }

    setActiveStepIndex(nextStepIndex);
    setIsStepVisible(false);

    if (stepTransitionTimeoutRef.current) {
      clearTimeout(stepTransitionTimeoutRef.current);
    }

    stepTransitionTimeoutRef.current = setTimeout(() => {
      setVisibleStepIndex(nextStepIndex);
      setIsStepVisible(true);
    }, STEP_FADE_DURATION_MS);
  };

  const activeStep = useMemo(() => steps[visibleStepIndex], [steps, visibleStepIndex]);

  if (!activeStep) {
    return null;
  }

  const isLastStep = visibleStepIndex === steps.length - 1;
  const canContinue = activeStep.canContinue(state);
  const stepControls: MultiStepFormStepControls = {
    currentStepIndex: visibleStepIndex,
    totalSteps: steps.length,
    isFirstStep: visibleStepIndex === 0,
    isLastStep,
    goToStep,
    goToNextStep: () => goToStep(visibleStepIndex + 1),
    goToPreviousStep: () => goToStep(visibleStepIndex - 1),
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100%',
      }}
    >
      {showTopBar ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: window.innerWidth < 990 ? '2rem' : '6rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (visibleStepIndex === 0) {
                onRequestClose?.();
              } else {
                goToStep(visibleStepIndex - 1);
              }
            }}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--color-foreground)',
              padding: 0,
            }}
            aria-label={labels.back}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M228,128a12,12,0,0,1-12,12H69l51.52,51.51a12,12,0,0,1-17,17l-72-72a12,12,0,0,1,0-17l72-72a12,12,0,0,1,17,17L69,116H216A12,12,0,0,1,228,128Z"></path>
            </svg>
          </button>

          <button
            type="button"
            onClick={onRequestClose}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0.5rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              color: '#111',
            }}
            aria-label={closeLabel || 'Close'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"></path>
            </svg>
          </button>
        </div>
      ) : null}

      <div
        key={activeStep.id}
        style={{
          opacity: isStepVisible ? 1 : 0,
          transform: isStepVisible ? 'translateY(0px)' : 'translateY(8px)',
          transition: `opacity ${STEP_FADE_DURATION_MS}ms ease, transform ${STEP_FADE_DURATION_MS}ms ease`,
        }}
      >
        {activeStep.render(stepControls)}
      </div>

      <div
        className={actionsClassName}
        style={{
          marginTop: '4rem',
          display: 'flex',
          justifyContent: actionsAlign,
          gap: '1rem',
        }}
      >
        {renderActionsLeft ? (
          renderActionsLeft({
            state,
            currentStepIndex: visibleStepIndex,
            totalSteps: steps.length,
            isLastStep,
            canContinue,
          })
        ) : !hideBackButton && visibleStepIndex > 0 ? (
          <button type="button" className="button button--secondary" onClick={() => goToStep(visibleStepIndex - 1)}>
            {labels.back}
          </button>
        ) : !hideBackButton ? (
          <span />
        ) : null}

        {isLastStep ? (
          <button type="button" className="button" onClick={onSubmit} disabled={!canContinue}>
            {labels.submit}
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => goToStep(visibleStepIndex + 1)}
            disabled={!canContinue}
          >
            {labels.next}
          </button>
        )}
      </div>

      {renderSummary ? (
        <div
          style={{
            marginTop: 'auto',
            padding: '2rem 0',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              paddingTop: '4rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {renderSummary({
              state,
              currentStepIndex: visibleStepIndex,
              totalSteps: steps.length,
              isLastStep,
              canContinue,
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MultiStepForm;
