import { Navigate } from "react-router-dom";

const TerminalHardware = () => {
  return <Navigate to="/my-profile?tab=settings#terminal-hardware" replace />;
};

export default TerminalHardware;
