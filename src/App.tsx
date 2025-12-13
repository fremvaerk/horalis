import { HashRouter, Routes, Route } from "react-router-dom";
import FloatingTimer from "./components/FloatingTimer";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  return (
    <HashRouter>
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
