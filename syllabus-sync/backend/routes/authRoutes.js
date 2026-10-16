import { Router } from "express";
import { disconnect, getAuthUrl, handleAuthCallback, isConnected } from "../services/googleCalendar.js";

const router = Router();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

function isConfigured() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

router.get("/status", async (req, res) => {
  res.json({ configured: isConfigured(), connected: isConfigured() && (await isConnected()) });
});

// The browser navigates here directly (full-page redirect), so errors are sent
// back to the frontend as a query param rather than as a JSON response.
router.get("/google", (req, res) => {
  try {
    res.redirect(getAuthUrl());
  } catch (err) {
    console.error("Couldn't start Google sign-in:", err.message);
    res.redirect(`${FRONTEND_ORIGIN}/?google=not-configured`);
  }
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) {
    res.redirect(`${FRONTEND_ORIGIN}/?google=denied`);
    return;
  }
  try {
    await handleAuthCallback(String(code), String(state || ""));
    res.redirect(`${FRONTEND_ORIGIN}/?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err.message);
    res.redirect(`${FRONTEND_ORIGIN}/?google=error`);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await disconnect();
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
});

export default router;
