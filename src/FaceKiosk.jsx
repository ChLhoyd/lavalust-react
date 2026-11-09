import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "./rfidApi";
import { drawBox, loadFaceApi, readFace, startCamera, stopCamera } from "./faceEngine";

// A face must be seen in this many frames in a row before it is sent.
const STABLE_FRAMES = 3;
const LOOP_MS = 600;

function manilaClock() {
  return new Date().toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export default function FaceKiosk() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stateRef = useRef({ stable: 0, busy: false, cooldownUntil: 0, stopped: false });
  const resultTimer = useRef(null);

  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [hint, setHint] = useState("Loading face recognition…");
  const [fatal, setFatal] = useState("");
  const [result, setResult] = useState(null);
  const [clock, setClock] = useState(manilaClock());

  useEffect(() => {
    const tick = window.setInterval(() => setClock(manilaClock()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    state.stopped = false;

    const show = (value, ms = 6000) => {
      window.clearTimeout(resultTimer.current);
      setResult(value);
      resultTimer.current = window.setTimeout(() => setResult(null), ms);
    };

    const loop = async (faceapi) => {
      if (state.stopped) return;

      try {
        const now = Date.now();
        const video = videoRef.current;

        if (!state.busy && now >= state.cooldownUntil) {
          const face = await readFace(faceapi, video);

          if (face.count === 0) {
            state.stable = 0;
            drawBox(canvasRef.current, video, null);
            setHint("Look at the camera");
          } else if (face.count > 1) {
            state.stable = 0;
            drawBox(canvasRef.current, video, null);
            setHint("One person at a time, please");
          } else if (face.tooSmall) {
            state.stable = 0;
            drawBox(canvasRef.current, video, face.box, "#f59e0b");
            setHint("Come a little closer");
          } else {
            state.stable += 1;
            drawBox(canvasRef.current, video, face.box, "#22c55e");
            setHint("Hold still…");

            if (state.stable >= STABLE_FRAMES) {
              state.busy = true;
              state.stable = 0;
              setHint("Checking…");

              try {
                const response = await apiRequest("/api/face/scan", {
                  method: "POST",
                  body: JSON.stringify({ descriptor: face.descriptor }),
                });

                show({ kind: response.event_type === "IN" ? "success" : "out", ...response });
                state.cooldownUntil = Date.now() + 6000;
              } catch (err) {
                const notRecognized = err.status === 404;

                show(
                  { kind: "error", message: err.message || "The face could not be checked." },
                  notRecognized ? 4000 : 6000
                );
                state.cooldownUntil = Date.now() + (notRecognized ? 3000 : 7000);
              } finally {
                state.busy = false;
                setHint("Look at the camera");
              }
            }
          }
        } else if (now < state.cooldownUntil) {
          drawBox(canvasRef.current, videoRef.current, null);
        }
      } catch {
        // A single bad frame must never stop the kiosk.
      }

      state.timer = window.setTimeout(() => loop(faceapi), LOOP_MS);
      timerRef.current = state.timer;
    };

    (async () => {
      try {
        const faceapi = await loadFaceApi();
        if (state.stopped) return;

        setHint("Starting the camera…");
        streamRef.current = await startCamera(videoRef.current);
        if (state.stopped) {
          stopCamera(streamRef.current);
          return;
        }

        setPhase("ready");
        setHint("Look at the camera");
        loop(faceapi);
      } catch (err) {
        if (!state.stopped) {
          setPhase("error");
          setFatal(err.message || "The face camera could not be started.");
        }
      }
    })();

    return () => {
      state.stopped = true;
      window.clearTimeout(timerRef.current);
      window.clearTimeout(resultTimer.current);
      stopCamera(streamRef.current);
    };
  }, []);

  return (
    <main className="rfid-kiosk-page">
      <header className="rfid-kiosk-top">
        <div className="rfid-kiosk-brand">
          <span>FACE</span>
          <div>
            <strong>School Attendance System</strong>
            <small>Camera Attendance · Teachers, Admin &amp; Staff</small>
          </div>
        </div>
        <div className="rfid-kiosk-clock">
          <small>PHILIPPINE TIME</small>
          <strong>{clock}</strong>
        </div>
      </header>

      <section className="rfid-kiosk-card">
        <p className="rfid-kiosk-eyebrow">FACIAL RECOGNITION</p>
        <h1>Look at the camera to log in or out</h1>
        <p className="rfid-kiosk-subtitle">
          Your first scan of the day logs you IN, the next logs you OUT. No account login is
          required. Your face is only compared as numbers; no photo is saved.
        </p>

        <div className={`face-camera face-camera-${phase}`}>
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} />
          {phase === "loading" && <div className="face-camera-overlay">{hint}</div>}
          {phase === "error" && <div className="face-camera-overlay face-camera-error">{fatal}</div>}
        </div>

        {phase === "ready" && <p className="face-hint">{hint}</p>}

        {result && result.kind === "error" && (
          <div className="rfid-kiosk-feedback error" role="alert">
            {result.message}
          </div>
        )}

        {result && result.kind !== "error" && (
          <div className="rfid-kiosk-feedback success">
            <strong>{result.status}</strong>
            <span>
              {result.name} · {result.role}
            </span>
            <p>{result.message}</p>
            <small>{result.time}</small>
          </div>
        )}

        <p className="rfid-kiosk-footnote">
          Not recognized? Ask the administrator to enroll your face under Admin → Face Enrollment.
        </p>
      </section>

      <footer className="rfid-kiosk-footer">Powered by LavaLust Framework · MySQL · face-api.js</footer>
    </main>
  );
}
