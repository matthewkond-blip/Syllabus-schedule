import { Router } from "express";
import { SyncRequestSchema } from "../schemas/eventSchema.js";
import { DEFAULT_TIMEZONE, listWritableCalendars, syncEvents } from "../services/googleCalendar.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

router.get("/calendars", async (req, res, next) => {
  try {
    const calendars = await listWritableCalendars();
    res.json({ calendars, defaultTimeZone: DEFAULT_TIMEZONE });
  } catch (err) {
    next(err);
  }
});

// Only one sync runs at a time. Event IDs are deterministic, so overlapping
// syncs couldn't create duplicates anyway — this just avoids wasted API calls
// if a second request sneaks in while the first is still running.
let syncInProgress = false;

router.post("/events", async (req, res, next) => {
  const parsed = SyncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    next(new AppError(400, `Some selected events are invalid (${issue.path.join(".")}: ${issue.message}).`));
    return;
  }
  if (syncInProgress) {
    next(new AppError(409, "A sync is already running. Please wait for it to finish."));
    return;
  }

  syncInProgress = true;
  try {
    const { calendarId, timeZone, events } = parsed.data;
    const results = await syncEvents({ calendarId, timeZone: timeZone || DEFAULT_TIMEZONE, events });
    res.json({ results });
  } catch (err) {
    next(err);
  } finally {
    syncInProgress = false;
  }
});

export default router;
