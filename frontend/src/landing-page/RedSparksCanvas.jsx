import React, { useEffect, useRef } from "react";

/**
 * High-performance ambient Red Sparks & Twinkling Stars canvas.
 * Renders glowing crimson, ruby, fire-amber, and starlight gold embers
 * that drift organically with sine-wave sway and respond softly to mouse movement.
 */
export default function RedSparksCanvas() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseTrailRef = useRef([]);
  const requestRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Radiant color palette: Electric crimson, fiery scarlet, ruby rose, and starlight gold
    const SPARK_COLORS = [
      "#ff1744", // Electric Crimson
      "#f43f5e", // Rose Ruby
      "#ff0055", // Vivid Pink-Red
      "#ff4d4d", // Fiery Scarlet
      "#ff7849", // Sunset Ember
      "#ffd700", // Gold Starlight
      "#ffffff", // Diamond Core
    ];

    // Seed initial ambient floating particles
    const PARTICLE_COUNT = 65;
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -(Math.random() * 0.65 + 0.25), // Floating upwards like fiery embers
      size: Math.random() * 2.8 + 1.2,
      color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      alpha: Math.random() * 0.75 + 0.25,
      pulseSpeed: Math.random() * 0.03 + 0.012,
      pulseVal: Math.random() * Math.PI * 2,
      isStar: Math.random() > 0.42, // 58% 4-point stars, 42% embers
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      swayOffset: Math.random() * 100,
      swaySpeed: Math.random() * 0.015 + 0.005,
    }));

    // Draw 4-point star sparkle
    const drawStar = (x, y, r, rotation, color, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = r * 3.5;

      ctx.beginPath();
      const rOuter = r;
      const rInner = r * 0.28;
      for (let j = 0; j < 8; j++) {
        const radius = j % 2 === 0 ? rOuter : rInner;
        const a = (j * Math.PI) / 4;
        const px = Math.cos(a) * radius;
        const py = Math.sin(a) * radius;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // White shimmering center for diamond intensity
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = Math.min(1, alpha * 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // Draw circular glowing ember with hot white core
    const drawEmber = (x, y, r, color, alpha) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = r * 4;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Hot white center core
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // 1. Render & update ambient rising sparks
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];

        // Horizontal sinusoidal sway
        p.x += p.vx + Math.sin(tick * p.swaySpeed + p.swayOffset) * 0.45;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.pulseVal += p.pulseSpeed;

        const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.pulseVal));

        if (p.isStar) {
          drawStar(p.x, p.y, p.size * 1.5, p.rotation, p.color, currentAlpha);
        } else {
          drawEmber(p.x, p.y, p.size, p.color, currentAlpha);
        }

        // Loop / wrap around viewport
        if (p.y < -20) {
          p.y = height + 15;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 15;
        if (p.x > width + 20) p.x = -15;
      }

      // 2. Render & update interactive mouse stardust trail
      for (let i = mouseTrailRef.current.length - 1; i >= 0; i--) {
        const t = mouseTrailRef.current[i];
        t.x += t.vx;
        t.y += t.vy;
        t.vx *= 0.94;
        t.vy *= 0.94;
        t.life++;
        t.rotation += t.rotSpeed;
        const trailAlpha = Math.max(0, 1 - t.life / t.maxLife);

        if (trailAlpha <= 0.01) {
          mouseTrailRef.current.splice(i, 1);
          continue;
        }

        if (t.isStar) {
          drawStar(t.x, t.y, t.size * 1.4, t.rotation, t.color, trailAlpha);
        } else {
          drawEmber(t.x, t.y, t.size, t.color, trailAlpha);
        }
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    // Mouse movement interaction: spawn delicate red & gold stardust trail
    const handleMouseMove = (e) => {
      if (Math.random() < 0.65) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.8 + 0.4;
        mouseTrailRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          size: Math.random() * 2.5 + 1.2,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          isStar: Math.random() > 0.45,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.1,
          life: 0,
          maxLife: Math.random() * 26 + 18,
        });
      }
    };

    // Click burst: energetic fountain of red & gold sparks
    const handleClick = (e) => {
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.8 + 1.2;
        mouseTrailRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.7,
          size: Math.random() * 3 + 1.4,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          isStar: Math.random() > 0.4,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.15,
          life: 0,
          maxLife: Math.random() * 36 + 24,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="red-sparks-canvas" aria-hidden="true" />;
}
