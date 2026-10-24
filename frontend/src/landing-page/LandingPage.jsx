import { useState } from "react";
import { LEADERS } from "./leadersData";
import { SPEAKERS } from "./speakersData";
import { AWARENESS_SECTIONS } from "./awarenessData";
import RedSparksCanvas from "./RedSparksCanvas";

export default function LandingPage({ onSelectPage, activePage = "landing" }) {
  const [activeComic, setActiveComic] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  const leftSpeakers = SPEAKERS.filter((s, idx) => (s.side ? s.side === "left" : idx % 2 === 0));
  const rightSpeakers = SPEAKERS.filter((s, idx) => (s.side ? s.side === "right" : idx % 2 === 1));

  return (
    <div className="landing-plain-screen">
      {/* High-Performance Red Sparks & Starlight Particle System */}
      <RedSparksCanvas />

      {/* Reserved Top Margin / Slot for Upcoming Title */}
      <div className="landing-top-title-slot" aria-label="Reserved Title Area"></div>

      {/* Top Dignitaries in Circular Gold Frames */}
      <header className="landing-leaders-header">
        <div className="leaders-kicker">
          <span className="kicker-line"></span>
          <span className="kicker-text">✦ HON'BLE PATRONS & LEADERSHIP ✦</span>
          <span className="kicker-line"></span>
        </div>
        <div className="leaders-grid">
          {LEADERS.map((leader, i) => (
            <div key={i} className="leader-card">
              <div className="circle-gold-frame-wrap">
                <div className="circle-gold-frame">
                  <img
                    src={leader.image}
                    alt={leader.name}
                    className="leader-avatar-img"
                  />
                </div>
              </div>
              <div className="leader-info">
                <h3 className="leader-name">{leader.name}</h3>
                <p className="leader-position">{leader.position}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main Stage Flanked by Speakers of the Day on Sides */}
      <div className="landing-stage-wrapper">
        {/* Left Side: Speakers */}
        <aside className="landing-side-speakers landing-side-left">
          <div className="side-speakers-header">
            <span className="side-badge">✦ HONORABLE SPEAKERS ✦</span>
          </div>
          <div className="side-speakers-list">
            {leftSpeakers.map((sp, idx) => (
              <div key={idx} className="side-speaker-card">
                <div className="side-gold-frame-wrap">
                  <div className="side-gold-frame">
                    <img src={sp.image} alt={sp.name} className="side-speaker-img" />
                  </div>
                </div>
                <div className="side-speaker-info">
                  <span className="side-speaker-role-tag">HON'BLE SPEAKER</span>
                  <h4 className="side-speaker-name">{sp.name}</h4>
                  <p className="side-speaker-pos">{sp.position}</p>
                  <span className="side-speaker-org">{sp.org}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Main Stage Content */}
        <div className="landing-stage-center">
          {/* Main Centerpiece Logo: Fusion AI Summit */}
          <div className="landing-plain-center">
            <div className="main-logo-container">
              <div className="plain-ambient-glow"></div>
              <img
                src="/fusion_ai_summit_logo.png"
                alt="Fusion AI Summit - Bridging AI with the Future"
                className="main-hero-logo"
              />
            </div>
          </div>

          {/* Cinematic Transparent PNG Title Banner - Clickable Magic Portal */}
          <section className="cinematic-title-section">
            <div
              className="cinematic-title-container cinematic-title-interactive"
              onClick={() => onSelectPage("magic")}
              title="Click to enter the Magic Realm of Responsible AI"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectPage("magic");
                }
              }}
            >
              <img
                src="/use_ai_responsibly_cinematic.png"
                alt="Use AI Responsibly"
                className="cinematic-title-png"
              />
              <p className="cinematic-subtitle">
                EMPOWER SOCIETY · DEFEND TRUTH · PREVENT HARM
              </p>
              <div className="magic-portal-teaser-pill">
                <span className="teaser-sparkle">✨</span>
                <span>CLICK TO ENTER MAGIC REALM</span>
                <span className="teaser-sparkle">✨</span>
              </div>
            </div>
          </section>

          {/* 4 Comic Art Awareness Sections */}
          <section className="awareness-comics-section">
            <div className="comics-grid">
              {AWARENESS_SECTIONS.map((item) => {
                const isExpanded = !!expandedCards[item.id];
                return (
                  <article key={item.id} className="comic-card">
                    <div
                      className="comic-img-wrapper"
                      onClick={() => {
                        setActiveComic(item);
                        setExpandedCards((prev) => ({ ...prev, [item.id]: true }));
                      }}
                      title="Click image to view points & enlarge panel"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveComic(item);
                          setExpandedCards((prev) => ({ ...prev, [item.id]: true }));
                        }
                      }}
                    >
                      <img src={item.image} alt={item.title} className="comic-art-img" />
                      <span className="comic-zoom-pill">🔍 Click to View Points & Enlarge</span>
                    </div>
                    <div className="comic-card-body">
                      <div className="comic-card-top">
                        <span className={`tech-badge ${item.badgeColor}`}>{item.badge}</span>
                      </div>
                      <h3 className="comic-card-title">{item.title}</h3>
                      <p className="comic-tagline">{item.tagline}</p>

                      <button
                        type="button"
                        className="comic-toggle-points-btn"
                        onClick={() => {
                          setExpandedCards((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        aria-expanded={isExpanded}
                      >
                        <span>{isExpanded ? "▲ Hide Key Points" : "▼ View Key Takeaways & Points"}</span>
                      </button>

                      {isExpanded && (
                        <div className="comic-points-collapsible">
                          <ul className="comic-bullet-list">
                            {item.bullets.map((b, idx) => (
                              <li key={idx}>
                                <span className="bullet-dot">✦</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="comic-tip-box">
                            <strong>Action Tip:</strong> {item.actionTip}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Side: Speakers */}
        <aside className="landing-side-speakers landing-side-right">
          <div className="side-speakers-header">
            <span className="side-badge">✦ INDUSTRY & TECH LEADERS ✦</span>
          </div>
          <div className="side-speakers-list">
            {rightSpeakers.map((sp, idx) => (
              <div key={idx} className="side-speaker-card">
                <div className="side-gold-frame-wrap">
                  <div className="side-gold-frame">
                    <img src={sp.image} alt={sp.name} className="side-speaker-img" />
                  </div>
                </div>
                <div className="side-speaker-info">
                  <span className="side-speaker-role-tag">HON'BLE SPEAKER</span>
                  <h4 className="side-speaker-name">{sp.name}</h4>
                  <p className="side-speaker-pos">{sp.position}</p>
                  <span className="side-speaker-org">{sp.org}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Lightbox Modal for Comic Artwork & Points */}
      {activeComic && (
        <div className="comic-modal-overlay" onClick={() => setActiveComic(null)}>
          <div className="comic-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="comic-modal-close"
              onClick={() => setActiveComic(null)}
              title="Close modal"
              aria-label="Close modal"
            >
              ✕
            </button>
            <div className="modal-comic-header">
              <span className={`tech-badge ${activeComic.badgeColor}`}>{activeComic.badge}</span>
              <h3>{activeComic.title}</h3>
              <p>{activeComic.tagline}</p>
            </div>

            <div className="modal-comic-body-grid">
              <div className="modal-comic-img-box">
                <img src={activeComic.image} alt={activeComic.title} className="modal-comic-img" />
              </div>

              <div className="modal-comic-details">
                <div className="modal-points-section">
                  <h4 className="modal-points-heading">✦ Key Public Safety & Forensic Points:</h4>
                  <ul className="modal-comic-bullet-list">
                    {activeComic.bullets.map((b, idx) => (
                      <li key={idx}>
                        <span className="bullet-dot">✦</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="modal-comic-footer">
                  <p><strong>Action Tip:</strong> {activeComic.actionTip}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
