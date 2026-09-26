import React, { useEffect, useRef } from "react";

function JarvisVoiceOrb({ volume = 0, isPaused = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    // Handle high DPI screens
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particle system configuration
    const particles = [];
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        distance: 70 + Math.random() * 80,
        size: 1 + Math.random() * 2,
        speed: 0.005 + Math.random() * 0.01,
        radialOffset: Math.random() * Math.PI * 2,
      });
    }

    // Audio wave rings
    const waves = [];

    let rotationAngle1 = 0;
    let rotationAngle2 = 0;
    let pulseTime = 0;

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Smooth volume value for visual damping
      const dampedVolume = isPaused ? 0 : volume;
      const time = Date.now();

      // Update rotation speeds and times based on volume
      rotationAngle1 += 0.005 + dampedVolume * 0.03;
      rotationAngle2 -= 0.003 + dampedVolume * 0.02;
      pulseTime += 0.02 + dampedVolume * 0.1;

      // Draw background glow
      const bgGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
      bgGlow.addColorStop(0, `rgba(0, 242, 254, ${0.08 + dampedVolume * 0.12})`);
      bgGlow.addColorStop(0.5, `rgba(79, 172, 254, ${0.03 + dampedVolume * 0.05})`);
      bgGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // --- 1. CORE GLOWING ORB ---
      ctx.save();
      ctx.shadowBlur = 25 + dampedVolume * 30;
      ctx.shadowColor = "rgba(0, 242, 254, 0.8)";
      
      const coreRadius = 45 + Math.sin(pulseTime) * 3 + dampedVolume * 22;
      const coreGlow = ctx.createRadialGradient(
        cx - coreRadius * 0.2,
        cy - coreRadius * 0.2,
        0,
        cx,
        cy,
        coreRadius
      );
      coreGlow.addColorStop(0, "rgba(255, 255, 255, 1)");
      coreGlow.addColorStop(0.2, "rgba(0, 242, 254, 0.95)");
      coreGlow.addColorStop(0.7, "rgba(79, 172, 254, 0.6)");
      coreGlow.addColorStop(1, "rgba(0, 76, 254, 0.1)");
      
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- 2. AUDIO SPECTRAL CIRCULAR EQUALIZER (NCS style) ---
      const totalBars = 72;
      const innerRadius = coreRadius + 15;
      ctx.save();
      for (let i = 0; i < totalBars; i++) {
        const angle = (i / totalBars) * Math.PI * 2 + rotationAngle1 * 0.1;
        // Generate pseudo frequency spectrum peaks using sine waves & noise
        const frequencyScale = Math.sin(i * 0.3) * Math.cos(i * 0.7) * 0.5 + 0.5;
        const barHeight = dampedVolume * 50 * frequencyScale + (dampedVolume > 0.05 ? Math.random() * 8 : 1);
        
        const startX = cx + Math.cos(angle) * innerRadius;
        const startY = cy + Math.sin(angle) * innerRadius;
        const endX = cx + Math.cos(angle) * (innerRadius + barHeight);
        const endY = cy + Math.sin(angle) * (innerRadius + barHeight);

        // Gradient line for each spectrum bar
        const barGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        barGrad.addColorStop(0, "rgba(0, 242, 254, 0.8)");
        barGrad.addColorStop(0.5, "rgba(0, 242, 254, 0.5)");
        barGrad.addColorStop(1, "rgba(79, 172, 254, 0.0)");

        ctx.strokeStyle = barGrad;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.restore();

      // --- 3. CONCENTRIC JARVIS HUD RINGS ---
      // Inner rotating HUD ring (dashed)
      ctx.save();
      ctx.strokeStyle = "rgba(0, 242, 254, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(0, 242, 254, 0.4)";
      ctx.setLineDash([12, 18, 4, 18]);
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius + 22, rotationAngle1, rotationAngle1 + Math.PI * 2);
      ctx.stroke();

      // Outer rotating HUD ring (fine details)
      ctx.strokeStyle = "rgba(79, 172, 254, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([60, 10, 5, 10, 5, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius + 45, rotationAngle2, rotationAngle2 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // --- 4. FLOATING PARTICLES ---
      ctx.save();
      particles.forEach((p) => {
        // Orbit rotation
        p.angle += p.speed * (1 + dampedVolume * 3);
        
        // Radial breathing / vibration based on volume
        const radialVibe = Math.sin(time * 0.05 + p.radialOffset) * (8 + dampedVolume * 30);
        const dist = p.distance + radialVibe;

        const px = cx + Math.cos(p.angle) * dist;
        const py = cy + Math.sin(p.angle) * dist;

        ctx.fillStyle = `rgba(0, 242, 254, ${0.35 + dampedVolume * 0.6})`;
        ctx.shadowBlur = 4 + dampedVolume * 8;
        ctx.shadowColor = "rgba(0, 242, 254, 0.5)";
        
        ctx.beginPath();
        ctx.arc(px, py, p.size + dampedVolume * 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // --- 5. AUDIO IMPULSE RINGS (NCS Ripples) ---
      // Periodically spawn a wave ripple on audio peak
      if (dampedVolume > 0.35 && (waves.length === 0 || time - waves[waves.length - 1].spawnTime > 250)) {
        waves.push({
          radius: innerRadius,
          maxRadius: innerRadius + 120 + dampedVolume * 80,
          opacity: 0.8,
          spawnTime: time
        });
      }

      // Render & update waves
      ctx.save();
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        // Calculate progress (0 to 1)
        const progress = (w.radius - innerRadius) / (w.maxRadius - innerRadius);
        w.radius += 2.5 + (1 - progress) * 4; // slow down slightly as it expands
        w.opacity = 0.8 * (1 - progress);

        if (progress >= 1) {
          waves.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(0, 242, 254, ${w.opacity})`;
        ctx.lineWidth = 1.5 * (1 - progress);
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(0, 242, 254, 0.3)";
        ctx.beginPath();
        ctx.arc(cx, cy, w.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [volume, isPaused]);

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[350px] bg-[#0c0d12]/40 rounded-[2.5rem] border border-neutral-800/40 shadow-inner overflow-hidden">
      {/* Background Jarvis HUD Circular Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,18,36,0.3)_0%,rgba(0,0,0,0.8)_100%)] z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-15 pointer-events-none z-0" />

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full min-h-[350px] z-10"
      />
    </div>
  );
}

export default JarvisVoiceOrb;
