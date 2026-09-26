import React, { useEffect, useRef, useCallback } from "react";

/**
 * VoiceOrb — A premium, ChatGPT-Advanced-Voice-inspired audio visualizer.
 *
 * Features:
 *  1. Central morphing blob orb with aurora gradient fills
 *  2. Layered glow halos that breathe with volume
 *  3. Orbital particle ring that accelerates with volume
 *  4. Smooth ripple waves on audio peaks
 *  5. Bright, light background — no dark/black
 *
 * Props:
 *  - volume  (0–1)  real-time audio amplitude
 *  - isPaused        dims + slows everything
 */

// ── colour palette ──
const PALETTE = {
  // aurora gradient stops (orb surface)
  auroraStart: [124, 58, 237],   // violet-600
  auroraMid:   [99, 102, 241],   // indigo-500
  auroraEnd:   [59, 130, 246],   // blue-500
  accent:      [236, 72, 153],   // pink-500
  glow:        [139, 92, 246],   // violet-400
  particle:    [167, 139, 250],  // violet-300
};

function lerpColor(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function VoiceOrb({ volume = 0, isPaused = false }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    // smoothed values
    smoothVol: 0,
    phase: 0,
    particles: [],
    waves: [],
    rotation: 0,
  });

  // ── initialise particles once ──
  const initParticles = useCallback((count = 60) => {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        angle: (Math.PI * 2 * i) / count + Math.random() * 0.3,
        dist: 0.62 + Math.random() * 0.22,   // fraction of canvas radius
        size: 1.2 + Math.random() * 2,
        speed: 0.002 + Math.random() * 0.004,
        hueShift: Math.random(),
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let rafId;

    const state = stateRef.current;
    if (state.particles.length === 0) {
      state.particles = initParticles();
    }

    // ── resize handler ──
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── main draw loop ──
    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const minDim = Math.min(w, h);

      // Smooth volume with exponential decay
      const targetVol = isPaused ? 0 : volume;
      state.smoothVol += (targetVol - state.smoothVol) * 0.12;
      const sv = state.smoothVol;

      state.phase += 0.008 + sv * 0.04;
      state.rotation += 0.003 + sv * 0.012;
      const t = state.phase;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // ═══════════════════════════════════════
      // 1) AMBIENT BACKGROUND GLOW
      // ═══════════════════════════════════════
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.55);
      bgGlow.addColorStop(0, rgba(PALETTE.glow, 0.08 + sv * 0.1));
      bgGlow.addColorStop(0.5, rgba(PALETTE.auroraMid, 0.04 + sv * 0.05));
      bgGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // ═══════════════════════════════════════
      // 2) OUTER HALO RINGS (breath effect)
      // ═══════════════════════════════════════
      for (let ring = 3; ring >= 1; ring--) {
        const baseR = minDim * (0.16 + ring * 0.07);
        const breathe = Math.sin(t * 0.7 + ring) * (4 + sv * 10);
        const r = baseR + breathe + sv * 12;
        const alpha = (0.04 + sv * 0.06) / ring;

        const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r);
        const c = lerpColor(PALETTE.auroraStart, PALETTE.auroraEnd, ring / 3);
        haloGrad.addColorStop(0, rgba(c, 0));
        haloGrad.addColorStop(0.6, rgba(c, alpha));
        haloGrad.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ═══════════════════════════════════════
      // 3) CENTRAL MORPHING BLOB ORB
      // ═══════════════════════════════════════
      const baseOrbR = minDim * 0.14;
      const orbR = baseOrbR + sv * minDim * 0.06;
      const points = 180;

      // Build blob path
      ctx.save();
      ctx.translate(cx, cy);

      // Draw multiple layered blobs for depth
      for (let layer = 2; layer >= 0; layer--) {
        const layerScale = 1 + layer * 0.12;
        const layerAlpha = layer === 0 ? 1 : 0.15 - layer * 0.04;

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;

          // Multiple octaves of deformation for organic feel
          const deform1 = Math.sin(angle * 3 + t * 1.2) * (3 + sv * 18);
          const deform2 = Math.sin(angle * 5 - t * 0.8) * (2 + sv * 10);
          const deform3 = Math.sin(angle * 7 + t * 2.1) * (1 + sv * 6);
          const deform4 = Math.cos(angle * 2 - t * 1.5) * (2 + sv * 8);

          const r = orbR * layerScale + deform1 + deform2 + deform3 + deform4;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (layer === 0) {
          // Main orb — aurora gradient fill
          const orbGrad = ctx.createLinearGradient(
            -orbR, -orbR, orbR, orbR
          );
          // Shift gradient based on time for swirling aurora effect
          const shift = (Math.sin(t * 0.3) + 1) / 2;
          const c1 = lerpColor(PALETTE.auroraStart, PALETTE.accent, shift * 0.6);
          const c2 = PALETTE.auroraMid;
          const c3 = lerpColor(PALETTE.auroraEnd, PALETTE.auroraStart, shift * 0.4);

          orbGrad.addColorStop(0, rgba(c1, 0.95));
          orbGrad.addColorStop(0.4, rgba(c2, 0.9));
          orbGrad.addColorStop(0.7, rgba(c3, 0.85));
          orbGrad.addColorStop(1, rgba(PALETTE.accent, 0.7 + sv * 0.2));

          ctx.fillStyle = orbGrad;
          ctx.shadowBlur = 40 + sv * 50;
          ctx.shadowColor = rgba(PALETTE.glow, 0.5 + sv * 0.4);
          ctx.fill();

          // Inner specular highlight
          const specGrad = ctx.createRadialGradient(
            -orbR * 0.3, -orbR * 0.35, 0,
            0, 0, orbR * 0.9
          );
          specGrad.addColorStop(0, "rgba(255,255,255,0.45)");
          specGrad.addColorStop(0.3, "rgba(255,255,255,0.08)");
          specGrad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = specGrad;
          ctx.fill();
        } else {
          // Outer glow layers
          ctx.fillStyle = rgba(
            lerpColor(PALETTE.glow, PALETTE.auroraEnd, layer / 2),
            layerAlpha + sv * 0.05
          );
          ctx.shadowBlur = 20 + layer * 15;
          ctx.shadowColor = rgba(PALETTE.glow, 0.2);
          ctx.fill();
        }
      }

      ctx.restore();

      // ═══════════════════════════════════════
      // 4) CIRCULAR WAVEFORM RING
      // ═══════════════════════════════════════
      if (sv > 0.01) {
        const waveRingR = orbR + 28 + sv * 15;
        const bars = 90;
        ctx.save();

        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2 + state.rotation;

          // Simulate frequency spectrum
          const freq1 = Math.sin(i * 0.4 + t * 1.8) * 0.5 + 0.5;
          const freq2 = Math.cos(i * 0.25 - t * 1.2) * 0.3 + 0.5;
          const combined = (freq1 * 0.6 + freq2 * 0.4);
          const barH = sv * 35 * combined + (sv > 0.05 ? Math.random() * 4 * sv : 0);

          const x1 = cx + Math.cos(angle) * waveRingR;
          const y1 = cy + Math.sin(angle) * waveRingR;
          const x2 = cx + Math.cos(angle) * (waveRingR + barH);
          const y2 = cy + Math.sin(angle) * (waveRingR + barH);

          // Color based on position in ring
          const hue = (i / bars);
          const barColor = lerpColor(PALETTE.auroraStart, PALETTE.auroraEnd, hue);

          ctx.strokeStyle = rgba(barColor, 0.3 + sv * 0.5);
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ═══════════════════════════════════════
      // 5) ORBITAL PARTICLES
      // ═══════════════════════════════════════
      ctx.save();
      const now = Date.now();
      state.particles.forEach((p) => {
        p.angle += p.speed * (1 + sv * 5);

        const breathDist = Math.sin(now * 0.001 + p.hueShift * 10) * (5 + sv * 20);
        const dist = p.dist * minDim * 0.5 + breathDist;

        const px = cx + Math.cos(p.angle) * dist;
        const py = cy + Math.sin(p.angle) * dist;

        const particleColor = lerpColor(
          PALETTE.particle,
          PALETTE.accent,
          p.hueShift
        );

        const size = p.size + sv * 2.5;
        const alpha = 0.25 + sv * 0.55;

        // Glow dot
        ctx.shadowBlur = 6 + sv * 10;
        ctx.shadowColor = rgba(particleColor, 0.4);
        ctx.fillStyle = rgba(particleColor, alpha);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // ═══════════════════════════════════════
      // 6) RIPPLE WAVES ON PEAKS
      // ═══════════════════════════════════════
      // Spawn ripple on volume peaks
      if (sv > 0.3 && (state.waves.length === 0 || now - state.waves[state.waves.length - 1].born > 300)) {
        state.waves.push({
          r: orbR + 10,
          maxR: orbR + 100 + sv * 80,
          born: now,
        });
      }
      // Cap waves
      if (state.waves.length > 6) state.waves.shift();

      ctx.save();
      for (let i = state.waves.length - 1; i >= 0; i--) {
        const wave = state.waves[i];
        const progress = (wave.r - (orbR + 10)) / (wave.maxR - (orbR + 10));
        wave.r += 2 + (1 - progress) * 3;

        if (progress >= 1) {
          state.waves.splice(i, 1);
          continue;
        }

        const alpha = 0.35 * (1 - progress);
        const wColor = lerpColor(PALETTE.auroraStart, PALETTE.auroraEnd, progress);
        ctx.strokeStyle = rgba(wColor, alpha);
        ctx.lineWidth = 1.8 * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, wave.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ═══════════════════════════════════════
      // 7) SUBTLE CENTER CORE DOT
      // ═══════════════════════════════════════
      const dotR = 4 + sv * 3;
      const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR);
      dotGrad.addColorStop(0, "rgba(255,255,255,0.9)");
      dotGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [volume, isPaused, initParticles]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 200,
        borderRadius: "2.5rem",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 30%, #e0e7ff 60%, #f0f4ff 100%)",
        border: "1px solid rgba(196, 181, 253, 0.35)",
        boxShadow: "0 12px 48px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      {/* Subtle mesh / noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 30% 20%, rgba(167,139,250,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.08) 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 200,
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

export default VoiceOrb;
