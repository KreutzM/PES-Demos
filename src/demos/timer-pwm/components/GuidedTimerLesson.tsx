import { useEffect, useRef } from "react";
import type { ClockedCounterState } from "../model/prescaler";
import { pwmActive, type TimerResult } from "../model/timer";
import Waveform from "./Waveform";

interface GuidedTimerLessonProps {
  step: number;
  answer: string;
  onAnswer: (value: string) => void;
  psc: number;
  arr: number;
  ccr: number;
  state: ClockedCounterState;
  result: TimerResult;
  onInputClock: () => void;
  onCounterStep: (steps: number) => void;
  onPrescalerChange: (value: number) => void;
  onPeriodChange: (value: number) => void;
  onGoToStep: (step: number) => void;
  onOpenFreeLab: () => void;
}

const lessons = [
  {
    title: "Wie wirkt PSC = 3 auf den Zähler?",
    question: "Nach wie vielen Timer-Eingangstaktimpulsen steigt CNT von 0 auf 1?",
    options: [{ value: "1", label: "1 Impuls" }, { value: "3", label: "3 Impulse" }, { value: "4", label: "4 Impulse" }],
    correct: "4",
    explanation: "PSC = 3 beschreibt den Endwert der Prescaler-Zählung 0, 1, 2, 3. Erst nach vier Eingangstaktimpulsen entsteht ein CNT-Zählschritt.",
  },
  {
    title: "Was passiert am Zählerendwert ARR = 9?",
    question: "Welcher CNT-Zählerstand folgt direkt auf CNT = 9?",
    options: [{ value: "0", label: "0" }, { value: "9", label: "9" }, { value: "10", label: "10" }],
    correct: "0",
    explanation: "CNT zählt von 0 bis ARR = 9. Der nächste CNT-Zählschritt bewirkt den periodischen Zählerrücksprung ARR → 0. Eine Periode umfasst daher zehn Zählschritte.",
  },
  {
    title: "Wann wird OC2REF inaktiv?",
    question: "Bei welchem CNT-Zählerstand wird das interne PWM-Signal OC2REF inaktiv?",
    options: [{ value: "2", label: "CNT = 2" }, { value: "3", label: "CNT = 3" }, { value: "4", label: "CNT = 4" }],
    correct: "3",
    explanation: "Im aufwärtszählenden PWM-Modus 1 ist OC2REF bei CNT < CCR2 aktiv. Für CCR2 = 3 und ARR = 9 gilt: drei aktive Zählschritte von zehn, also 30 % Tastverhältnis.",
  },
  {
    title: "Wie beeinflussen PSC und ARR die Frequenz?",
    question: "Was passiert mit der PWM-Frequenz, wenn PSC von 3 auf 7 steigt und ARR = 9 bleibt?",
    options: [{ value: "half", label: "Sie halbiert sich" }, { value: "double", label: "Sie verdoppelt sich" }, { value: "same", label: "Sie bleibt gleich" }],
    correct: "half",
    explanation: "Der wirksame PSC-Teiler steigt von 4 auf 8: f_PWM halbiert sich. Anschließend verdoppelt ARR = 19 statt 9 die Periodenlänge nochmals; die Frequenz halbiert sich erneut. CCR2 bleibt dabei unverändert.",
  },
] as const;

function formatMHz(hz: number): string {
  return (hz / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " MHz";
}

export default function GuidedTimerLesson({
  step, answer, onAnswer, psc, arr, ccr, state, result,
  onInputClock, onCounterStep, onPrescalerChange, onPeriodChange,
  onGoToStep, onOpenFreeLab,
}: GuidedTimerLessonProps) {
  const lesson = lessons[step];
  const isPwmActive = pwmActive(state.cnt, ccr);
  const finished = step === 0 ? state.cnt >= 1
    : step === 1 ? state.overflows > 0
    : step === 2 ? !isPwmActive
    : psc === 7 && arr === 19;
  const actionAllowed = answer !== "";
  const match = answer === lesson.correct;
  const questionRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const initial = firstRender.current;
    firstRender.current = false;
    // On small screens start at the first question; after a step change
    // return focus/scroll from the old footer to the new question.
    if (initial && window.innerWidth > 760) return;
    questionRef.current?.focus({ preventScroll: true });
    questionRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step]);

  return (
    <section className="panel guided-lesson" aria-labelledby="guided-title">
      <header className="guided-heading">
        <div>
          <div className="eyebrow">GEFÜHRTER EINSTIEG · EXPERIMENT {step + 1} / 4</div>
          <h2 id="guided-title">{lesson.title}</h2>
          <p>TIM1 · RCC-Praktikumsprofil · Startwerte PSC = 3, ARR = 9, CCR2 = 3. Die Simulation ist nicht in Echtzeit.</p>
        </div>
      </header>

      <div className="guided-progress" aria-label={"Experiment " + (step + 1) + " von 4"}>
        {lessons.map((item, index) => (
          <button type="button" key={item.title}
            aria-current={index === step ? "step" : undefined}
            className={"guided-step-chip" + (index === step ? " selected" : "")}
            onClick={() => onGoToStep(index)}>
            {index + 1}. {["PSC", "ARR", "CCR2", "Frequenz"][index]}
          </button>
        ))}
      </div>
      <p className="guided-reset-notice">Beim Wechsel des Experiments beginnen Antwort und Zähler wieder bei null.</p>

      <div className="guided-workspace">
        <div className="guided-question">
          <div className="guided-section-label">1 · Vorhersagen</div>
          <h3 ref={questionRef} tabIndex={-1} data-testid="guided-question">{lesson.question}</h3>
          <fieldset className="guided-answers" disabled={finished}>
            <legend className="visually-hidden">Wähle deine Vermutung</legend>
            {lesson.options.map((option) => (
              <label className={"guided-answer" + (answer === option.value ? " chosen" : "")} key={option.value}>
                <input type="radio" name={"lesson-question-" + step} value={option.value}
                  checked={answer === option.value} onChange={() => onAnswer(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="guided-hint">
            {finished ? "Experiment abgeschlossen. Vergleiche deine Vorhersage mit der Beobachtung und Erklärung."
              : answer ? "Vermutung festgelegt. Führe nun das Experiment aus und prüfe das Ergebnis."
                : "Wähle zuerst deine Vermutung. Die Antwort wird erst nach dem Versuch erklärt."}
          </p>
        </div>

        <div className="guided-experiment">
          <div className="guided-section-label">2 · Experimentieren und beobachten</div>
          {step === 0 && (
            <>
              <div className="guided-state" aria-live="polite">
                <div><span>PSC-Registerwert</span><strong>3</strong></div>
                <div><span>Verarbeitete Eingangstaktimpulse</span><strong data-testid="guided-impulses">{state.cnt > 0 ? 4 : state.prescalerPhase}</strong></div>
                <div><span>CNT</span><strong data-testid="guided-cnt">{state.cnt}</strong></div>
              </div>
              <div className="guided-pulses" aria-label={"Bisher verarbeitete Eingangstaktimpulse: " + (state.cnt > 0 ? 4 : state.prescalerPhase)}>
                {Array.from({ length: state.cnt > 0 ? 4 : state.prescalerPhase }, (_, index) => (
                  <span className="processed" key={index + 1}>{index + 1}</span>
                ))}
              </div>
              <button type="button" className="button button-primary" disabled={!actionAllowed || finished}
                onClick={onInputClock}>+1 Timer-Eingangstaktimpuls</button>
              <p className="guided-observation">
                {finished ? "4. Eingangstaktimpuls → CNT +1! Der Prescaler beginnt wieder bei 0."
                  : "Verarbeitete Impulse: " + state.prescalerPhase + ". CNT bleibt bislang bei 0."}
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <div className="guided-state" aria-live="polite">
                <div><span>ARR</span><strong>9</strong></div>
                <div><span>CNT</span><strong data-testid="guided-cnt">{state.cnt}</strong></div>
                <div><span>CNT-Rücksprünge</span><strong data-testid="guided-wraps">{state.overflows}</strong></div>
              </div>
              <div className="guided-actions">
                <button type="button" className="button button-primary"
                  disabled={!actionAllowed || state.cnt === 9 || finished}
                  onClick={() => onCounterStep(9 - state.cnt)}>Bis CNT = 9</button>
                <button type="button" className="button button-ghost"
                  disabled={!actionAllowed || state.cnt !== 9 || finished}
                  onClick={() => onCounterStep(1)}>+1 CNT-Zählschritt</button>
              </div>
              <p className="guided-observation">
                {finished ? "Rücksprung beobachtet: CNT wechselte von 9 auf 0; die nächste Periode beginnt."
                  : state.cnt === 9 ? "CNT steht bei ARR = 9. Was passiert beim nächsten CNT-Zählschritt?"
                    : "Springe zunächst zum letzten Zählerstand 9 und schalte anschließend einen Zählschritt weiter."}
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <div className="guided-state" aria-live="polite">
                <div><span>CCR2</span><strong>3</strong></div>
                <div><span>CNT</span><strong data-testid="guided-cnt">{state.cnt}</strong></div>
                <div><span>OC2REF (intern)</span><strong data-testid="guided-oc2ref">{isPwmActive ? "1 · aktiv" : "0 · inaktiv"}</strong></div>
              </div>
              <button type="button" className="button button-primary"
                disabled={!actionAllowed || finished}
                onClick={() => onCounterStep(1)}>+1 CNT-Zählschritt</button>
              {finished && <div className="guided-waveform">
                <Waveform arr={arr} ccr={ccr} cnt={state.cnt} periodSeconds={result.periodSeconds} />
              </div>}
              <p className="guided-observation">
                {finished ? "CNT = CCR2 = 3: OC2REF wird inaktiv. Drei von zehn Zählschritten waren aktiv, also 30 %."
                  : "Beobachte, wie sich CNT und OC2REF bei jedem einzelnen CNT-Zählschritt verändern."}
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <div className="guided-state" aria-live="polite">
                <div><span>PSC (Teiler PSC + 1)</span><strong data-testid="guided-psc">{psc} (÷{psc + 1})</strong></div>
                <div><span>ARR (Zählschritte ARR + 1)</span><strong data-testid="guided-arr">{arr} ({arr + 1})</strong></div>
                <div><span>PWM-Frequenz</span><strong data-testid="guided-frequency">{formatMHz(result.pwmHz)}</strong></div>
                <div><span>CCR2 (unverändert)</span><strong data-testid="guided-ccr">{ccr}</strong></div>
              </div>
              <div className="guided-actions">
                <button type="button" className="button button-primary"
                  disabled={!actionAllowed || psc !== 3}
                  onClick={() => onPrescalerChange(7)}>PSC auf 7 setzen</button>
                <button type="button" className="button button-ghost"
                  disabled={!actionAllowed || psc !== 7 || arr !== 9}
                  onClick={() => onPeriodChange(19)}>ARR auf 19 setzen</button>
              </div>
              <p className="guided-observation">
                {finished ? "f_PWM = 1,05 MHz. PSC und ARR haben die Frequenz nacheinander halbiert. CCR2 bleibt 3."
                  : psc === 7 ? "PSC = 7: f_PWM = 2,1 MHz statt 4,2 MHz. Jetzt ARR von 9 auf 19 setzen."
                    : "Ausgangszustand: 168 MHz / (3 + 1) / (9 + 1) = 4,2 MHz."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="guided-result" aria-live="polite">
        <div className="guided-section-label">3 · Erklärung</div>
        {finished ? (
          <p><strong>{match ? "Deine Vorhersage war richtig." : "Deine Vorhersage war anders als die Beobachtung."}</strong>{" "}{lesson.explanation}</p>
        ) : (
          <p>Die Erklärung erscheint, sobald du deine Vermutung durch die Schritte überprüft hast.</p>
        )}
      </div>

      <footer className="guided-navigation">
        <button type="button" className="button button-ghost" disabled={step === 0}
          onClick={() => onGoToStep(step - 1)}>← Vorheriges Experiment</button>
        {step < 3 ? (
          <button type="button" className="button button-primary" disabled={!finished}
            onClick={() => onGoToStep(step + 1)}>Nächstes Experiment →</button>
        ) : (
          <button type="button" className="button button-primary" disabled={!finished}
            onClick={onOpenFreeLab}>Zum freien Labor →</button>
        )}
      </footer>
    </section>
  );
}
