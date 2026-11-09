import React, { useEffect, useRef, useState } from "react";
import { drawBox, loadFaceApi, readFace, startCamera, stopCamera } from "./faceEngine";

const SAMPLES_NEEDED = 5;
const CAPTURE_EVERY_MS = 900;

const PROMPTS = [
  "Look straight at the camera",
  "Turn your head slightly to the left",
  "Turn your head slightly to the right",
  "Tilt your chin up a little",
  "Look straight again and relax your face",
];

function EnrollDialog({ person, api, onClose, onSaved }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplesRef = useRef([]);

  const [phase, setPhase] = useState("loading"); // loading | capturing | saving | error
  const [count, setCount] = useState(0);
  const [hint, setHint] = useState("Loading face recognition…");
  const [error, setError] = useState("");

  const name = `${person.first_name} ${person.last_name}`.trim();

  useEffect(() => {
    let stopped = false;
    let timer = null;

    const finish = async () => {
      setPhase("saving");
      setHint("Saving…");

      try {
        await api("/api/admin/face/enroll", {
          method: "POST",
          body: JSON.stringify({
            user_id: person.user_id,
            descriptors: samplesRef.current,
          }),
        });

        onSaved(`${name}'s face was enrolled.`);
      } catch (err) {
        setPhase("error");
        setError(err.message || "Could not save the face.");
      }
    };

    const loop = async (faceapi) => {
      if (stopped) return;

      try {
        const video = videoRef.current;
        const face = await readFace(faceapi, video);

        if (face.count === 0) {
          drawBox(canvasRef.current, video, null);
          setHint("No face found. Look at the camera.");
        } else if (face.count > 1) {
          drawBox(canvasRef.current, video, null);
          setHint("Only one person should be in view.");
        } else if (face.tooSmall) {
          drawBox(canvasRef.current, video, face.box, "#f59e0b");
          setHint("Come a little closer.");
        } else {
          drawBox(canvasRef.current, video, face.box, "#22c55e");

          samplesRef.current.push(face.descriptor);
          const taken = samplesRef.current.length;
          setCount(taken);

          if (taken >= SAMPLES_NEEDED) {
            await finish();
            return;
          }

          setHint(PROMPTS[taken] || "Hold still");
        }
      } catch {
        // Skip a bad frame.
      }

      timer = window.setTimeout(() => loop(faceapi), CAPTURE_EVERY_MS);
    };

    (async () => {
      try {
        const faceapi = await loadFaceApi();
        if (stopped) return;

        streamRef.current = await startCamera(videoRef.current);
        if (stopped) {
          stopCamera(streamRef.current);
          return;
        }

        setPhase("capturing");
        setHint(PROMPTS[0]);
        loop(faceapi);
      } catch (err) {
        if (!stopped) {
          setPhase("error");
          setError(err.message || "The camera could not be started.");
        }
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stopCamera(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
      <div className="portal-modal face-enroll-modal">
        <h2>Enroll face · {name}</h2>
        <p className="muted-text">
          The camera takes {SAMPLES_NEEDED} quick samples automatically. Good light on the face
          works best. Only numbers are saved, never photos.
        </p>

        <div className={`face-camera face-camera-${phase === "error" ? "error" : "ready"}`}>
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} />
          {phase === "loading" && <div className="face-camera-overlay">{hint}</div>}
        </div>

        {phase !== "error" && (
          <>
            <div className="face-progress" aria-label="Samples captured">
              <span style={{ width: `${(count / SAMPLES_NEEDED) * 100}%` }} />
            </div>
            <p className="face-hint">
              {hint} ({count}/{SAMPLES_NEEDED})
            </p>
          </>
        )}

        {phase === "error" && (
          <div className="portal-alert error-alert">
            <span>{error}</span>
          </div>
        )}

        <div className="profile-settings-actions">
          <button
            type="button"
            className="btn-outline compact"
            disabled={phase === "saving"}
            onClick={onClose}
          >
            {phase === "error" ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FaceEnrollment({ api, search = "" }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState(null);

  const load = async () => {
    try {
      const data = await api("/api/admin/face");
      setPeople(data.people || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load the face list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (person) => {
    const name = `${person.first_name} ${person.last_name}`.trim();

    if (!window.confirm(`Remove ${name}'s enrolled face? They will not be recognized by the camera until enrolled again.`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api("/api/admin/face/delete", {
        method: "POST",
        body: JSON.stringify({ user_id: person.user_id }),
      });
      setMessage(`${name}'s face was removed.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not remove the face.");
    }
  };

  const q = search.trim().toLowerCase();
  const visible = people.filter((p) =>
    [p.first_name, p.last_name, p.email, p.role].some((v) => String(v || "").toLowerCase().includes(q))
  );
  const enrolled = people.filter((p) => p.enrolled).length;

  return (
    <section className="panel admin-section-panel">
      <div className="panel-header-line">
        <div>
          <h2>Face Enrollment</h2>
          <p>
            Enroll the face of every teacher, admin, and staff member for the camera attendance
            kiosk.
          </p>
        </div>
        <span className="date-chip">
          {enrolled} of {people.length} enrolled
        </span>
      </div>

      <div className="kiosk-links">
        <a className="btn-outline compact" href="/face-attendance" target="_blank" rel="noreferrer">
          Open Face Attendance Kiosk ↗
        </a>
        <small className="muted-text">
          Opens a login-free camera page. Use a device with a webcam beside the entrance. Logs
          appear in Gate Attendance Logs as “Face Camera”.
        </small>
      </div>

      {error && (
        <div className="portal-alert error-alert">
          <span>{error}</span>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {message && (
        <div className="portal-alert notice-alert">
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="panel loading-panel">
          <span className="loading-spinner" />
        </div>
      ) : visible.length === 0 ? (
        <p className="muted-text">No teacher, admin, or staff accounts found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Face</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.user_id}>
                  <td>
                    {p.first_name} {p.last_name}
                  </td>
                  <td>{p.role === "admin" ? "Staff" : "Teacher"}</td>
                  <td>{p.email}</td>
                  <td>
                    <span className={`rfid-badge ${p.enrolled ? "rfid-badge-open" : "rfid-badge-closed"}`}>
                      {p.enrolled ? `Enrolled · ${p.sample_count} samples` : "Not enrolled"}
                    </span>
                  </td>
                  <td>{p.updated_at || "—"}</td>
                  <td>
                    <div className="note-row-actions">
                      <button type="button" className="note-edit-button" onClick={() => setTarget(p)}>
                        {p.enrolled ? "Re-enroll" : "Enroll face"}
                      </button>
                      {p.enrolled && (
                        <button type="button" className="account-delete-button" onClick={() => remove(p)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <EnrollDialog
          person={target}
          api={api}
          onClose={() => setTarget(null)}
          onSaved={(text) => {
            setTarget(null);
            setMessage(text);
            load();
          }}
        />
      )}
    </section>
  );
}
