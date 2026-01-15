import { useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import FloatingTimer from "./components/FloatingTimer";
import Dashboard from "./components/Dashboard";
import "./App.css";

// Component to handle timer-mode class for Windows compatibility
function TimerModeHandler() {
  const location = useLocation();

  useEffect(() => {
    const isTimerWindow = location.pathname === "/" || location.pathname === "";
    if (isTimerWindow) {
      document.documentElement.classList.add("timer-mode");
      document.body.classList.add("timer-mode");
    } else {
      document.documentElement.classList.remove("timer-mode");
      document.body.classList.remove("timer-mode");
    }

    return () => {
      document.documentElement.classList.remove("timer-mode");
      document.body.classList.remove("timer-mode");
    };
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <TimerModeHandler />
      <Routes>
        <Route
          path="/"
          element={
            <div className="timer-window w-full h-full p-1">
              <FloatingTimer />
            </div>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
