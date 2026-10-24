import React, { useState, useEffect, useRef } from "react";
import "./MagicPage.css";

// Synthesize pleasant celestial bell chimes using Web Audio API
function playMagicChime(frequency = 587.33, isMuted = false) {
  if (isMuted) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic Fundamental
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(frequency, now);
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.2);

    // Ethereal Upper Shimmer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(frequency * 2, now);
    gain2.gain.setValueAtTime(0.07, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.85);
  } catch (err) {
    // Autoplay policy or no audio device fallback
  }
}

export default function MagicPage({ onReturnHome, onNavigateModule }) {
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isClicking, setIsClicking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // 3D Parallax Tilt Offsets for Box 1 & Box 2
  const [tilt1, setTilt1] = useState({ rx: 0, ry: 0 });
  const [tilt2, setTilt2] = useState({ rx: 0, ry: 0 });

  const [hoveredBox, setHoveredBox] = useState(null); // "box1" | "box2" | null

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const box1Ref = useRef(null);
  const box2Ref = useRef(null);
  const requestRef = useRef(null);

  // Magical particle colors
  const MAGIC_PALETTE = [
    "#00e5ff", // Cyan
    "#ffb703", // Radiant Gold
    "#d946ef", // Electric Magenta
    "#38bdf8", // Sky Blue
    "#ffe066", // Starlight Amber
    "#ffffff", // Diamond White
  ];

  // Helper to spawn stardust
  const spawnParticles = (x, y, count = 2, explosion = false) => {
    for (let i = 0; i < count; i++) {
      const angle = explosion ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * Math.PI;
      const speed = explosion ? Math.random() * 5 + 2 : Math.random() * 1.5 + 0.4;
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (explosion ? 0 : 0.4), // slight gravity
        size: Math.random() * (explosion ? 4.5 : 3) + 1.5,
        color: MAGIC_PALETTE[Math.floor(Math.random() * MAGIC_PALETTE.length)],
        alpha: 1,
        life: 0,
        maxLife: explosion ? Math.random() * 45 + 30 : Math.random() * 30 + 20,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
      });
    }
  };

  // Canvas particle loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life++;
        p.rotation += p.rotSpeed;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        if (p.alpha <= 0.01) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;

        // Draw 4-point sparkle star
        ctx.beginPath();
        const rOuter = p.size;
        const rInner = p.size * 0.3;
        for (let j = 0; j < 8; j++) {
          const r = j % 2 === 0 ? rOuter : rInner;
          const a = (j * Math.PI) / 4;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Mouse movement & 3D tilt calculations
  const handleMouseMove = (e) => {
    const x = e.clientX;
    const y = e.clientY;
    setCursorPos({ x, y });

    // Spawn subtle stardust trail from the magic wand tip
    spawnParticles(x, y, 2, false);

    // Box 1 3D Parallax Tilt
    if (box1Ref.current) {
      const rect = box1Ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (x - centerX) / (rect.width * 0.8);
      const dy = (y - centerY) / (rect.height * 0.8);
      // Clamp tilt to graceful bounds
      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));
      setTilt1({
        rx: -clampedY * 16,
        ry: clampedX * 16,
      });
    }

    // Box 2 3D Parallax Tilt
    if (box2Ref.current) {
      const rect = box2Ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (x - centerX) / (rect.width * 0.8);
      const dy = (y - centerY) / (rect.height * 0.8);
      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));
      setTilt2({
        rx: -clampedY * 16,
        ry: clampedX * 16,
      });
    }
  };

  const handleMouseDown = (e) => {
    setIsClicking(true);
    // Burst of magical sparkles on click
    spawnParticles(e.clientX, e.clientY, 28, true);
    playMagicChime(784, isMuted); // G5 note
  };

  const handleMouseUp = () => {
    setIsClicking(false);
  };

  const handleOpenViksitAndhra = (e) => {
    if (e) e.stopPropagation();
    spawnParticles(cursorPos.x, cursorPos.y, 45, true);
    playMagicChime(880, isMuted); // A5 chime
    setTimeout(() => {
      window.open("https://viksitandhra.vercel.app/", "_blank", "noopener,noreferrer");
    }, 280);
  };

  const handleOpenViksitBharat = (e) => {
    if (e) e.stopPropagation();
    spawnParticles(cursorPos.x, cursorPos.y, 45, true);
    playMagicChime(784, isMuted); // G5 chime
    setTimeout(() => {
      window.open("https://viksitbharat-one.vercel.app/", "_blank", "noopener,noreferrer");
    }, 280);
  };

  return (
    <div
      className="magic-realm-container clean-magic-view"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Particle Canvas for Stardust Trail */}
      <canvas ref={canvasRef} className="magic-particle-canvas" />

      {/* Custom Magic Wand Cursor */}
      <div
        className={`magic-wand-cursor ${isClicking ? "clicking" : ""}`}
        style={{
          left: `${cursorPos.x - 36}px`,
          top: `${cursorPos.y - 14}px`,
        }}
      >
        <div className="wand-tip-flare" />
        <svg
          width="50"
          height="50"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="wandShaftGrad" x1="10" y1="42" x2="36" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e0b36" />
              <stop offset="25%" stopColor="#581c87" />
              <stop offset="55%" stopColor="#d946ef" />
              <stop offset="85%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id="wandGoldGrip" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffe066" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <filter id="wandSparkleGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Wand Shaft */}
          <line
            x1="8"
            y1="44"
            x2="36"
            y2="14"
            stroke="url(#wandShaftGrad)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Inner Highlight Line */}
          <line
            x1="8"
            y1="44"
            x2="36"
            y2="14"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeOpacity="0.8"
            strokeLinecap="round"
          />

          {/* Golden Rings */}
          <circle cx="12" cy="40" r="3" fill="url(#wandGoldGrip)" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="18" cy="33" r="2.5" fill="url(#wandGoldGrip)" />
          <circle cx="28" cy="23" r="2.2" fill="url(#wandGoldGrip)" />

          {/* Glowing Crystal Star at Tip */}
          <g filter="url(#wandSparkleGlow)">
            <polygon
              points="36,4 38.5,11.5 46,14 38.5,16.5 36,24 33.5,16.5 26,14 33.5,11.5"
              fill="#00e5ff"
            />
            <polygon
              points="36,7 37.8,12 43,14 37.8,16 36,21 34.2,16 29,14 34.2,12"
              fill="#ffffff"
            />
            <circle cx="36" cy="14" r="2" fill="#ffe066" />
          </g>
        </svg>
      </div>

      {/* Minimal text-free icon button to return home */}
      <button
        className="magic-minimal-back-btn"
        onClick={() => {
          playMagicChime(523.25, isMuted);
          onReturnHome();
        }}
        title="Return"
        aria-label="Return"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      {/* Ambient Visual Atmospherics */}
      <div className="magic-ambient-aurora" />
      <div className="magic-runes-grid" />

      {/* 3D Magic Stage: ONLY THE 2 BOXES, NO TEXT */}
      <main className="magic-boxes-stage clean-boxes-stage">
        {/* ========================================================
            MAGIC BOX 1: VIKSIT ANDHRA (AUTOMATIC REDIRECT)
            ======================================================== */}
        <div
          ref={box1Ref}
          className="magic-box-3d-scene"
          onMouseEnter={() => {
            setHoveredBox("box1");
            playMagicChime(659.25, isMuted);
          }}
          onMouseLeave={() => setHoveredBox(null)}
          onClick={handleOpenViksitAndhra}
          role="button"
          tabIndex={0}
          title="VIKSIT ANDHRA | Swarna Andhra 2047"
          aria-label="VIKSIT ANDHRA | Swarna Andhra 2047"
        >
          <div
            className="magic-box-card box-viksit clean-box-card"
            style={{
              transform: `rotateX(${tilt1.rx + (hoveredBox === "box1" ? -6 : 0)}deg) rotateY(${tilt1.ry + (hoveredBox === "box1" ? 5 : 0)}deg) translateZ(${hoveredBox === "box1" ? 50 : 0}px)`,
            }}
          >
            {/* Open Magic Box Graphic matching the User's Drawing */}
            <div className="magic-open-box-stage">
              <div className="box-energy-pillar" />
              <div className="magic-open-box-visual">
                <img
                  src="/magic_box_open_transparent.png"
                  alt="VIKSIT ANDHRA Magic Box"
                  className="magic-box-img-asset"
                />

                {/* Floating Burst Stars & Gems matching drawing */}
                <div className="box-burst-fx-wrap">
                  {/* Big Center Cyan Star */}
                  <div className="burst-star burst-star-center">
                    <svg viewBox="0 0 40 40" width="46" height="46">
                      <polygon
                        points="20,2 24.5,14 38,15 27,24 31,37 20,29 9,37 13,24 2,15 15.5,14"
                        fill="#00e5ff"
                        stroke="#110524"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Left Magenta Star */}
                  <div className="burst-star burst-star-left">
                    <svg viewBox="0 0 32 32" width="34" height="34">
                      <polygon
                        points="16,2 19.5,11 29,12 21.5,19 24.5,29 16,23 7.5,29 10.5,19 3,12 12.5,11"
                        fill="#f43f5e"
                        stroke="#110524"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Right Pink Star */}
                  <div className="burst-star burst-star-right">
                    <svg viewBox="0 0 32 32" width="34" height="34">
                      <polygon
                        points="16,2 19.5,11 29,12 21.5,19 24.5,29 16,23 7.5,29 10.5,19 3,12 12.5,11"
                        fill="#ec4899"
                        stroke="#110524"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Floating Gems & Speed Ray Lines */}
                  <div className="burst-gem" style={{ top: "34px", left: "74px" }} />
                  <div className="burst-gem burst-gem-cyan" style={{ top: "42px", left: "54px" }} />
                  <div className="burst-gem" style={{ top: "44px", right: "72px" }} />
                  <div className="burst-gem burst-gem-cyan" style={{ top: "34px", right: "54px" }} />
                  <div className="burst-ray-line ray-top" />
                  <div className="burst-ray-line ray-left" />
                  <div className="burst-ray-line ray-right" />
                </div>
              </div>
            </div>

            {/* Subtle Ethereal Title on Hover */}
            <div className="magic-box-hover-title">
              <span className="hover-title-main">VIKSIT ANDHRA</span>
              <span className="hover-title-sub">Swarna Andhra 2047</span>
            </div>
          </div>
        </div>

        {/* ========================================================
            MAGIC BOX 2: VIKSIT BHARAT @ 2047 | The Sovereign Blueprint
            ======================================================== */}
        <div
          ref={box2Ref}
          className="magic-box-3d-scene"
          onMouseEnter={() => {
            setHoveredBox("box2");
            playMagicChime(880, isMuted);
          }}
          onMouseLeave={() => setHoveredBox(null)}
          onClick={handleOpenViksitBharat}
          role="button"
          tabIndex={0}
          title="VIKSIT BHARAT @ 2047 | The Sovereign Blueprint"
          aria-label="VIKSIT BHARAT @ 2047 | The Sovereign Blueprint"
        >
          <div
            className="magic-box-card box-viksit-bharat clean-box-card"
            style={{
              transform: `rotateX(${tilt2.rx + (hoveredBox === "box2" ? -6 : 0)}deg) rotateY(${tilt2.ry + (hoveredBox === "box2" ? -5 : 0)}deg) translateZ(${hoveredBox === "box2" ? 50 : 0}px)`,
            }}
          >
            {/* Open Magic Box Graphic matching the User's Drawing */}
            <div className="magic-open-box-stage">
              <div
                className="box-energy-pillar sovereign-energy-pillar"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 100%, rgba(255, 153, 51, 0.45), rgba(0, 229, 255, 0.3) 45%, rgba(16, 185, 129, 0.25) 70%, transparent 85%)",
                }}
              />
              <div className="magic-open-box-visual">
                <img
                  src="/magic_box_open_transparent.png"
                  alt="VIKSIT BHARAT @ 2047 | The Sovereign Blueprint"
                  className="magic-box-img-asset"
                />

                {/* Floating Burst Stars & Gems matching drawing */}
                <div className="box-burst-fx-wrap">
                  {/* Big Center Radiant Saffron Star */}
                  <div className="burst-star burst-star-center">
                    <svg viewBox="0 0 40 40" width="46" height="46">
                      <polygon
                        points="20,2 24.5,14 38,15 27,24 31,37 20,29 9,37 13,24 2,15 15.5,14"
                        fill="#ff9933"
                        stroke="#110524"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Left Ashoka Chakra Cyan Star */}
                  <div className="burst-star burst-star-left">
                    <svg viewBox="0 0 32 32" width="34" height="34">
                      <polygon
                        points="16,2 19.5,11 29,12 21.5,19 24.5,29 16,23 7.5,29 10.5,19 3,12 12.5,11"
                        fill="#00e5ff"
                        stroke="#110524"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Right Emerald Green Star */}
                  <div className="burst-star burst-star-right">
                    <svg viewBox="0 0 32 32" width="34" height="34">
                      <polygon
                        points="16,2 19.5,11 29,12 21.5,19 24.5,29 16,23 7.5,29 10.5,19 3,12 12.5,11"
                        fill="#10b981"
                        stroke="#110524"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Floating Gems & Speed Ray Lines */}
                  <div className="burst-gem burst-gem-saffron" style={{ top: "34px", left: "74px" }} />
                  <div className="burst-gem burst-gem-cyan" style={{ top: "42px", left: "54px" }} />
                  <div className="burst-gem burst-gem-green" style={{ top: "44px", right: "72px" }} />
                  <div className="burst-gem burst-gem-cyan" style={{ top: "34px", right: "54px" }} />
                  <div className="burst-ray-line ray-top" />
                  <div className="burst-ray-line ray-left" />
                  <div className="burst-ray-line ray-right" />
                </div>
              </div>
            </div>

            {/* Subtle Ethereal Title on Hover */}
            <div className="magic-box-hover-title">
              <span className="hover-title-main">VIKSIT BHARAT @ 2047</span>
              <span className="hover-title-sub">The Sovereign Blueprint</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
