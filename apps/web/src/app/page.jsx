'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Show, useClerk } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';

const metrics = [
  { value: '$2.4B', label: 'Total Hiring Budgets Managed' },
  { value: '140K+', label: 'Active Talent Pool' },
  { value: '8.5%', label: 'Reduction in Time-to-Hire' },
  { value: '<2s', label: 'Average AI Analysis Time' },
];

const footerColumns = [
  {
    heading: 'Platform',
    links: ['Product Tour', 'Interview AI', 'Talent Scoring', 'Integrations'],
  },
  {
    heading: 'Company',
    links: ['About InterviewME', 'Careers', 'Partners', 'Contact'],
  },
  {
    heading: 'Resources',
    links: ['Hiring Guide', 'Whitepapers', 'API Docs', 'Webinars'],
  },
  {
    heading: 'Legal',
    links: ['GDPR Compliance', 'Security', 'Privacy Policy', 'Terms'],
  },
];

const HERO_FRAME_COUNT = 118;
const HERO_INITIAL_FRAME = Math.floor((HERO_FRAME_COUNT - 1) / 2);
const getHeroFrameSrc = (index) => '/landing-frames/frame_' + String(index).padStart(3, '0') + '.webp';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M5 3.5h7.5V11M12.1 3.9 3.5 12.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      d="M5.5 7V5.6A3.5 3.5 0 0 1 9 2.1a3.5 3.5 0 0 1 3.5 3.5V7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <rect x="4" y="7" width="10" height="8.5" rx="2.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    <circle cx="14" cy="14" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M3.8 14h20.4M14 3.5c2.9 2.7 4.3 6.2 4.3 10.5S16.9 21.8 14 24.5M14 3.5c-2.9 2.7-4.3 6.2-4.3 10.5S11.1 21.8 14 24.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);


const Landing = () => {
  const heroRef = useRef(null);
  const canvasRef = useRef(null);
  const frameImagesRef = useRef([]);
  const loadedFramesRef = useRef(new Set());
  const targetFrameRef = useRef(HERO_INITIAL_FRAME);
  const renderedFrameRef = useRef(-1);
  const renderFrameRef = useRef(null);
  const { openSignIn } = useClerk();

  const getRenderableFrame = useCallback((targetFrame) => {
    const loadedFrames = loadedFramesRef.current;

    if (loadedFrames.has(targetFrame)) return targetFrame;
    if (loadedFrames.has(renderedFrameRef.current)) return renderedFrameRef.current;
    if (loadedFrames.has(HERO_INITIAL_FRAME)) return HERO_INITIAL_FRAME;

    for (let offset = 1; offset < HERO_FRAME_COUNT; offset += 1) {
      const previousFrame = targetFrame - offset;
      const nextFrame = targetFrame + offset;

      if (previousFrame >= 0 && loadedFrames.has(previousFrame)) return previousFrame;
      if (nextFrame < HERO_FRAME_COUNT && loadedFrames.has(nextFrame)) return nextFrame;
    }

    return -1;
  }, []);

  const drawFrame = useCallback((frameIndex) => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    const image = frameImagesRef.current[frameIndex];

    if (!hero || !canvas || !image?.naturalWidth || !image?.naturalHeight) return false;

    const context = canvas.getContext('2d');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const heroRect = hero.getBoundingClientRect();
    const page = hero.closest('.rivr-page');
    const pageStyle = page ? window.getComputedStyle(page) : null;
    const fixedLeft = Number.parseFloat(pageStyle?.paddingLeft || '0') || 0;
    const fixedTop = Number.parseFloat(pageStyle?.paddingTop || '0') || 0;
    const width = Math.max(1, Math.round(hero.clientWidth));
    const height = Math.max(1, Math.round(hero.clientHeight));
    const canvasWidth = Math.round(width * ratio);
    const canvasHeight = Math.round(height * ratio);

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const scale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = ((canvasWidth - drawWidth) / 2) + ((fixedLeft - heroRect.left) * ratio);
    const drawY = ((canvasHeight - drawHeight) / 2) + ((fixedTop - heroRect.top) * ratio);

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    canvas.dataset.frame = String(frameIndex);
    canvas.dataset.loadedFrames = String(loadedFramesRef.current.size);

    return true;
  }, []);

  const requestDraw = useCallback(() => {
    if (renderFrameRef.current !== null) return;

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const frameIndex = getRenderableFrame(targetFrameRef.current);

      if (frameIndex >= 0 && drawFrame(frameIndex)) {
        renderedFrameRef.current = frameIndex;
      }
    });
  }, [drawFrame, getRenderableFrame]);

  const scrubFrame = useCallback((event) => {
    if (event.pointerType === 'touch') return;

    const hero = heroRef.current;
    if (!hero) return;

    const bounds = hero.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientY > bounds.bottom) return;

    const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    targetFrameRef.current = Math.round(progress * (HERO_FRAME_COUNT - 1));
    requestDraw();
  }, [requestDraw]);

  useEffect(() => {
    window.addEventListener('pointermove', scrubFrame, { passive: true });
    window.addEventListener('mousemove', scrubFrame, { passive: true });

    return () => {
      window.removeEventListener('pointermove', scrubFrame);
      window.removeEventListener('mousemove', scrubFrame);
    };
  }, [scrubFrame]);

  useEffect(() => {
    let isCancelled = false;

    const loadFrame = (frameIndex, priority = 'auto') => new Promise((resolve) => {
      const existingImage = frameImagesRef.current[frameIndex];
      if (existingImage?.complete && existingImage.naturalWidth) {
        loadedFramesRef.current.add(frameIndex);
        resolve();
        return;
      }

      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = priority;

      image.onload = () => {
        if (!isCancelled) {
          frameImagesRef.current[frameIndex] = image;
          loadedFramesRef.current.add(frameIndex);
          requestDraw();
        }
        resolve();
      };

      image.onerror = () => resolve();
      image.src = getHeroFrameSrc(frameIndex);
      frameImagesRef.current[frameIndex] = image;
    });

    const priorityFrames = [HERO_INITIAL_FRAME, 0, HERO_FRAME_COUNT - 1];
    priorityFrames.forEach((frameIndex) => loadFrame(frameIndex, 'high'));

    const loadRemainingFrames = () => {
      for (let frameIndex = 0; frameIndex < HERO_FRAME_COUNT; frameIndex += 1) {
        if (!priorityFrames.includes(frameIndex)) loadFrame(frameIndex);
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadRemainingFrames, { timeout: 600 });
    } else {
      window.setTimeout(loadRemainingFrames, 120);
    }

    const handleViewportChange = () => {
      renderedFrameRef.current = -1;
      requestDraw();
    };

    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(handleViewportChange) : null;
    if (heroRef.current && resizeObserver) resizeObserver.observe(heroRef.current);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, { passive: true });

    return () => {
      isCancelled = true;
      if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
    };
  }, [requestDraw]);

  return (
    <main className="rivr-page">
      <Navbar />

      <section
        ref={heroRef}
        className="hero-shell"
        id="platform"
        aria-labelledby="hero-title"
      >
        <div className="hero-scene" aria-hidden="true">
          <canvas ref={canvasRef} className="hero-canvas" />
        </div>
        <svg className="hero-corner-cut" viewBox="0 0 506 221" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 225V221C42 221 76 187 76 145C76 107 107 76 168 76H430C472 76 506 42 506 0H510V225H0Z" />
        </svg>
        <div className="hero-content">
          <h1 id="hero-title">Elevate Your Talent Acquisition</h1>
          <p>
            Seamless AI video interviews. Analyze soft skills, assess technical competence, and find top talent
            instantly.
          </p>
          <a className="primary-button" href="#demo">
            Start Free Trial
          </a>
        </div>

        <aside className="hero-mini-card hero-stat" aria-label="Monthly interview analysis">
          <strong>5.2K</strong>
          <span className="hero-stat-label">interviews analyzed this month</span>
          <span className="hero-stat-chip">
            <span aria-hidden="true" />
            Live insights
          </span>
        </aside>

        <aside className="hero-mini-card hero-docs" aria-label="Hiring guide">
          <span className="rivr-icon-pill">
            <ArrowIcon />
          </span>
          <div>
            <strong>Hiring Guide</strong>
            <span>Best Practices &gt;</span>
          </div>
        </aside>
      </section>

      <section className="metrics-row" aria-label="InterviewME platform metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </section>

      <section className="features-section" id="solutions" aria-labelledby="features-title">
        <div className="section-heading">
          <div>
            <h2 id="features-title">Architected for modern HR Teams</h2>
            <p>Fluid interview solutions. Analyze the future of hiring.</p>
          </div>
          <Show when="signed-out">
            <button className="outline-link" style={{margin: 0}} onClick={() => openSignIn({})}>Get Started</button>
          </Show>
          <Show when="signed-in">
            <a className="outline-link" style={{margin: 0}} href="#platform">Get Started</a>
          </Show>
        </div>

        <div className="features-grid">
          <article className="feature-card feature-large">
            <div className="feature-meta">
              <span>Deep Analytics</span>
              <span>Candidate Signal</span>
            </div>
            <img
              src="/undraw_analytics_6mru.svg"
              alt="Analytics illustration"
              className="feature-illustration-large"
            />
            <div>
              <h3>Identify hidden talent potential</h3>
              <p>
                Review recorded responses or yield insights without unending manual filtering. Gain data-driven
                decisions with immediate visibility into your candidate pipeline.
              </p>
            </div>
          </article>

          <article className="feature-card feature-wide">
            <span className="feature-timer">30"</span>
            <h3>Real-time AI Analysis</h3>
            <p>
              Track candidate performance in real-time as they answer. Your AI is always on, analyzing communication
              and problem-solving skills.
            </p>
            <img
              src="/undraw_instant-analysis_vm8x.svg"
              alt="Real-time analysis illustration"
              className="feature-illustration"
            />
          </article>

          <article className="feature-card feature-small">
            <div className="feature-meta">
              <span>ISO-Certified</span>
              <span className="tiny-icon">
                <LockIcon />
              </span>
            </div>
            <h3>Certified & Bias-Free</h3>
            <p>Our AI models are audited by leading firms, ensuring unbiased, fair hiring practices.</p>
            <a className="outline-link" href="#resources">
              View Audits &gt;
            </a>
            <img
              src="/undraw_certificate_cqps.svg"
              alt="Certificate illustration"
              className="feature-illustration-float"
            />
          </article>

          <article className="feature-card feature-small feature-centered">
            <div className="feature-meta">
              <span>Global Talent</span>
              <span>04"</span>
            </div>
            <img
              src="https://cdn.undraw.co/illustration/video-call_i5de.svg"
              alt="Video call illustration"
              className="feature-illustration-small"
            />
            <h3>Cross-Regional Support</h3>
            <p>
              Move your interview process across 12+ regions seamlessly. Ensure full compliance and opportunity alerts.
            </p>
          </article>
        </div>
      </section>

      <section className="cta-banner" id="demo" aria-labelledby="cta-title">
        <div className="molten-scene" aria-hidden="true">
          <div className="molten-sky" />
          <div className="molten-mountain mountain-back" />
          <div className="molten-mountain mountain-front" />
          <div className="molten-river" />
          <div className="molten-glow" />
        </div>
        <div className="cta-copy">
          <h2 id="cta-title">Standardize your video interviewing pipeline.</h2>
          <p>
            Join the recruitment ecosystem transforming capital efficiency and talent acquisition across all industries.
          </p>
        </div>
        <div className="cta-actions">
          <Show when="signed-out">
            <button className="light-button" onClick={() => openSignIn({})}>
              <span className="rivr-icon-pill">
                <ArrowIcon />
              </span>
              Launch Platform
            </button>
            <button className="dark-glass-button" onClick={() => openSignIn({})}>
              Read Documentation
            </button>
          </Show>
          <Show when="signed-in">
            <a className="light-button" href="#platform">
              <span className="rivr-icon-pill">
                <ArrowIcon />
              </span>
              Launch Platform
            </a>
            <a className="dark-glass-button" href="#resources">
              Read Documentation
            </a>
          </Show>
        </div>
      </section>

      <footer className="rivr-footer" id="resources">
        <div>
          <a className="footer-logo" href="/">
            InterviewME
          </a>
          <p>
            Transforming hiring through modern video analysis. Clean, compliant, and data-driven protocols.
          </p>
        </div>
        <div className="footer-links">
          {footerColumns.map((column) => (
            <div key={column.heading}>
              <h2>{column.heading}</h2>
              {column.links.map((link) => (
                <a key={link} href="#resources">
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
};

export default Landing;










