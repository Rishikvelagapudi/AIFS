import { useState, useRef, useEffect } from "react";
import { useFeed } from "./useFeed";
import LandingPage from "./landing-page/LandingPage";
import IncidentDesk from "./incident-desk/IncidentDesk";
import EmergencyReportView from "./incident-desk/EmergencyReportView";
import AiForensic from "./ai-forensic/AiForensic";
import PostFetchBehaviorAnalysis from "./post-fetch-and-behavior-analysis/PostFetchBehaviorAnalysis";
import MagicPage from "./magic-page/MagicPage";
import { speak } from "./incident-desk/api";
import "./styles.css";

export default function App() {
  const [page, setPage] = useState(() => {
    // If opened directly via /incident-report/:id or ?report=:id, route directly to incident-desk
    const path = window.location.pathname;
    if (path.startsWith("/incident-report/")) {
      return "incident-desk";
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("report") || params.get("incident")) {
      return "incident-desk";
    }
    if (params.get("magic") === "true") {
      return "magic";
    }
    return "landing";
  });

  const [activeReportId, setActiveReportId] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith("/incident-report/")) {
      const id = path.replace("/incident-report/", "").split("?")[0].trim();
      return id || null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("report") || params.get("incident") || null;
  });

  const live = useRef({});

  const { cameras, incidents, online, emailDispatches, emergencyContact, lastEmailDispatch } = useFeed(
    (inc) => {
      const { voice: v } = live.current;
      if (v && (inc.severity === "critical" || inc.severity === "high")) {
        speak(inc.alert_text);
      }
    },
    (dispatch) => {
      console.log("Real-time Emergency Email Alert received:", dispatch);
    }
  );
  live.current = { voice: true, incidents };

  // Listen to browser popstate (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/incident-report/")) {
        const id = path.replace("/incident-report/", "").split("?")[0].trim();
        setActiveReportId(id || null);
        setPage("incident-desk");
      } else {
        setActiveReportId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectPage = (target) => {
    if (target === "page1" || target === "incident-desk") {
      setPage("incident-desk");
      setActiveReportId(null);
    } else if (target === "page2" || target === "ai-forensic") {
      setPage("ai-forensic");
    } else if (target === "page3" || target === "post-fetch") {
      setPage("post-fetch");
    } else if (target === "magic") {
      setPage("magic");
    } else {
      setPage(target);
    }
  };

  // Dedicated Standalone Evidence Report Interface (opened via Email Link or Direct Review)
  if (activeReportId) {
    return (
      <EmergencyReportView
        incidentId={activeReportId}
        onReturnToConsole={() => {
          setActiveReportId(null);
          setPage("incident-desk");
          try {
            window.history.pushState({}, "", "/");
          } catch (e) {}
        }}
        onReturnHome={() => {
          setActiveReportId(null);
          setPage("landing");
          try {
            window.history.pushState({}, "", "/");
          } catch (e) {}
        }}
        incidentsMap={incidents}
        camerasMap={cameras}
      />
    );
  }

  if (page === "magic") {
    return (
      <MagicPage
        onReturnHome={() => setPage("landing")}
        onNavigateModule={handleSelectPage}
      />
    );
  }

  if (page === "landing") {
    return <LandingPage onSelectPage={handleSelectPage} activePage={page} />;
  }

  if (page === "ai-forensic" || page === "page2") {
    return (
      <AiForensic
        onReturnHome={() => setPage("landing")}
        onNavigateModule={handleSelectPage}
      />
    );
  }

  if (page === "post-fetch" || page === "page3") {
    return (
      <PostFetchBehaviorAnalysis
        onReturnHome={() => setPage("landing")}
        onNavigateModule={handleSelectPage}
      />
    );
  }

  // Incident Desk (Module 01)
  return (
    <IncidentDesk
      cameras={cameras}
      incidents={incidents}
      online={online}
      emailDispatches={emailDispatches}
      smsDispatches={emailDispatches}
      emergencyContact={emergencyContact}
      lastEmailDispatch={lastEmailDispatch}
      lastSmsDispatch={lastEmailDispatch}
      initialIncidentId={activeReportId}
      initialViewMode="matrix3x3"
      onOpenEmergencyReport={(id) => {
        setActiveReportId(id);
        try {
          window.history.pushState({}, "", `/incident-report/${id}`);
        } catch (e) {}
      }}
      onReturnHome={() => setPage("landing")}
      onNavigateModule={handleSelectPage}
    />
  );
}
