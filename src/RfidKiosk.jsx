import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "./rfidApi";

const ROOM_KEY = "rfid_room";
const AUTO_KEY = "rfid_auto";

function readStore(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStore(storage, key, value) {
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // Storage can be blocked; the kiosk still works without it.
  }
}

function toMs(text) {
  return text ? Date.parse(`${String(text).replace(" ", "T")}+08:00`) : NaN;
}

function clock12(hms) {
  const match = String(hms || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function mmss(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function RfidKiosk({ mode = "class" }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  // The room comes from ?room=..., or from the room this device used before.
  const [room, setRoom] = useState(
    () => params.get("room") || (mode === "class" ? readStore(localStorage, ROOM_KEY) : "")
  );
  const [data, setData] = useState(null);
  const [roomList, setRoomList] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [serverTime, setServerTime] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const inputRef = useRef(null);
  const refreshedKey = useRef("");
  const resultTimer = useRef(null);

  const activeClass = data?.class || null;

  /* ---------- load the room's current class ---------- */

  const refreshSchedule = async () => {
    if (mode !== "class") return;

    try {
      if (!room) {
        const open = await apiRequest("/api/rfid/open-rooms");
        setRoomList(open.rooms || []);
        setServerTime(open.server_time || "");
        setScheduleError("");
        return;
      }

      const response = await apiRequest(
        `/api/rfid/active-class?room=${encodeURIComponent(room)}`
      );
      setData(response);
      setRoomList(response.rooms || []);
      setServerTime(response.server_time || "");
      setScheduleError("");

      // Remember this room so the login page can open the kiosk by itself.
      if (response.room_known) writeStore(localStorage, ROOM_KEY, room);
    } catch (err) {
      setScheduleError(err.message || "Unable to load the current class schedule.");
    }
  };

  useEffect(() => {
    refreshSchedule();
    const timer = window.setInterval(refreshSchedule, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room]);

  useEffect(() => {
    const focus = window.setInterval(() => {
      if (!busy && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 1200);
    inputRef.current?.focus();
    return () => window.clearInterval(focus);
  }, [busy, room, mode]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => window.clearTimeout(resultTimer.current), []);

  /* ---------- live phase (server time + local seconds) ---------- */

  const serverMs = toMs(serverTime);
  const offset = useMemo(
    () => (Number.isNaN(serverMs) ? 0 : serverMs - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverTime]
  );
  const nowMs = Date.now() + offset;

  const presentMs = activeClass ? toMs(activeClass.present_until) : NaN;
  const lateMs = activeClass ? toMs(activeClass.late_until) : NaN;
  const endMs = activeClass ? toMs(activeClass.end) : NaN;
  const nextMs = data?.next_class ? toMs(`${data.date} ${data.next_class.start_time}`) : NaN;

  let phase = "closed";
  if (activeClass) {
    if (nowMs <= presentMs) phase = "present";
    else if (nowMs <= lateMs) phase = "late";
    else if (nowMs < endMs) phase = "absent";
  }

  // Ask the server again whenever the phase changes, a class ends, or the
  // next class is due to start, so the kiosk moves on by itself.
  const serverPhase = data?.status || "closed";
  const dueRefresh =
    mode === "class" &&
    Boolean(room) &&
    Boolean(data) &&
    (phase !== serverPhase || (!activeClass && !Number.isNaN(nextMs) && nowMs >= nextMs));

  useEffect(() => {
    if (!dueRefresh) return;
    const key = `${phase}|${data?.server_time}`;
    if (refreshedKey.current === key) return;
    refreshedKey.current = key;
    refreshSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueRefresh, phase, data?.server_time]);

  // Opened automatically from the login page? Go back when attendance closes.
  const autoOpened = readStore(sessionStorage, AUTO_KEY) === "1";
  const closedForGood = mode === "class" && Boolean(room) && Boolean(data) && !activeClass && phase === "closed";

  useEffect(() => {
    if (!autoOpened || !closedForGood) return undefined;
    const timer = window.setTimeout(() => {
      writeStore(sessionStorage, AUTO_KEY, "");
      window.location.assign("/");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [autoOpened, closedForGood]);

  /* ---------- actions ---------- */

  const chooseRoom = (name) => {
    writeStore(localStorage, ROOM_KEY, name);
    window.history.replaceState(null, "", `/rfid-attendance?room=${encodeURIComponent(name)}`);
    setData(null);
    setRoom(name);
  };

  const changeRoom = () => {
    writeStore(localStorage, ROOM_KEY, "");
    writeStore(sessionStorage, AUTO_KEY, "");
    window.history.replaceState(null, "", "/rfid-attendance");
    setData(null);
    setResult(null);
    setError("");
    setRoom("");
  };

  const submitScan = async (event) => {
    event?.preventDefault?.();
    const uid = scanValue.trim().toUpperCase();
    if (!uid || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setScanValue("");
    window.clearTimeout(resultTimer.current);
    try {
      const response = await apiRequest("/api/rfid/scan", {
        method: "POST",
        body: JSON.stringify({
          rfid_uid: uid,
          mode,
          room,
          device_name: mode === "gate" ? "Main Gate" : `Classroom ${room || "Kiosk"}`,
        }),
      });
      setResult(response);
      resultTimer.current = window.setTimeout(() => setResult(null), 9000);
      if (mode === "class") refreshSchedule();
    } catch (err) {
      setError(err.message || "RFID scan was not accepted.");
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const timeLabel =
    mode === "class" && !Number.isNaN(serverMs)
      ? new Date(nowMs).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Manila",
        })
      : serverTime
        ? new Date(`${serverTime.replace(" ", "T")}+08:00`).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })
        : "--:--";

  const feedbackKind = result
    ? result.status === "Late"
      ? "late"
      : result.status === "Absent"
        ? "absent"
        : "success"
    : "";

  const header = (
    <header className="rfid-kiosk-top">
      <div className="rfid-kiosk-brand"><span>RFID</span><div><strong>School Attendance System</strong><small>Standalone Attendance Kiosk</small></div></div>
      <div className="rfid-kiosk-clock"><small>PHILIPPINE TIME</small><strong>{timeLabel}</strong></div>
    </header>
  );

  /* ---------- classroom kiosk with no room chosen yet ---------- */

  if (mode === "class" && !room) {
    return (
      <main className="rfid-kiosk-page">
        {header}
        <section className="rfid-kiosk-card">
          <div className="rfid-kiosk-icon" aria-hidden="true">⌁</div>
          <p className="rfid-kiosk-eyebrow">CLASSROOM ATTENDANCE</p>
          <h1>Which room is this kiosk in?</h1>
          <p className="rfid-kiosk-subtitle">
            Choose the room once. This device remembers it, then the attendance opens
            and closes by itself according to the class schedule.
          </p>

          {scheduleError && <div className="rfid-kiosk-feedback error" role="alert">{scheduleError}</div>}

          <div className="rfid-room-grid">
            {roomList.map((name) => (
              <button key={name} type="button" className="rfid-room-button" onClick={() => chooseRoom(name)}>
                {name}
              </button>
            ))}
          </div>

          {!scheduleError && roomList.length === 0 && (
            <p className="rfid-kiosk-footnote">No rooms found yet. Add a room to a class schedule first.</p>
          )}
        </section>
        <footer className="rfid-kiosk-footer">Powered by LavaLust Framework · MySQL</footer>
      </main>
    );
  }

  /* ---------- kiosk ---------- */

  const phaseLabel = {
    present: "OPEN · PRESENT",
    late: "OPEN · LATE",
    absent: "OPEN · ABSENT",
    closed: "CLOSED",
  }[phase];

  let phaseNote = "";
  if (phase === "present") phaseNote = `Tap now to be marked Present · ${mmss(presentMs - nowMs)} left`;
  if (phase === "late") phaseNote = `Tapping now marks you Late · Absent starts in ${mmss(lateMs - nowMs)}`;
  if (phase === "absent") phaseNote = `Tapping now marks you Absent · class ends in ${mmss(endMs - nowMs)}`;

  return (
    <main className="rfid-kiosk-page">
      {header}

      <section className="rfid-kiosk-card">
        <div className="rfid-kiosk-icon" aria-hidden="true">⌁</div>
        <p className="rfid-kiosk-eyebrow">{mode === "gate" ? "SCHOOL ENTRANCE" : "CLASSROOM ATTENDANCE"}</p>
        <h1>{mode === "gate" ? "Scan your RFID to log your arrival" : "Tap your student RFID card"}</h1>
        <p className="rfid-kiosk-subtitle">
          {mode === "gate"
            ? "Students, teachers, and staff can record their gate attendance here. No account login is required."
            : "Tap within the first 15 minutes to be Present. After that you are Late, and after 1 hour you are marked Absent. One tap per student. No login is required."}
        </p>

        {mode === "class" && (
          <div className={`rfid-kiosk-schedule rfid-phase-${phase}`}>
            <small>ROOM {room}</small>

            {activeClass ? (
              <>
                <strong>{activeClass.subject_name}</strong>
                <span>
                  {activeClass.subject_code} · {activeClass.room} · {clock12(activeClass.start_time)}–{clock12(activeClass.end_time)}
                  {activeClass.teacher_name ? ` · ${activeClass.teacher_name}` : ""}
                </span>
                <em className={`rfid-phase-pill rfid-phase-pill-${phase}`}>{phaseLabel}</em>
                <p className="rfid-phase-note">{phaseNote}</p>

                {data?.active_classes?.length > 1 && (
                  <>
                    <p className="rfid-phase-note">
                      {data.active_classes.length} classes are open in this room. Your card is
                      matched to your own class automatically.
                    </p>
                    <ul className="rfid-diagnostics">
                      {data.active_classes.map((item) => (
                        <li key={item.class_id}>
                          <b>{item.subject_name}</b>
                          <span>
                            {item.subject_code} · {clock12(item.start_time)}–{clock12(item.end_time)}
                            {item.teacher_name ? ` · ${item.teacher_name}` : ""}
                          </span>
                          <em className={`rfid-phase-pill rfid-phase-pill-${item.status}`}>
                            {item.status.toUpperCase()}
                          </em>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <>
                <strong className="rfid-kiosk-no-class">
                  {data && data.room_known === false ? "Room not found" : "No active class at this time"}
                </strong>
                <span>{data?.message || (scheduleError ? "" : "Loading the schedule…")}</span>

                {closedForGood && autoOpened && (
                  <span className="rfid-phase-note">Attendance closed. Returning to the sign-in page…</span>
                )}

                {data && data.room_known === false && (
                  <div className="rfid-room-grid">
                    {roomList.map((name) => (
                      <button key={name} type="button" className="rfid-room-button" onClick={() => chooseRoom(name)}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                {data?.room_classes?.length > 0 && (
                  <ul className="rfid-diagnostics">
                    {data.room_classes.map((item, index) => (
                      <li key={`${item.subject_code}-${index}`}>
                        <b>{item.subject_name}</b>
                        <span>
                          {item.days || "no days"} · {item.start_time || "?"} – {item.end_time || "?"}
                        </span>
                        <em>{item.reason}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {scheduleError && <span className="rfid-schedule-error">{scheduleError}</span>}
            <button type="button" className="rfid-change-room" onClick={changeRoom}>Change room</button>
          </div>
        )}

        <form className="rfid-kiosk-scan-form" onSubmit={submitScan}>
          <label htmlFor="rfid-kiosk-input">RFID CARD CODE</label>
          <input
            ref={inputRef}
            id="rfid-kiosk-input"
            autoFocus
            autoComplete="off"
            spellCheck="false"
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") submitScan(event); }}
            placeholder="Tap card on the RFID reader"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !scanValue.trim()}>{busy ? "Checking card…" : "Submit scan"}</button>
        </form>

        {error && <div className="rfid-kiosk-feedback error" role="alert">{error}</div>}
        {result && <div className={`rfid-kiosk-feedback ${feedbackKind}`}><strong>{result.status}</strong><span>{result.name} · {result.role}</span><p>{result.message}</p><small>{result.subject ? `${result.subject} · ` : ""}{result.time}</small></div>}
        <p className="rfid-kiosk-footnote">Please tap one card at a time. Your attendance is saved automatically after a successful scan.</p>
      </section>
      <footer className="rfid-kiosk-footer">Powered by LavaLust Framework · MySQL</footer>
    </main>
  );
}
