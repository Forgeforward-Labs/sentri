import { useEffect, useState } from "react";
import { appNavigation } from "@sentri/config";
import {
  CoverPage,
  DashboardPage,
  EarnPage,
  HomePage,
  PositionDetailPage,
} from "./pages";

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);

    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return pathname;
}

function navigate(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderPage(pathname: string) {
  if (pathname === "/cover") {
    return <CoverPage />;
  }

  if (pathname === "/earn") {
    return <EarnPage />;
  }

  if (pathname === "/dashboard") {
    return <DashboardPage />;
  }

  if (pathname.startsWith("/position/")) {
    return <PositionDetailPage pathname={pathname} />;
  }

  return <HomePage />;
}

export default function App() {
  const pathname = usePathname();

  return (
    <div className="site-shell">
      <nav className="panel panel-content top-nav">
        <div>
          <div className="eyebrow">Sentri Protocol</div>
          <strong>Somnia-native autonomous cover</strong>
        </div>
        <div className="nav-links">
          {appNavigation.map((item) => (
            <button
              key={item.href}
              className={`pill nav-button ${pathname === item.href ? "pill-active" : ""}`}
              onClick={() => navigate(item.href)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      {renderPage(pathname)}
    </div>
  );
}
