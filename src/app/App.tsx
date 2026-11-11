import { useEffect, useState } from "react";
import TimerPwmDemo from "../demos/timer-pwm/TimerPwmDemo";

function currentRoute(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function Home() {
  return (
    <main id="inhalt" className="container">
      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> PRAKTIKUM EINGEBETTETE SYSTEME</div>
        <h1>Hardware verstehen.<br /><span className="accent">Selbst ausprobieren.</span></h1>
        <p className="hero-text">
          Interaktive Experimente zu Mikrocontrollern und eingebetteten Systemen.
          Entdecke, was in der Hardware passiert – bevor du den Code auf dem Board ausführst.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#/timer-pwm">Timer &amp; PWM entdecken <span aria-hidden="true">↗</span></a>
          <a className="button button-secondary" href="https://github.com/KreutzM/PES-Demos" target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a>
        </div>
      </section>
      <section className="section" aria-labelledby="demos-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">DEMO-BIBLIOTHEK</div>
            <h2 id="demos-title">Interaktive Lernmodule</h2>
          </div>
          <p>Die Sammlung wird schrittweise erweitert.</p>
        </div>
        <div className="cards">
          <a href="#/timer-pwm" className="demo-card">
            <div className="card-visual" aria-hidden="true">
              <svg viewBox="0 0 360 112" role="presentation">
                <path d="M0 94H360 M0 56H360 M0 18H360" stroke="#26394e" strokeDasharray="4 7"/>
                <path d="M12 91V22H75V91H139V22H202V91H266V22H328V91H348" stroke="#42d5c4" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="card-body">
              <div className="card-meta"><span className="tag">INTERAKTIV</span><span className="chip">STM32F429</span></div>
              <h3>Timer &amp; PWM <span aria-hidden="true">↗</span></h3>
              <p>Prescaler, Auto-Reload, Compare-Register und PWM-Signal zusammen erleben.</p>
            </div>
          </a>
          <div className="demo-card upcoming">
            <div className="card-visual upcoming-visual"><span aria-hidden="true">+</span></div>
            <div className="card-body">
              <div className="card-meta"><span className="chip">IN PLANUNG</span></div>
              <h3>Weitere PES-Demos</h3>
              <p>Später können hier unter anderem ADC, Interrupts und weitere Hardwaremodule folgen.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="site">
      <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
      <header className="site-header">
        <div className="container nav">
          <a className="brand" href="#/" aria-label="PES-Demos Startseite"><span className="brand-mark">∿</span><span>PES<span className="brand-light">-Demos</span></span></a>
          <nav aria-label="Hauptnavigation">
            <a href="#/" aria-current={route === "/" ? "page" : undefined}>Übersicht</a>
            <a href="#/timer-pwm" aria-current={route === "/timer-pwm" ? "page" : undefined}>Timer &amp; PWM</a>
          </nav>
        </div>
      </header>
      {route === "/timer-pwm" ? <TimerPwmDemo /> : <Home />}
      <footer className="site-footer"><div className="container">PES-Demos · Lernwerkzeuge für das Praktikum Eingebettete Systeme · <a href="https://github.com/KreutzM/PES-Demos">Open Source auf GitHub</a></div></footer>
    </div>
  );
}
