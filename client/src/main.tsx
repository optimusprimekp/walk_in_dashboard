import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@/api";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("auth_token"));

createRoot(document.getElementById("root")!).render(<App />);
