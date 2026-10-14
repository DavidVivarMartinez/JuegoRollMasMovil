import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { loadSession, UNAUTHORIZED_EVENT } from "./lib/auth";
import type { Role } from "./lib/types";
import JoinPage from "./pages/JoinPage";
import PlayerTerminal from "./pages/PlayerTerminal";
import MasterPanel from "./pages/MasterPanel";

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = loadSession();
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role) {
    return <Navigate to={session.role === "MASTER" ? "/master" : "/player"} replace />;
  }
  return <>{children}</>;
}

/** Si el backend responde 401 (token revocado o caducado), volvemos a la pantalla de acceso. */
function UnauthorizedListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = () => navigate("/", { replace: true });
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <UnauthorizedListener />
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route
          path="/player"
          element={
            <RequireRole role="PLAYER">
              <PlayerTerminal />
            </RequireRole>
          }
        />
        <Route
          path="/master"
          element={
            <RequireRole role="MASTER">
              <MasterPanel />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
