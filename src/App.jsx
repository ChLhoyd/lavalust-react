import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import "./App.css";
import "./Portal.css";
import StudentCalendar from "./StudentCalendar";
import RfidKiosk from "./RfidKiosk";
import FaceKiosk from "./FaceKiosk";
import FaceEnrollment from "./FaceEnrollment";
import ChatbotWidget from "./ChatbotWidget";
import { apiRequest as publicApiRequest } from "./rfidApi";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://altamia-christannlhoyd-new.onrender.com"
).replace(/\/+$/, "");

async function parseApiResponse(response) {
  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error(
      "LavaLust returned HTML instead of JSON. Check the backend exception page and API route."
    );
    error.status = response.status;
    throw error;
  }

  return { response, data };
}

async function sendApiRequest(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  const accessToken = localStorage.getItem("access_token");

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...options,
    credentials: "omit",
    headers,
  });
}

async function apiRequest(path, options = {}) {
  let result = await parseApiResponse(await sendApiRequest(path, options));
  const refreshToken = localStorage.getItem("refresh_token");

  const canRefresh =
    result.response.status === 401 &&
    refreshToken &&
    !["/api/login", "/api/logout", "/api/refresh"].includes(path.split("?")[0]);

  if (canRefresh) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const refreshed = await parseApiResponse(refreshResponse);

      if (refreshed.response.ok) {
        const tokens =
          refreshed.data.tokens ||
          refreshed.data.data?.tokens ||
          refreshed.data;

        if (tokens.access_token) {
          localStorage.setItem("access_token", tokens.access_token);
        }

        if (tokens.refresh_token) {
          localStorage.setItem("refresh_token", tokens.refresh_token);
        }

        result = await parseApiResponse(await sendApiRequest(path, options));
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  }

  if (!result.response.ok || result.data.success === false || result.data.error) {
    const error = new Error(
      result.data.message ||
        result.data.error ||
        `Request failed (${result.response.status}).`
    );

    error.status = result.response.status;
    throw error;
  }

  return result.data;
}

function getManilaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function AttendanceIllustration() {
  return (
    <svg
      className="attendance-illustration"
      viewBox="0 0 300 300"
      role="img"
      aria-label="Attendance checklist illustration"
    >
      <circle
        cx="150"
        cy="150"
        r="112"
        fill="rgba(255,255,255,.06)"
        stroke="rgba(210,222,255,.18)"
        strokeWidth="1.5"
      />
      <rect
        x="98"
        y="67"
        width="106"
        height="156"
        rx="15"
        fill="#fff"
        stroke="#a9baff"
        strokeWidth="2"
      />
      <rect x="126" y="57" width="50" height="21" rx="7" fill="#3f5ee8" />
      <rect x="136" y="64" width="30" height="6" rx="3" fill="#fff" />

      {[0, 1, 2].map((n) => (
        <g key={n} transform={`translate(0 ${n * 31})`}>
          <rect
            x="115"
            y="94"
            width="16"
            height="16"
            rx="4"
            fill={n === 2 ? "#fff0d2" : "#dff7e9"}
          />
          {n < 2 ? (
            <path
              d={`M119 ${102 + n * 31} l3 3 l6 -7`}
              fill="none"
              stroke="#24a36a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle cx="123" cy="102" r="3.2" fill="#f5a623" />
          )}
          <rect x="139" y="97" width="47" height="4" rx="2" fill="#c9d3ef" />
          <rect x="139" y="105" width="36" height="4" rx="2" fill="#e1e7f7" />
        </g>
      ))}

      <circle
        cx="194"
        cy="195"
        r="23"
        fill="#3f5ee8"
        stroke="#fff"
        strokeWidth="3"
      />
      <path
        d="M183 195 l7 7 l15 -16"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M77 105 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z"
        fill="#8ea7ff"
      />
      <path
        d="M218 112 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z"
        fill="#8ea7ff"
      />
      <circle cx="215" cy="155" r="3" fill="#a8baff" />
      <circle cx="87" cy="178" r="4" fill="#a8baff" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">▤</span>
      <span>
        <b>School Attendance</b>
        <small>Attendance Management System</small>
      </span>
    </div>
  );
}

function ThemeButton({ theme, onToggle }) {
  return (
    <button className="mode-button" type="button" onClick={onToggle}>
      {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
    </button>
  );
}

// On the sign-in page: when attendance opens in a classroom, show the
// classroom attendance kiosk instead of the login form.
//  - A device that already used a room (it remembers it) switches by itself.
//  - Any other device gets a banner with a button for each open room.
function AttendanceOpenWatcher() {
  const [openRooms, setOpenRooms] = useState([]);

  useEffect(() => {
    let active = true;

    const key = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const hasSession = () => {
      try {
        return Boolean(localStorage.getItem("access_token") || localStorage.getItem("refresh_token"));
      } catch {
        return false;
      }
    };

    const check = async () => {
      // Signed-in users (teacher, admin, student) are never redirected.
      if (hasSession()) {
        if (active) setOpenRooms([]);
        return;
      }

      try {
        const data = await publicApiRequest("/api/rfid/open-rooms");
        const open = data.open || [];

        let remembered = "";
        try {
          remembered = localStorage.getItem("rfid_room") || "";
        } catch {
          remembered = "";
        }

        const match = remembered && open.find((item) => key(item.room) === key(remembered));

        if (match && active) {
          try {
            sessionStorage.setItem("rfid_auto", "1");
          } catch {
            // Not critical.
          }
          window.location.assign(`/rfid-attendance?room=${encodeURIComponent(match.room)}`);
          return;
        }

        if (active) setOpenRooms(open);
      } catch {
        if (active) setOpenRooms([]);
      }
    };

    check();
    const timer = window.setInterval(check, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (openRooms.length === 0) return null;

  return (
    <div className="attendance-open-banner" role="status">
      <strong>Attendance is open now</strong>
      <span>Tap your room to record your attendance. No login needed.</span>
      <div>
        {openRooms.slice(0, 8).map((item) => (
          <a
            key={`${item.room}-${item.subject_name}`}
            href={`/rfid-attendance?room=${encodeURIComponent(item.room)}`}
            onClick={() => {
              try {
                sessionStorage.setItem("rfid_auto", "1");
              } catch {
                // Not critical.
              }
            }}
          >
            {item.room} · {item.subject_name}
          </a>
        ))}
      </div>
    </div>
  );
}

function App() {
  const kioskPath = window.location.pathname.replace(/\/+$/, "");
  if (kioskPath === "/rfid-attendance") return <RfidKiosk mode="class" />;
  if (kioskPath === "/gate-attendance") return <RfidKiosk mode="gate" />;
  if (kioskPath === "/face-attendance") return <FaceKiosk />;

  return (
    <>
      <AuthenticatedApp />
      <AttendanceOpenWatcher />
    </>
  );
}

function AuthenticatedApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginThemeLight, setLoginThemeLight] = useState(
    () => localStorage.getItem("school_login_theme") === "light"
  );
  const [portalTheme, setPortalTheme] = useState(
    () => localStorage.getItem("school_portal_theme") || "light"
  );
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  // Keep the selected appearance when the page is refreshed or reopened.
  useEffect(() => {
    localStorage.setItem("school_login_theme", loginThemeLight ? "light" : "dark");
  }, [loginThemeLight]);

  useEffect(() => {
    localStorage.setItem("school_portal_theme", portalTheme);
  }, [portalTheme]);

  const STUDENT_NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "subjects", label: "Subjects", icon: "subjects" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "attendance", label: "My Attendance", icon: "attendance" },
  { id: "appeals", label: "My Absence Letters", icon: "appeals" },
  ];

  useEffect(() => {
    let active = true;

    if (
      !localStorage.getItem("access_token") &&
      !localStorage.getItem("refresh_token")
    ) {
      setCheckingSession(false);

      return () => {
        active = false;
      };
    }

    apiRequest("/api/me")
      .then((data) => {
        if (active && data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => {
        if (err.status !== 401 && err.status !== 403) {
          console.info("No active access token:", err.message);
        }

        if (active) {
          setUser(null);
        }

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      })
      .finally(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const account = data.user || data.data?.user || data.data || {};
      const role = String(account.role || data.role || "").toLowerCase();
      const tokens = data.tokens || data.data?.tokens || data;

      if (!["admin", "teacher", "student", "staff"].includes(role)) {
        throw new Error(
          "The API response did not include a valid admin, teacher, or student role."
        );
      }

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error(
          "The API response did not include access and refresh tokens. Check the LavaLust API configuration and response."
        );
      }

      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      setUser({ ...account, role });
      setPortalTheme("light");
      setPassword("");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Unable to connect to the LavaLust API.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");

    try {
      await apiRequest("/api/logout", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: refreshToken || "",
        }),
      });
    } catch (err) {
      console.warn("Logout request:", err.message);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      setUser(null);
      setEmail("");
      setPassword("");
      setError("");
    }
  };

  if (checkingSession) {
    return (
      <div className="app-loading">
        <span className="loading-spinner" />
        Checking your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`login-page ${loginThemeLight ? "light" : ""}`}>
        <section className="login-card">
          <div className="login-form-panel">
            <div className="panel-top">
              <button
                className="mode-button"
                type="button"
                onClick={() => setLoginThemeLight(!loginThemeLight)}
              >
                {loginThemeLight ? "🌙 Dark Mode" : "☀️ Light Mode"}
              </button>
            </div>

            <Brand />

            <div className="welcome">
              <h1>Welcome back!</h1>
              <p>Log in to continue to your account.</p>
            </div>

            <form className="login-form" onSubmit={login}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email address"
                autoComplete="username"
                required
              />

              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  className="show-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && <p className="login-error" role="alert">{error}</p>}

              <button
                className="sign-in-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <footer className="login-footer">
              © 2026 School Attendance System
            </footer>
          </div>

          <aside className="login-visual-panel">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <AttendanceIllustration />
            <div className="visual-copy">
              <h2>Attendance made simple.</h2>
              <p>
                Keep track of student attendance and stay organized in one
                convenient system.
              </p>
            </div>
            <div className="feature-pill">
              <span />
              Organized. Accurate. Efficient.
            </div>
          </aside>
        </section>
      </div>
    );
  }

  if (String(user.role).toLowerCase() === "admin") {
    return (
      <AdminPortal
        user={user}
        theme={portalTheme}
        onToggleTheme={() =>
          setPortalTheme((current) =>
            current === "light" ? "dark" : "light"
          )
        }
        onLogout={logout}
        onUserUpdated={setUser}
      />
    );
  }

  if (String(user.role).toLowerCase() === "teacher") {
    return (
      <TeacherPortal
        user={user}
        theme={portalTheme}
        onToggleTheme={() =>
          setPortalTheme((current) =>
            current === "light" ? "dark" : "light"
          )
        }
        onLogout={logout}
        onUserUpdated={setUser}
      />
    );
  }

  if (String(user.role).toLowerCase() === "student") {
    return (
      <StudentPortal
        user={user}
        theme={portalTheme}
        onToggleTheme={() =>
          setPortalTheme((current) =>
            current === "light" ? "dark" : "light"
          )
        }
        onLogout={logout}
        onUserUpdated={setUser}
      />
    );
  }

  return (
    <div className="unsupported-role">
      <h1>Account role not supported</h1>
      <p>This portal is available for teacher and student accounts.</p>
      <button className="portal-primary-button" onClick={logout}>
        Sign Out
      </button>
    </div>
  );
}

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "accounts", label: "Manage Accounts", icon: "students" },
  { id: "classes", label: "Class Schedules", icon: "classes" },
  { id: "transfers", label: "Transfer Requests", icon: "appeals" },
  { id: "rfid", label: "RFID Cards", icon: "attendance" },
  { id: "gate-logs", label: "Gate Attendance Logs", icon: "attendance" },
  { id: "face", label: "Face Enrollment", icon: "students" },
  { id: "notes", label: "Student Notes Log", icon: "appeals" },
  { id: "teacher-logins", label: "Teacher Login Logs", icon: "attendance" },
];

const TEACHER_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "students", label: "Students", icon: "students" },
  { id: "classes", label: "Classes", icon: "classes" },
  { id: "schedule", label: "Class Schedule", icon: "subjects" },
  { id: "transfers", label: "Student Transfers", icon: "students" },
  { id: "attendance", label: "Attendance", icon: "attendance" },
  { id: "notes", label: "Student Notes", icon: "appeals" },
  { id: "appeals", label: "Absence Letters", icon: "appeals" },
  
];

const STUDENT_NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "subjects", label: "Subjects", icon: "subjects" },
  { id: "schedule", label: "Class Schedule", icon: "classes" },
  { id: "attendance", label: "My Attendance", icon: "attendance" },
  { id: "appeals", label: "My Absence Letters", icon: "appeals" },
];

function NavIcon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
        <path d="M18 14.7c2.2.6 4 2.2 4 5.3" />
      </>
    ),
    classes: (
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5" />
      </>
    ),
    attendance: (
      <>
        <rect x="4" y="4" width="16" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M8.5 13l2.5 2.5 4.5-5" />
      </>
    ),
    appeals: (
      <>
        <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M14 3v5h5M8 12h8M8 16h8" />
      </>
    ),
    home: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
    subjects: (
      <>
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 4.5v17M8 7h8M8 11h8M8 15h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
  };

  return (
    <svg className="portal-nav-svg" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.dashboard}
    </svg>
  );
}

function PortalShell({
  role,
  user,
  theme,
  onToggleTheme,
  onLogout,
  activePage,
  setActivePage,
  search,
  setSearch,
  children,
}) {
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const nav = isAdmin
    ? ADMIN_NAV
    : isTeacher
      ? TEACHER_NAV
      : STUDENT_NAV;

  const name =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.email ||
    "User";

  const active = [
    ...nav,
    { id: "settings", label: "Settings", icon: "settings" },
  ].find((item) => item.id === activePage);

  return (
    <div className={`portal-app theme-${theme} role-${role}`}>
      <aside className="sidebar">
        <div className="profile">
          <div className="avatar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
          <div className="profile-copy">
            <div className="name">{name}</div>
            <div className="status">
              <span className="dot" /> Logged in
            </div>
          </div>
        </div>

        <div className="sidebar-role-label">
          {isAdmin
            ? "ADMINISTRATOR"
            : isTeacher
              ? "TEACHER"
              : "STUDENT"}
        </div>

        <nav className="nav" aria-label={`${role} navigation`}>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {activePage === item.id && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>

        <div className="bottom">
          <button
            type="button"
            className={`nav-item ${activePage === "settings" ? "active" : ""}`}
            onClick={() => setActivePage("settings")}
          >
            <NavIcon name="settings" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className="nav-item logout-link"
            onClick={onLogout}
          >
            <NavIcon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="portal-main-top">
          <div>
            <div className="page-eyebrow">SCHOOL ATTENDANCE SYSTEM</div>
            <h1 className="portal-page-title">{active?.label || "Dashboard"}</h1>
          </div>

          <div className="portal-top-actions">
            <span className="portal-date-pill">
              {new Date().toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "Asia/Manila",
              })}
            </span>
            <ThemeButton theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>

        <label className="portal-search-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              isAdmin
                ? "Search accounts, student notes, teacher logs…"
                : isTeacher
                  ? "Search students, classes, attendance…"
                  : "Search classes or attendance…"
            }
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </label>

        {children}

        <footer className="portal-footer">
          © 2026 School Attendance System <span>·</span>{" "}
          {isAdmin
            ? "Admin Portal"
            : isTeacher
              ? "Teacher Portal"
              : "Student Portal"}
        </footer>
      </main>

      <ChatbotWidget
        api={apiRequest}
        role={role}
        firstName={user.first_name}
      />
    </div>
  );
}

function PageHeading({ title, subtitle, right }) {
  return (
    <div className="page-heading-row">
      <div>
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "Not marked");
  const key = value.toLowerCase().replace(/[^a-z]+/g, "-");

  return <span className={`badge ${key}`}>{value}</span>;
}

async function downloadAppealLetter(appealId) {
  const data = await apiRequest(
    `/api/appeal-letter?appeal_id=${encodeURIComponent(appealId)}`
  );

  const binary = window.atob(data.content_base64 || "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], {
    type: data.mime_type || "application/octet-stream",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = data.file_name || `absence-letter-${appealId}`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const LETTER_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const LETTER_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

function isAllowedLetterFile(file) {
  if (!file) return false;
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return (
    LETTER_ALLOWED_EXTENSIONS.includes(extension) &&
    (!file.type || LETTER_ALLOWED_TYPES.includes(file.type))
  );
}

async function fetchAppealLetterBlob(appealId) {
  const data = await apiRequest(
    `/api/appeal-letter?appeal_id=${encodeURIComponent(appealId)}`
  );

  const binary = window.atob(data.content_base64 || "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const mime = data.mime_type || "application/octet-stream";

  return {
    blob: new Blob([bytes], { type: mime }),
    mime,
    name: data.file_name || `absence-letter-${appealId}`,
  };
}

function LetterViewer({ appeal, onClose }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    url: "",
    mime: "",
    name: "",
  });

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setState({ loading: true, error: "", url: "", mime: "", name: "" });

    fetchAppealLetterBlob(appeal.appeal_id)
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file.blob);
        setState({
          loading: false,
          error: "",
          url: objectUrl,
          mime: file.mime,
          name: file.name,
        });
      })
      .catch((err) => {
        if (active) {
          setState({
            loading: false,
            error: err.message || "Could not open the uploaded letter.",
            url: "",
            mime: "",
            name: "",
          });
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [appeal.appeal_id]);

  const isImage = state.mime.startsWith("image/");
  const isPdf = state.mime === "application/pdf";

  return (
    <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
      <div className="portal-modal letter-viewer">
        <div className="letter-viewer-head">
          <div>
            <h2>Absence letter</h2>
            <small className="muted-text">
              {appeal.subject_name || appeal.subject_code || ""}
              {appeal.date ? ` · ${appeal.date}` : ""}
            </small>
          </div>
          <button type="button" className="btn-outline compact" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="letter-viewer-body">
          {state.loading && <LoadingState />}

          {state.error && (
            <div className="portal-alert error-alert">
              <span>{state.error}</span>
            </div>
          )}

          {!state.loading && !state.error && isImage && (
            <img src={state.url} alt="Uploaded absence letter" />
          )}

          {!state.loading && !state.error && isPdf && (
            <iframe src={state.url} title="Uploaded absence letter" />
          )}

          {!state.loading && !state.error && !isImage && !isPdf && (
            <p className="muted-text">
              This file type cannot be previewed. Use Download instead.
            </p>
          )}
        </div>

        {state.url && (
          <div className="profile-settings-actions">
            <a
              className="btn-outline compact letter-download-link"
              href={state.url}
              download={state.name}
            >
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeField({ id, value, onChange, label }) {
  const parse = (text) => {
    const match = /^(\d{2}):(\d{2})/.exec(text || "");
    if (!match) {
      const manilaHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          hour12: false,
        }).format(new Date())
      );
      return { h: "", m: "", p: manilaHour >= 12 ? "PM" : "AM" };
    }
    const hour24 = Number(match[1]);
    return {
      h: String(hour24 % 12 || 12),
      m: match[2],
      p: hour24 >= 12 ? "PM" : "AM",
    };
  };

  const compose = (parts) => {
    const hour = parts.h === "" ? NaN : Number(parts.h);
    const minute = parts.m === "" ? 0 : Number(parts.m);

    if (!(hour >= 1 && hour <= 12) || !(minute >= 0 && minute <= 59)) {
      return "";
    }

    const hour24 = (hour % 12) + (parts.p === "PM" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const [parts, setParts] = useState(() => parse(value));

  useEffect(() => {
    if (value !== compose(parts)) {
      setParts(parse(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (patch) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(compose(next));
  };

  const digits = (text) => text.replace(/\D/g, "").slice(0, 2);

  return (
    <div className="time-field" role="group" aria-label={label}>
      <input
        id={id}
        className="time-field-part"
        inputMode="numeric"
        placeholder="0"
        value={parts.h}
        onChange={(event) => update({ h: digits(event.target.value) })}
        aria-label={`${label} hour`}
        autoComplete="off"
      />
      <span className="time-field-colon">:</span>
      <input
        className="time-field-part"
        inputMode="numeric"
        placeholder="00"
        value={parts.m}
        onChange={(event) => update({ m: digits(event.target.value) })}
        onBlur={() => {
          if (parts.m.length === 1) update({ m: `0${parts.m}` });
        }}
        aria-label={`${label} minutes`}
        autoComplete="off"
      />
      <select
        className="time-field-period"
        value={parts.p}
        onChange={(event) => update({ p: event.target.value })}
        aria-label={`${label} AM or PM`}
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

function StatCard({ status, value }) {
  const map = {
    Present: { icon: "✓", note: "Marked present today" },
    Absent: { icon: "×", note: "Marked absent today" },
    Late: { icon: "◷", note: "Marked late today" },
  };

  const item = map[status];

  return (
    <article className={`stat ${status.toLowerCase()}`}>
      <div className="stat-heading">
        <span className="label">{status}</span>
        <span className="stat-icon">{item.icon}</span>
      </div>
      <div className="value">{Number(value || 0)}</div>
      <div className="stat-note">{item.note}</div>
    </article>
  );
}

function ChartCanvas({
  type,
  labels = [],
  datasets = [],
  emptyText,
  theme = "light",
}) {
  const canvasRef = useRef(null);
  const chartData = useMemo(() => ({ labels, datasets }), [labels, datasets]);

  const textColor = theme === "dark" ? "#c7d2e7" : "#6b7489";
  const gridColor = theme === "dark" ? "#34445e" : "#e5e9f2";

  const pieTotal =
    datasets?.[0]?.data?.reduce(
      (sum, value) => sum + Math.max(0, Number(value) || 0),
      0
    ) || 0;

  const hasPieData = pieTotal > 0;
  const hasLineLabels = Array.isArray(labels) && labels.length > 0;

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (type === "pie" && !hasPieData) return undefined;
    if ((type === "line" || type === "bar") && !hasLineLabels) return undefined;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return undefined;

    const chart = new Chart(context, {
      type,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        normalized: true,
        color: textColor,
        layout: { padding: 8 },
        plugins: {
          legend: {
            display: true,
            position: type === "pie" ? "bottom" : "top",
            align: type === "pie" ? "center" : "end",
            labels: {
              color: textColor,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: "circle",
              padding: 18,
              font: { family: "Segoe UI, Arial, sans-serif", size: 11 },
            },
          },
          tooltip: { enabled: true, intersect: false, mode: "index" },
        },
        ...(type === "line" || type === "bar"
          ? {
              interaction: { intersect: false, mode: "index" },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: {
                    color: textColor,
                    font: { size: 10 },
                    maxRotation: 0,
                  },
                  border: { display: false },
                },
                y: {
                  beginAtZero: true,
                  suggestedMax: 1,
                  ticks: {
                    precision: 0,
                    color: textColor,
                    font: { size: 10 },
                  },
                  grid: { color: gridColor },
                  border: { display: false },
                },
              },
            }
          : {}),
      },
    });

    return () => chart.destroy();
  }, [type, chartData, hasPieData, hasLineLabels, textColor, gridColor]);

  return (
    <div
      className={`chart-canvas-wrap ${
        type === "pie" ? "pie-canvas-wrap" : "trend-canvas-wrap"
      }`}
    >
      {type === "pie" && !hasPieData ? (
        <div className="chart-no-data" role="status">
          <span className="chart-no-data-ring" aria-hidden="true" />
          <strong>No attendance data yet</strong>
          <span>
            {emptyText ||
              "Present, Absent, and Late totals will appear here after attendance is recorded."}
          </span>
        </div>
      ) : (type === "line" || type === "bar") && !hasLineLabels ? (
        <div className="chart-no-data chart-no-data-line" role="status">
          <span className="chart-no-data-icon" aria-hidden="true">↗</span>
          <strong>No trend data yet</strong>
          <span>
            {emptyText ||
              "The trend chart will appear when attendance records are available."}
          </span>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={
            type === "pie"
              ? "Attendance distribution pie chart"
              : "Attendance trend line chart"
          }
          role="img"
        />
      )}
    </div>
  );
}

function AttendancePieChart({ stats, theme }) {
  const labels = useMemo(() => ["Present", "Absent", "Late"], []);

  const datasets = useMemo(
    () => [
      {
        label: "Attendance",
        data: [
          Number(stats?.Present || 0),
          Number(stats?.Absent || 0),
          Number(stats?.Late || 0),
        ],
        backgroundColor: ["#2f9e62", "#e03e5a", "#e8a317"],
        hoverBackgroundColor: ["#25824f", "#c92e49", "#c98a08"],
        borderColor:
          theme === "dark"
            ? ["#1c293d", "#1c293d", "#1c293d"]
            : ["#ffffff", "#ffffff", "#ffffff"],
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
    [stats?.Present, stats?.Absent, stats?.Late, theme]
  );

  return (
    <ChartCanvas
      type="pie"
      labels={labels}
      datasets={datasets}
      theme={theme}
      emptyText="No attendance has been recorded for this class today."
    />
  );
}

function AttendanceTrendChart({ trend, theme }) {
  const labels = useMemo(
    () => (trend || []).map((item) => item.label || item.date || ""),
    [trend]
  );

  const datasets = useMemo(
    () => [
      {
        label: "Present",
        data: (trend || []).map((item) => Number(item.Present || 0)),
        borderColor: "#2f9e62",
        backgroundColor: "rgba(47,158,98,0.14)",
        tension: 0.32,
        fill: false,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: "#2f9e62",
        pointBorderColor: theme === "dark" ? "#1c293d" : "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "Absent",
        data: (trend || []).map((item) => Number(item.Absent || 0)),
        borderColor: "#e03e5a",
        backgroundColor: "rgba(224,62,90,0.12)",
        tension: 0.32,
        fill: false,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: "#e03e5a",
        pointBorderColor: theme === "dark" ? "#1c293d" : "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "Late",
        data: (trend || []).map((item) => Number(item.Late || 0)),
        borderColor: "#e8a317",
        backgroundColor: "rgba(232,163,23,0.12)",
        tension: 0.32,
        fill: false,
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: "#e8a317",
        pointBorderColor: theme === "dark" ? "#1c293d" : "#ffffff",
        pointBorderWidth: 2,
      },
    ],
    [trend, theme]
  );

  return (
    <ChartCanvas
      type="line"
      labels={labels}
      datasets={datasets}
      theme={theme}
      emptyText="The last seven days will appear here when attendance records are available."
    />
  );
}

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const DAY_LABELS = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

function parseClassDays(value) {
  return String(value || "")
    .split(",")
    .map((day) => day.trim().slice(0, 3).toUpperCase())
    .filter((day) => DAY_ORDER.includes(day));
}

function formatClockTime(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function splitLoginDateTime(value) {
  const [datePart, timePart] = String(value || "").split(" ");
  const dateMatch = (datePart || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  let dateText = datePart || "—";
  if (dateMatch) {
    dateText = new Date(
      Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    ).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return {
    date: dateText,
    time: timePart ? formatClockTime(timePart) : "—",
  };
}

function StudentSchedule({ classes = [], search = "", showTeacher = true }) {
  const todayCode = new Date()
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Manila" })
    .slice(0, 3)
    .toUpperCase();

  const visible = classes.filter((item) =>
    [item.subject_code, item.subject_name, item.room, item.teacher_name].some(
      (value) => String(value || "").toLowerCase().includes(search)
    )
  );

  const byDay = DAY_ORDER.map((code) => ({
    code,
    items: visible
      .filter((item) => parseClassDays(item.class_days).includes(code))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
  })).filter((day) => day.items.length > 0);

  const unscheduled = visible.filter(
    (item) => parseClassDays(item.class_days).length === 0
  );

  if (visible.length === 0) {
    return (
      <section className="panel">
        <EmptyPanel
          title="No class schedule"
          text={
            search
              ? "Try another search term."
              : "Your schedule will appear when a class is assigned to you."
          }
        />
      </section>
    );
  }

  return (
    <div className="schedule-board">
      {byDay.map((day) => (
        <section
          className={`panel schedule-day ${day.code === todayCode ? "schedule-today" : ""}`}
          key={day.code}
        >
          <div className="panel-header-line">
            <div>
              <h2>{DAY_LABELS[day.code]}</h2>
              <p>{day.items.length} {day.items.length === 1 ? "class" : "classes"}</p>
            </div>
            {day.code === todayCode && <span className="date-chip">Today</span>}
          </div>

          <div className="schedule-list">
            {day.items.map((item) => (
              <article className="schedule-item" key={`${day.code}-${item.class_id}`}>
                <div className="schedule-time">
                  <strong>{formatClockTime(item.start_time) || "TBA"}</strong>
                  <span>{formatClockTime(item.end_time)}</span>
                </div>
                <div className="schedule-info">
                  <strong>{item.subject_name}</strong>
                  <span>
                    {item.subject_code}
                    {showTeacher ? ` · ${item.teacher_name || "Teacher not assigned"}` : ""}
                  </span>
                  <small>{item.room || "Room not assigned"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {unscheduled.length > 0 && (
        <section className="panel schedule-day">
          <div className="panel-header-line">
            <div>
              <h2>Schedule not set</h2>
              <p>Your teacher has not set class days for these subjects.</p>
            </div>
          </div>
          <div className="schedule-list">
            {unscheduled.map((item) => (
              <article className="schedule-item" key={`u-${item.class_id}`}>
                <div className="schedule-time">
                  <strong>{item.schedule_time || "TBA"}</strong>
                </div>
                <div className="schedule-info">
                  <strong>{item.subject_name}</strong>
                  <span>
                    {item.subject_code}
                    {showTeacher ? ` · ${item.teacher_name || "Teacher not assigned"}` : ""}
                  </span>
                  <small>{item.room || "Room not assigned"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeacherAbsenceRequests({
  appeals = [],
  loading,
  search = "",
  onDownload,
  onReview,
}) {
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [viewing, setViewing] = useState(null);

  const q = search.trim().toLowerCase();

  const filtered = appeals.filter((item) => {
    if (filter !== "All" && item.status !== filter) return false;
    return [item.student_name, item.student_email, item.subject_name, item.subject_code, item.reason].some(
      (value) => String(value || "").toLowerCase().includes(q)
    );
  });

  const selected =
    filtered.find((item) => item.appeal_id === selectedId) || filtered[0] || null;

  const pending = appeals.filter((item) => item.status === "Pending").length;

  return (
    <section className="panel data-panel">
      <div className="panel-header-line">
        <div>
          <h2>Student Absence Requests</h2>
          <p>
            Pick a request to read the full reason. Approved letters document
            the absence; the attendance status stays Absent.
          </p>
        </div>
        <span className="date-chip">{pending} pending</span>
      </div>

      <div className="absence-filter-row">
        {["All", "Pending", "Approved", "Rejected"].map((name) => (
          <button
            key={name}
            type="button"
            className={`absence-filter ${filter === name ? "active" : ""}`}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : appeals.length === 0 ? (
        <EmptyPanel
          title="No absence letters"
          text="Students' uploaded medical or excuse letters will appear here when they submit one for an Absent record."
        />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          title="No matching requests"
          text="Try a different filter or search term."
        />
      ) : (
        <div className="absence-request-layout">
          <div className="absence-request-list">
            {filtered.map((item) => (
              <button
                key={item.appeal_id}
                type="button"
                className={`absence-request-item ${
                  selected && selected.appeal_id === item.appeal_id ? "active" : ""
                }`}
                onClick={() => setSelectedId(item.appeal_id)}
              >
                <span className="person-initial">
                  {(item.student_name || "S")[0].toUpperCase()}
                </span>
                <span className="absence-request-summary">
                  <strong>{item.student_name}</strong>
                  <small>
                    {item.subject_name || item.subject_code} · {item.date}
                  </small>
                </span>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>

          {selected && (
            <article className="absence-request-detail">
              <header>
                <div className="person-cell">
                  <span className="person-initial">
                    {(selected.student_name || "S")[0].toUpperCase()}
                  </span>
                  <span>
                    <strong>{selected.student_name}</strong>
                    <small>{selected.student_email}</small>
                  </span>
                </div>
                <StatusBadge status={selected.status} />
              </header>

              <dl className="absence-detail-grid">
                <div>
                  <dt>Subject</dt>
                  <dd>
                    {selected.subject_name || "—"}
                    {selected.subject_code ? ` (${selected.subject_code})` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Absent date</dt>
                  <dd>{selected.date || "—"}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{selected.submitted_at || "—"}</dd>
                </div>
                <div>
                  <dt>Attendance record</dt>
                  <dd>{selected.current_status || "—"}</dd>
                </div>
              </dl>

              <div className="absence-detail-reason">
                <h3>Reason</h3>
                <p>{selected.reason || "No reason was provided."}</p>
              </div>

              <div className="absence-detail-actions">
                {selected.has_document ? (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setViewing(selected)}
                  >
                    View letter
                  </button>
                ) : (
                  <span className="muted-text">No letter uploaded</span>
                )}

                {selected.status === "Pending" ? (
                  <div className="absence-letter-actions">
                    <button
                      type="button"
                      className="absence-letter-approve"
                      onClick={() => onReview(selected, "Approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="absence-letter-reject"
                      onClick={() => onReview(selected, "Rejected")}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="muted-text">
                    This request was already reviewed.
                  </span>
                )}
              </div>
            </article>
          )}
        </div>
      )}

      {viewing && (
        <LetterViewer appeal={viewing} onClose={() => setViewing(null)} />
      )}
    </section>
  );
}

const ALL_DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function AdminClassManager({ search = "" }) {
  const emptyForm = {
    subject_code: "",
    subject_name: "",
    teacher_id: "",
    room: "",
    class_days: [],
    start_time: "",
    end_time: "",
  };

  const [data, setData] = useState({ classes: [], teachers: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [studentsClassId, setStudentsClassId] = useState(null);
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState("");

  const load = async () => {
    try {
      const result = await apiRequest("/api/admin/classes");
      setData({
        classes: result.classes || [],
        teachers: result.teachers || [],
        students: result.students || [],
      });
      setError("");
    } catch (err) {
      setError(err.message || "Could not load class schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.class_id);
    setForm({
      subject_code: item.subject_code || "",
      subject_name: item.subject_name || "",
      teacher_id: item.teacher_id ? String(item.teacher_id) : "",
      room: item.room || "",
      class_days: parseClassDays(item.class_days),
      start_time: String(item.start_time || "").slice(0, 5),
      end_time: String(item.end_time || "").slice(0, 5),
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleDay = (code) => {
    setForm((current) => ({
      ...current,
      class_days: current.class_days.includes(code)
        ? current.class_days.filter((day) => day !== code)
        : [...current.class_days, code],
    }));
  };

  const saveClass = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.start_time || !form.end_time) {
      setFormError(
        "Enter a valid start time and end time (hour 1–12, minutes 00–59)."
      );
      return;
    }

    if (form.end_time <= form.start_time) {
      setFormError("The end time must be later than the start time.");
      return;
    }

    if (form.class_days.length === 0) {
      setFormError("Choose at least one class day.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        subject_code: form.subject_code.trim(),
        subject_name: form.subject_name.trim(),
        teacher_id: Number(form.teacher_id),
        room: form.room.trim(),
        class_days: form.class_days,
        start_time: form.start_time,
        end_time: form.end_time,
      };

      const result = editingId
        ? await apiRequest("/api/admin/classes/update", {
            method: "POST",
            body: JSON.stringify({ ...payload, class_id: editingId }),
          })
        : await apiRequest("/api/admin/classes", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setFormOpen(false);
      setMessage(result.message || "Class saved.");
      await load();
    } catch (err) {
      setFormError(err.message || "Could not save the class.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/admin/classes/delete", {
        method: "POST",
        body: JSON.stringify({ class_id: deleteTarget.class_id }),
      });

      setMessage(result.message || "Class deleted.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setError(err.message || "Could not delete the class.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const studentsClass =
    data.classes.find((item) => item.class_id === studentsClassId) || null;

  const assignable = studentsClass
    ? data.students.filter(
        (student) =>
          !studentsClass.students.some(
            (enrolled) => enrolled.user_id === student.user_id
          )
      )
    : [];

  const assignStudent = async () => {
    if (!studentsClass || !assignStudentId) return;

    setAssignBusy(true);
    setAssignError("");

    try {
      await apiRequest("/api/admin/classes/enroll", {
        method: "POST",
        body: JSON.stringify({
          class_id: studentsClass.class_id,
          student_id: Number(assignStudentId),
        }),
      });

      setAssignStudentId("");
      await load();
    } catch (err) {
      setAssignError(err.message || "Could not assign the student.");
    } finally {
      setAssignBusy(false);
    }
  };

  const removeStudent = async (student) => {
    const name = `${student.first_name} ${student.last_name}`.trim();

    if (
      !window.confirm(
        `Remove ${name} from ${studentsClass.subject_name}? Their past attendance records will be kept.`
      )
    ) {
      return;
    }

    setAssignError("");

    try {
      await apiRequest("/api/admin/classes/unenroll", {
        method: "POST",
        body: JSON.stringify({
          class_id: studentsClass.class_id,
          student_id: student.user_id,
        }),
      });

      await load();
    } catch (err) {
      setAssignError(err.message || "Could not remove the student.");
    }
  };

  const q = search.trim().toLowerCase();

  const visible = data.classes.filter((item) =>
    [
      item.subject_code,
      item.subject_name,
      item.teacher_name,
      item.room,
      item.schedule_time,
    ].some((value) => String(value || "").toLowerCase().includes(q))
  );

  return (
    <>
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

      <section className="panel admin-section-panel">
        <div className="panel-header-line">
          <div>
            <h2>Class Schedules</h2>
            <p>Create schedules, assign teachers, and assign students to subjects.</p>
          </div>

          <button
            type="button"
            className="profile-settings-save"
            onClick={openCreate}
            disabled={loading}
          >
            + New Class
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : visible.length === 0 ? (
          <EmptyPanel
            title="No class schedules"
            text={q ? "Try another search term." : "Create a class to get started."}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Days</th>
                  <th>Time</th>
                  <th>Room</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((item) => (
                  <tr key={item.class_id}>
                    <td>
                      <div className="subject-cell">
                        <strong>{item.subject_name}</strong>
                        <small>{item.subject_code}</small>
                      </div>
                    </td>
                    <td>{item.teacher_name || "—"}</td>
                    <td>
                      {parseClassDays(item.class_days)
                        .map((day) => day.charAt(0) + day.slice(1).toLowerCase())
                        .join(", ") || "—"}
                    </td>
                    <td>
                      {item.start_time
                        ? `${formatClockTime(item.start_time)} – ${formatClockTime(item.end_time)}`
                        : "—"}
                    </td>
                    <td>{item.room || "—"}</td>
                    <td>{item.student_count}</td>
                    <td>
                      <div className="note-row-actions">
                        <button
                          type="button"
                          className="note-edit-button"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="note-edit-button"
                          onClick={() => {
                            setAssignError("");
                            setAssignStudentId("");
                            setStudentsClassId(item.class_id);
                          }}
                        >
                          Students
                        </button>
                        <button
                          type="button"
                          className="account-delete-button"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
          <form className="portal-modal" onSubmit={saveClass}>
            <h2>{editingId ? "Edit Class Schedule" : "New Class Schedule"}</h2>

            {formError && (
              <div className="portal-alert error-alert">
                <span>{formError}</span>
              </div>
            )}

            <div className="account-create-grid">
              <div className="profile-settings-field">
                <label htmlFor="class-code">Subject code</label>
                <input
                  id="class-code"
                  name="subject_code"
                  value={form.subject_code}
                  onChange={handleChange}
                  maxLength={50}
                  required
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="class-name">Subject name</label>
                <input
                  id="class-name"
                  name="subject_name"
                  value={form.subject_name}
                  onChange={handleChange}
                  maxLength={150}
                  required
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="class-teacher">Teacher</label>
                <select
                  id="class-teacher"
                  name="teacher_id"
                  value={form.teacher_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose teacher</option>
                  {data.teachers.map((teacher) => (
                    <option key={teacher.user_id} value={String(teacher.user_id)}>
                      {teacher.first_name} {teacher.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="profile-settings-field">
                <label htmlFor="class-room">Room</label>
                <input
                  id="class-room"
                  name="room"
                  value={form.room}
                  onChange={handleChange}
                  maxLength={100}
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="class-start">Start time</label>
                <TimeField
                  id="class-start"
                  label="Start time"
                  value={form.start_time}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, start_time: value }))
                  }
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="class-end">End time</label>
                <TimeField
                  id="class-end"
                  label="End time"
                  value={form.end_time}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, end_time: value }))
                  }
                />
              </div>
            </div>

            <div className="profile-settings-field">
              <label>Class days</label>
              <div className="day-picker">
                {ALL_DAY_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`day-chip ${form.class_days.includes(code) ? "active" : ""}`}
                    onClick={() => toggleDay(code)}
                  >
                    {code.charAt(0) + code.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="profile-settings-save"
                disabled={saving}
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Class"}
              </button>
            </div>
          </form>
        </div>
      )}

      {studentsClass && (
        <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="portal-modal">
            <h2>
              Students · {studentsClass.subject_code} {studentsClass.subject_name}
            </h2>

            {assignError && (
              <div className="portal-alert error-alert">
                <span>{assignError}</span>
              </div>
            )}

            <div className="assign-row">
              <select
                className="class-select"
                value={assignStudentId}
                onChange={(event) => setAssignStudentId(event.target.value)}
                aria-label="Student to assign"
              >
                <option value="">
                  {assignable.length ? "Choose student to assign" : "All students are assigned"}
                </option>
                {assignable.map((student) => (
                  <option key={student.user_id} value={String(student.user_id)}>
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="profile-settings-save"
                disabled={!assignStudentId || assignBusy}
                onClick={assignStudent}
              >
                {assignBusy ? "Assigning…" : "Assign"}
              </button>
            </div>

            {studentsClass.students.length === 0 ? (
              <EmptyPanel
                title="No students assigned"
                text="Assigned students will appear here."
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsClass.students.map((student) => (
                      <tr key={student.user_id}>
                        <td>
                          {student.first_name} {student.last_name}
                        </td>
                        <td>{student.email}</td>
                        <td>
                          <button
                            type="button"
                            className="account-delete-button"
                            onClick={() => removeStudent(student)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                onClick={() => setStudentsClassId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="portal-modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="portal-modal portal-modal-small">
            <h2>Delete this class?</h2>
            <p>
              <strong>
                {deleteTarget.subject_code} {deleteTarget.subject_name}
              </strong>{" "}
              and its {deleteTarget.student_count} student assignment(s) will be
              removed. This cannot be undone.
            </p>
            <p className="muted-text">
              Classes that already have attendance records cannot be deleted.
            </p>

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="account-delete-button"
                disabled={deleteBusy}
                onClick={confirmDelete}
              >
                {deleteBusy ? "Deleting…" : "Yes, delete class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AdminTransferRequests({ search = "" }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const result = await apiRequest("/api/admin/transfers");
      setRequests(result.requests || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load transfer requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (request, status) => {
    const verb = status === "Approved" ? "Approve" : "Reject";

    if (
      !window.confirm(
        `${verb} moving ${request.student_name} from ${request.from_class} to ${request.to_class}?`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/admin/transfers/review", {
        method: "POST",
        body: JSON.stringify({ request_id: request.request_id, status }),
      });

      setMessage(result.message || "Request updated.");
      await load();
    } catch (err) {
      setError(err.message || "Could not update the request.");
    }
  };

  const q = search.trim().toLowerCase();

  const visible = requests.filter((item) =>
    [item.student_name, item.teacher_name, item.from_class, item.to_class, item.reason].some(
      (value) => String(value || "").toLowerCase().includes(q)
    )
  );

  return (
    <section className="panel admin-section-panel">
      <div className="panel-header-line">
        <div>
          <h2>Student Transfer Requests</h2>
          <p>Teachers request moving a student to another class. Approving moves the student.</p>
        </div>

        <button type="button" className="text-action" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="portal-alert error-alert">
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="portal-alert notice-alert">
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyPanel
          title="No transfer requests"
          text="Requests from teachers will appear here."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>From</th>
                <th>To</th>
                <th>Requested By</th>
                <th>Reason</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((item) => (
                <tr key={item.request_id}>
                  <td>{item.student_name}</td>
                  <td>{item.from_class}</td>
                  <td>{item.to_class}</td>
                  <td>{item.teacher_name}</td>
                  <td>{item.reason || "—"}</td>
                  <td>{item.requested_at || "—"}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.status === "Pending" ? (
                      <div className="note-row-actions">
                        <button
                          type="button"
                          className="absence-letter-approve"
                          onClick={() => review(item, "Approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="absence-letter-reject"
                          onClick={() => review(item, "Rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="muted-text">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TeacherTransferRequests() {
  const [data, setData] = useState({ my_classes: [], all_classes: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    from_class_id: "",
    student_id: "",
    to_class_id: "",
    reason: "",
  });

  const load = async () => {
    try {
      const result = await apiRequest("/api/teacher/transfers");
      setData({
        my_classes: result.my_classes || [],
        all_classes: result.all_classes || [],
        requests: result.requests || [],
      });
      setError("");
    } catch (err) {
      setError(err.message || "Could not load transfer requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fromClass = data.my_classes.find(
    (item) => String(item.class_id) === form.from_class_id
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "from_class_id" ? { student_id: "", to_class_id: "" } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/teacher/transfers", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(form.student_id),
          from_class_id: Number(form.from_class_id),
          to_class_id: Number(form.to_class_id),
          reason: form.reason.trim(),
        }),
      });

      setMessage(result.message || "Transfer request sent.");
      setForm({ from_class_id: "", student_id: "", to_class_id: "", reason: "" });
      await load();
    } catch (err) {
      setError(err.message || "Could not send the request.");
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (request) => {
    if (!window.confirm(`Cancel the transfer request for ${request.student_name}?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/teacher/transfers/cancel", {
        method: "POST",
        body: JSON.stringify({ request_id: request.request_id }),
      });

      setMessage(result.message || "Request cancelled.");
      await load();
    } catch (err) {
      setError(err.message || "Could not cancel the request.");
    }
  };

  return (
    <>
      <section className="panel">
        <PageHeading
          title="Request Student Transfer"
          subtitle="Ask the administrator to move a student from one of your classes to another class."
        />

        {error && (
          <div className="portal-alert error-alert">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="portal-alert notice-alert">
            <span>{message}</span>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : (
          <form className="account-create-form" onSubmit={submit}>
            <div className="account-create-grid">
              <div className="profile-settings-field">
                <label htmlFor="transfer-from">Current class</label>
                <select
                  id="transfer-from"
                  name="from_class_id"
                  value={form.from_class_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose your class</option>
                  {data.my_classes.map((item) => (
                    <option key={item.class_id} value={String(item.class_id)}>
                      {item.subject_code} — {item.subject_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="profile-settings-field">
                <label htmlFor="transfer-student">Student</label>
                <select
                  id="transfer-student"
                  name="student_id"
                  value={form.student_id}
                  onChange={handleChange}
                  disabled={!fromClass}
                  required
                >
                  <option value="">Choose student</option>
                  {(fromClass?.students || []).map((student) => (
                    <option key={student.user_id} value={String(student.user_id)}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="profile-settings-field">
                <label htmlFor="transfer-to">Move to class</label>
                <select
                  id="transfer-to"
                  name="to_class_id"
                  value={form.to_class_id}
                  onChange={handleChange}
                  disabled={!fromClass}
                  required
                >
                  <option value="">Choose new class</option>
                  {data.all_classes
                    .filter((item) => String(item.class_id) !== form.from_class_id)
                    .map((item) => (
                      <option key={item.class_id} value={String(item.class_id)}>
                        {item.subject_code} — {item.subject_name}
                        {item.teacher_name ? ` (${item.teacher_name})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="profile-settings-field">
              <label htmlFor="transfer-reason">Reason (optional)</label>
              <textarea
                id="transfer-reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={3}
                maxLength={500}
                placeholder="Why should this student be moved?"
              />
            </div>

            <div className="profile-settings-actions">
              <button
                type="submit"
                className="profile-settings-save"
                disabled={saving || !form.student_id || !form.to_class_id}
              >
                {saving ? "Sending…" : "Send Request"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel">
        <div className="panel-header-line">
          <div>
            <h2>My Transfer Requests</h2>
            <p>Approved requests move the student automatically.</p>
          </div>

          <button type="button" className="text-action" onClick={load}>
            ↻ Refresh
          </button>
        </div>

        {data.requests.length === 0 ? (
          <EmptyPanel
            title="No transfer requests"
            text="Requests you send will appear here with their status."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {data.requests.map((item) => (
                  <tr key={item.request_id}>
                    <td>{item.student_name}</td>
                    <td>{item.from_class}</td>
                    <td>{item.to_class}</td>
                    <td>{item.reason || "—"}</td>
                    <td>{item.requested_at || "—"}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {item.status === "Pending" ? (
                        <button
                          type="button"
                          className="account-delete-button"
                          onClick={() => cancelRequest(item)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AdminRfidManager({ search = "", onRefresh }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("All");

  const [target, setTarget] = useState(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const codeInputRef = useRef(null);

  const load = async () => {
    try {
      const result = await apiRequest("/api/admin/rfid");
      setStudents(result.users || result.students || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load RFID cards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (target && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [target]);

  const openAssign = (student) => {
    setModalError("");
    setCode(student.rfid_uid || "");
    setTarget(student);
  };

  const saveCard = async (event) => {
    event.preventDefault();
    if (!target) return;

    setSaving(true);
    setModalError("");

    try {
      const result = await apiRequest("/api/admin/rfid/assign", {
        method: "POST",
        body: JSON.stringify({
          user_id: target.user_id,
          rfid_uid: code.trim(),
        }),
      });

      setTarget(null);
      setMessage(result.message || "RFID card saved.");
      await load();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.message || "Could not save the RFID card.");
    } finally {
      setSaving(false);
    }
  };

  const removeCard = async (student) => {
    const name = `${student.first_name} ${student.last_name}`.trim();

    if (!window.confirm(`Remove the RFID card from ${name}? They will not be able to use RFID attendance until a card is assigned again.`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/admin/rfid/assign", {
        method: "POST",
        body: JSON.stringify({ user_id: student.user_id, rfid_uid: "" }),
      });

      setMessage(result.message || "RFID card removed.");
      await load();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not remove the RFID card.");
    }
  };

  const q = search.trim().toLowerCase();

  const visible = students.filter((student) => {
    if (filter === "Assigned" && !student.rfid_uid) return false;
    if (filter === "Unassigned" && student.rfid_uid) return false;

    return [
      student.first_name,
      student.last_name,
      student.email,
      student.rfid_uid,
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });

  const assignedCount = students.filter((student) => student.rfid_uid).length;

  return (
    <section className="panel admin-section-panel">
      <div className="panel-header-line">
        <div>
          <h2>RFID Cards</h2>
          <p>
            Register RFID cards for students, teachers, and staff. Students use the class kiosk; teachers and staff use the gate kiosk.
          </p>
        </div>

        <span className="date-chip">
          {assignedCount} of {students.length} accounts registered
        </span>
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

      <div className="absence-filter-row">
        {["All", "Assigned", "Unassigned"].map((name) => (
          <button
            key={name}
            type="button"
            className={`absence-filter ${filter === name ? "active" : ""}`}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyPanel
          title="No accounts found"
          text={
            q || filter !== "All"
              ? "Try another filter or search term."
              : "Student and teacher accounts will appear here once they are created."
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Email</th>
                <th>Card</th>
                <th>RFID Code</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((student) => (
                <tr key={student.user_id}>
                  <td>
                    {student.first_name} {student.last_name}
                  </td>
                  <td><span className="rfid-badge">{student.role || "student"}</span></td>
                  <td>{student.email}</td>
                  <td>
                    <span
                      className={`rfid-badge ${
                        student.rfid_uid ? "rfid-badge-open" : "rfid-badge-closed"
                      }`}
                    >
                      {student.rfid_uid ? "Registered" : "No card"}
                    </span>
                  </td>
                  <td>
                    {student.rfid_uid ? (
                      <code className="rfid-code">{student.rfid_uid}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="note-row-actions">
                      <button
                        type="button"
                        className="note-edit-button"
                        onClick={() => openAssign(student)}
                      >
                        {student.rfid_uid ? "Change" : "Assign"}
                      </button>

                      {student.rfid_uid && (
                        <button
                          type="button"
                          className="account-delete-button"
                          onClick={() => removeCard(student)}
                        >
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
        <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
          <form className="portal-modal portal-modal-small" onSubmit={saveCard}>
            <h2>
              {target.rfid_uid ? "Change" : "Assign"} RFID card
            </h2>
            <p>
              <strong>
                {target.first_name} {target.last_name}
              </strong>
              <br />
              <small className="muted-text">{target.email}</small>
            </p>

            {modalError && (
              <div className="portal-alert error-alert">
                <span>{modalError}</span>
              </div>
            )}

            <div className="profile-settings-field">
              <label htmlFor="rfid-code-input">RFID code</label>
              <input
                id="rfid-code-input"
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Tap the card on the reader…"
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <small className="rfid-hint">
                Click the field, then tap the card on the USB reader. Most
                readers type the code and press Enter, which saves it. You can
                also type the code manually. Letters are saved in capitals.
              </small>
            </div>

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                disabled={saving}
                onClick={() => setTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="profile-settings-save"
                disabled={saving || !code.trim()}
              >
                {saving ? "Saving…" : "Save Card"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function EmptyPanel({ title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">▣</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ClassSelect({ classes, value, onChange }) {
  return (
    <select
      className="class-select"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Select class"
    >
      <option value="">Select class</option>
      {(classes || []).map((item) => (
        <option key={item.class_id} value={String(item.class_id)}>
          {item.subject_code ? `${item.subject_code} — ` : ""}
          {item.subject_name || `Class ${item.class_id}`}
        </option>
      ))}
    </select>
  );
}

function TeacherPortal({ user, theme, onToggleTheme, onLogout, onUserUpdated }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(getManilaDate());
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});
  const [teacherAppeals, setTeacherAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (classId) params.set("class_id", classId);
    params.set("date", attendanceDate);
    const query = `?${params.toString()}`;

    apiRequest(`/api/teacher/dashboard${query}`)
      .then((data) => {
        if (!active) return;
        setPayload(data);
        setError("");
        const selectedId = String(data.selected_class?.class_id || "");
        if (!classId && selectedId) setClassId(selectedId);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load the teacher portal.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [classId, attendanceDate, refreshId]);

  useEffect(() => {
    if (activePage !== "appeals") return undefined;

    let active = true;
    setAppealsLoading(true);
    setAppealsError("");

    apiRequest("/api/teacher/appeals")
      .then((data) => {
        if (active) setTeacherAppeals(data.appeals || []);
      })
      .catch((err) => {
        if (active) {
          setAppealsError(
            err.message || "Could not load absence letters."
          );
        }
      })
      .finally(() => {
        if (active) setAppealsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activePage, refreshId]);

  const classes = payload?.classes || [];
  const selectedClass = payload?.selected_class || null;
  const students = payload?.students || [];
  const stats = payload?.stats || {
    Present: 0,
    Absent: 0,
    Late: 0,
  };
  const trend = payload?.trend || [];
  const query = search.trim().toLowerCase();

  const filteredClasses = classes.filter((item) =>
    [
      item.subject_code,
      item.subject_name,
      item.schedule_time,
      item.room,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    )
  );

  const filteredStudents = students.filter((item) =>
    [
      item.first_name,
      item.last_name,
      item.email,
      item.user_id,
      item.status,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    )
  );
  const visibleAttendanceTotals = filteredStudents.reduce((totals, student) => {
    if (["Present", "Absent", "Late"].includes(student.status)) totals[student.status]++;
    return totals;
  }, { Present: 0, Absent: 0, Late: 0 });

  const refresh = () => {
    setRefreshing(true);
    setRefreshId((id) => id + 1);
  };

  const saveAttendance = async (student) => {
    const draftKey = `${student.user_id}_${student.date || attendanceDate}`;
    const status = drafts[draftKey] ?? student.status ?? "";

    if (!selectedClass?.class_id) {
      setNotice("Select a class before saving attendance.");
      return;
    }

    if (!status) {
      setNotice("Choose Present, Absent, or Late before saving.");
      return;
    }

    setNotice("");

    try {
      const result = await apiRequest("/api/teacher/attendance", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(selectedClass.class_id),
          student_id: Number(student.user_id),
          date: student.date || attendanceDate,
          status,
        }),
      });

      setNotice(result.message || "Attendance saved successfully.");

      setDrafts((previous) => {
        const copy = { ...previous };
        delete copy[draftKey];
        return copy;
      });

      setRefreshId((id) => id + 1);
    } catch (err) {
      setNotice(err.message || "Could not save attendance.");
    }
  };

  const reviewAbsenceLetter = async (appeal, status) => {
    const verb = status === "Approved" ? "approve" : "reject";

    if (
      !window.confirm(
        `Do you want to ${verb} this absence letter? The attendance will remain Absent.`
      )
    ) {
      return;
    }

    setNotice("");

    try {
      const result = await apiRequest("/api/teacher/appeals/review", {
        method: "POST",
        body: JSON.stringify({
          appeal_id: Number(appeal.appeal_id),
          status,
        }),
      });

      setNotice(result.message || "Absence letter reviewed.");
      setRefreshId((id) => id + 1);
    } catch (err) {
      setNotice(err.message || "Could not review the letter.");
    }
  };

  const downloadLetter = async (appeal) => {
    try {
      await downloadAppealLetter(appeal.appeal_id);
    } catch (err) {
      setNotice(err.message || "Could not open the uploaded letter.");
    }
  };

  return (
    <PortalShell
      role="teacher"
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
      activePage={activePage}
      setActivePage={setActivePage}
      search={search}
      setSearch={setSearch}
    >
      <div className="portal-content">
        {error && (
          <div className="portal-alert error-alert">
            <strong>Dashboard could not load.</strong>
            <span>{error}</span>
            <button type="button" onClick={refresh}>Retry</button>
          </div>
        )}

        {notice && (
          <div className="portal-alert notice-alert">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {loading && !payload ? <LoadingState /> : <>
          {activePage === "dashboard" && <>
            <PageHeading
              title="Main Home Page"
              subtitle={`Today's attendance overview${selectedClass ? ` · ${selectedClass.subject_name}` : ""}`}
              right={
                <div className="toolbar-controls">
                  <ClassSelect
                    classes={classes}
                    value={selectedClass?.class_id || classId}
                    onChange={setClassId}
                  />
                  <button
                    className="refresh-button"
                    type="button"
                    onClick={refresh}
                    disabled={refreshing}
                  >
                    {refreshing ? "Refreshing…" : "↻ Refresh"}
                  </button>
                </div>
              }
            />

            <div className="teacher-dashboard-grid">
              <section className="stats-column" aria-label="Attendance totals">
                <StatCard status="Present" value={stats.Present} />
                <StatCard status="Absent" value={stats.Absent} />
                <StatCard status="Late" value={stats.Late} />
              </section>

              <section className="teacher-charts-column">
                <article className="panel chart-panel pie-panel">
                  <div className="chart-panel-heading">
                    <div>
                      <h2>Attendance Overview</h2>
                      <p>Present, absent, and late today</p>
                    </div>
                    <span className="chart-kind-label">PIE CHART</span>
                  </div>
                  {!selectedClass ? (
                    <EmptyPanel
                      title="No classes assigned"
                      text="Classes assigned to your teacher account will appear here."
                    />
                  ) : (
                    <AttendancePieChart stats={stats} theme={theme} />
                  )}
                </article>

                <article className="panel chart-panel trend-panel">
                  <div className="chart-panel-heading">
                    <div>
                      <h2>Attendance Trends</h2>
                      <p>Daily attendance for the last seven days</p>
                    </div>
                    <span className="chart-kind-label">LINE CHART</span>
                  </div>
                  {!selectedClass ? (
                    <EmptyPanel
                      title="No class selected"
                      text="Select a class to view attendance trends."
                    />
                  ) : (
                    <AttendanceTrendChart trend={trend} theme={theme} />
                  )}
                </article>
              </section>
            </div>

            <section className="panel class-strip-panel">
              <div className="panel-header-line">
                <div>
                  <h2>Your Classes</h2>
                  <p>Choose any assigned class to view or mark attendance.</p>
                </div>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setActivePage("classes")}
                >
                  View classes →
                </button>
              </div>

              {classes.length === 0 ? (
                <EmptyPanel
                  title="No classes assigned"
                  text="Check the classes table and confirm that teacher_id matches your user_id."
                />
              ) : (
                <div className="class-strip-grid">
                  {classes.slice(0, 3).map((item) => (
                    <button
                      className={`class-strip-card ${
                        String(item.class_id) === String(selectedClass?.class_id)
                          ? "selected"
                          : ""
                      }`}
                      type="button"
                      key={item.class_id}
                      onClick={() => setClassId(String(item.class_id))}
                    >
                      <span className="class-strip-icon">
                        <NavIcon name="classes" />
                      </span>
                      <span>
                        <strong>{item.subject_name}</strong>
                        <small>
                          {item.subject_code} · {item.schedule_time || "Schedule not set"}
                        </small>
                      </span>
                      <span className="class-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>}

          {activePage === "students" && <>
            <PageHeading
              title="Students"
              subtitle="Students enrolled in your selected class"
              right={
                <ClassSelect
                  classes={classes}
                  value={selectedClass?.class_id || classId}
                  onChange={setClassId}
                />
              }
            />

            {!selectedClass ? (
              <section className="panel">
                <EmptyPanel
                  title="No class selected"
                  text="Assign a class to your account before managing its students."
                />
              </section>
            ) : (
              <section className="panel data-panel">
                <div className="panel-header-line">
                  <div>
                    <h2>{selectedClass.subject_name}</h2>
                    <p>
                      {selectedClass.subject_code} · {filteredStudents.length} displayed students
                    </p>
                  </div>
                  <span className="date-chip">{payload?.date || "Today"}</span>
                </div>

                {filteredStudents.length === 0 ? (
                  <EmptyPanel
                    title="No students found"
                    text={query ? "Try another search term." : "No enrolled students were found for this class."}
                  />
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>Email</th>
                          <th>Today's Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.user_id}>
                            <td>
                              <div className="person-cell">
                                <span className="person-initial">
                                  {(student.first_name || "S")[0].toUpperCase()}
                                </span>
                                <span>
                                  <strong>
                                    {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student"}
                                  </strong>
                                  <small>Student</small>
                                </span>
                              </div>
                            </td>
                            <td>#{student.user_id}</td>
                            <td>{student.email}</td>
                            <td>
                              <StatusBadge status={student.status || "Not marked"} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>}

          {activePage === "notes" && (<>
            <PageHeading
              title="Student Notes"
              subtitle="Add important notes about your students. The administrator can review them."
            />

              <TeacherStudentNotes
                onRefresh={() => setRefreshId((id) => id + 1)}
              />
            </>
          )}

          {activePage === "classes" && <>
            <PageHeading
              title="Classes"
              subtitle="Your subjects and assigned class schedules"
              right={<span className="date-chip">{filteredClasses.length} classes</span>}
            />

            {filteredClasses.length === 0 ? (
              <section className="panel">
                <EmptyPanel
                  title="No classes found"
                  text={query ? "Try another search term." : "No classes are assigned to your teacher account yet."}
                />
              </section>
            ) : (
              <div className="class-card-grid">
                {filteredClasses.map((item) => (
                  <article className="class-card" key={item.class_id}>
                    <div className="class-card-top">
                      <span className="class-card-icon">
                        <NavIcon name="classes" />
                      </span>
                      <span className="class-id">CLASS #{item.class_id}</span>
                    </div>
                    <h3>{item.subject_name}</h3>
                    <p className="class-code">{item.subject_code}</p>
                    <div className="class-detail-line">
                      <span>◷ Schedule</span>
                      <strong>{item.schedule_time || "Not set"}</strong>
                    </div>
                    <div className="class-detail-line">
                      <span>⌖ Room</span>
                      <strong>{item.room || "Not set"}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => {
                        setClassId(String(item.class_id));
                        setActivePage("attendance");
                      }}
                    >
                      Open attendance <span>→</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>}

          {activePage === "attendance" && <>
            <PageHeading
              title="Attendance"
              subtitle="Mark or update today's attendance for enrolled students"
              right={
                <div className="toolbar-controls attendance-toolbar">
                  <ClassSelect
                    classes={classes}
                    value={selectedClass?.class_id || classId}
                    onChange={setClassId}
                  />
                  <label className="attendance-date-control">
                    <span>Attendance date</span>
                    <input type="date" value={attendanceDate === "all" ? getManilaDate() : attendanceDate} max={getManilaDate()} onChange={(event) => setAttendanceDate(event.target.value)} />
                  </label>
                  <button type="button" className={`absence-filter ${attendanceDate === "all" ? "active" : ""}`} onClick={() => setAttendanceDate("all")}>All</button>
                </div>
              }
            />

            {!selectedClass ? (
              <section className="panel">
                <EmptyPanel
                  title="Select a class"
                  text="Choose one of your assigned classes to load the student attendance list."
                />
              </section>
            ) : (
              <section className="panel data-panel">
                <div className="panel-header-line">
                  <div>
                    <h2>{selectedClass.subject_name}</h2>
                    <p>
                      {selectedClass.subject_code} · {selectedClass.schedule_time} · {selectedClass.room}
                    </p>
                  </div>
                  <span className="date-chip">{attendanceDate === "all" ? "All attendance dates" : attendanceDate}</span>
                </div>

                {filteredStudents.length === 0 ? (
                  <EmptyPanel
                    title="No enrolled students"
                    text="Enrollments for this class will appear here."
                  />
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Date</th>
                          <th>Current Status</th>
                          <th>Set Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={`${student.user_id}_${student.date || attendanceDate}_${student.attendance_id || "new"}`}>
                            <td>
                              <div className="person-cell">
                                <span className="person-initial">
                                  {(student.first_name || "S")[0].toUpperCase()}
                                </span>
                                <span>
                                  <strong>
                                    {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student"}
                                  </strong>
                                  <small>{student.email}</small>
                                </span>
                              </div>
                            </td>
                            <td>{student.date || attendanceDate}</td>
                            <td>
                              <StatusBadge status={student.status || "Not marked"} />
                            </td>
                            <td>
                              <select
                                className="status-select"
                                value={drafts[`${student.user_id}_${student.date || attendanceDate}`] ?? student.status ?? ""}
                                onChange={(event) =>
                                  setDrafts((previous) => ({
                                    ...previous,
                                    [`${student.user_id}_${student.date || attendanceDate}`]: event.target.value,
                                  }))
                                }
                                aria-label={`Status for ${student.email} on ${student.date || attendanceDate}`}
                              >
                                <option value="">Choose status</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="table-save-button"
                                onClick={() => saveAttendance(student)}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="attendance-total-strip">
                  <div><span>Present</span><strong>{visibleAttendanceTotals.Present}</strong></div>
                  <div><span>Absent</span><strong>{visibleAttendanceTotals.Absent}</strong></div>
                  <div><span>Late</span><strong>{visibleAttendanceTotals.Late}</strong></div>
                </div>
              </section>
            )}
          </>}

          {activePage === "appeals" && <>
            <PageHeading
              title="Absence Letters"
              subtitle="Review absence notices and supporting medical or excuse letters."
              right={
                <button
                  className="refresh-button"
                  type="button"
                  onClick={refresh}
                >
                  ↻ Refresh
                </button>
              }
            />

            {appealsError && (
              <div className="portal-alert error-alert">
                <span>{appealsError}</span>
              </div>
            )}

            <TeacherAbsenceRequests
              appeals={teacherAppeals}
              loading={appealsLoading}
              search={query}
              onDownload={downloadLetter}
              onReview={reviewAbsenceLetter}
            />
          </>}

          {activePage === "schedule" && <>
            <PageHeading
              title="Class Schedule"
              subtitle="Your weekly schedule for the subjects assigned to you."
            />

            <StudentSchedule
              classes={classes}
              search={query}
              showTeacher={false}
            />
          </>}

          {activePage === "transfers" && (
            <TeacherTransferRequests />
          )}

          {activePage === "settings" && (
            <ProfileSettings
              user={user}
              roleLabel="Teacher"
              onUserUpdated={onUserUpdated}
              onToggleTheme={onToggleTheme}
              theme={theme}
            />
          )}
        </>}
      </div>
    </PortalShell>
  );
}

function StudentPortal({
  user,
  theme,
  onToggleTheme,
  onLogout,
  onUserUpdated,
}) {
  const [activePage, setActivePage] = useState("home");
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshId, setRefreshId] = useState(0);
  const [attendanceNotice, setAttendanceNotice] = useState("");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [studentAppeals, setStudentAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState("");
  const [appealTarget, setAppealTarget] = useState(null);
  const [appealReason, setAppealReason] = useState("");
  const [medicalLetter, setMedicalLetter] = useState(null);
  const [appealBusy, setAppealBusy] = useState(false);

  useEffect(() => {
    let active = true;

    apiRequest("/api/student/dashboard")
      .then((data) => {
        if (active) {
          setPayload(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load student information.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshId]);

  useEffect(() => {
    if (activePage !== "appeals") return undefined;

    let active = true;
    setAppealsLoading(true);
    setAppealsError("");

    apiRequest("/api/student/appeals")
      .then((data) => {
        if (active) setStudentAppeals(data.appeals || []);
      })
      .catch((err) => {
        if (active) {
          setAppealsError(
            err.message || "Could not load your absence letters."
          );
        }
      })
      .finally(() => {
        if (active) setAppealsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activePage, refreshId]);

  const classes = payload?.classes || [];
  const attendance = payload?.attendance || [];
  const [attendanceClassId, setAttendanceClassId] = useState("");

  const q = search.trim().toLowerCase();

  const filteredClasses = classes.filter((item) =>
    [
      item.subject_code,
      item.subject_name,
      item.schedule_time,
      item.room,
      item.teacher_name,
    ].some((value) =>
      String(value || "").toLowerCase().includes(q)
    )
  );

  // My Attendance tab: records and totals for the selected class only.
  const scopedAttendance = attendance.filter(
    (item) =>
      !attendanceClassId ||
      String(item.class_id) === String(attendanceClassId)
  );

  const countStatus = (list, status) =>
    list.filter((item) => item.status === status).length;

  const stats = {
    Present: countStatus(scopedAttendance, "Present"),
    Absent: countStatus(scopedAttendance, "Absent"),
    Late: countStatus(scopedAttendance, "Late"),
  };

  const filteredAttendance = scopedAttendance.filter((item) =>
    [
      item.subject_code,
      item.subject_name,
      item.date,
      item.status,
      item.schedule_time,
    ].some((value) =>
      String(value || "").toLowerCase().includes(q)
    )
  );

  const fullName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.email;

  const today = payload?.date || getManilaDate();

  // Home only shows today's attendance, never the full history.
  const todayRecords = attendance.filter((item) => item.date === today);
  const todayStats = {
    Present: countStatus(todayRecords, "Present"),
    Absent: countStatus(todayRecords, "Absent"),
    Late: countStatus(todayRecords, "Late"),
  };

  const todayByClass = new Map(
    attendance
      .filter((item) => item.date === today)
      .map((item) => [String(item.class_id), item])
  );

  const submitManualAttendance = async (classItem, status) => {
    setAttendanceNotice("");
    setAttendanceBusy(true);

    try {
      const result = await apiRequest("/api/student/manual-attendance", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(classItem.class_id),
          status,
        }),
      });

      setAttendanceNotice(
        result.message || "Your attendance has been recorded."
      );

      setRefreshId((id) => id + 1);
    } catch (err) {
      setAttendanceNotice(
        err.message || "Could not record attendance."
      );
    } finally {
      setAttendanceBusy(false);
    }
  };

  const submitAbsenceLetter = async (event) => {
    event.preventDefault();

    if (!appealTarget) return;

    if (!medicalLetter) {
      setAttendanceNotice(
        "Choose your medical or excuse letter to upload."
      );
      return;
    }

    if (medicalLetter.size > 5 * 1024 * 1024) {
      setAttendanceNotice("The letter must be 5 MB or smaller.");
      return;
    }

    if (appealReason.trim().length < 10) {
      setAttendanceNotice(
        "Explain your absence in at least 10 characters."
      );
      return;
    }

    setAppealBusy(true);
    setAttendanceNotice("");

    const formData = new FormData();
    formData.append("attendance_id", String(appealTarget.attendance_id));
    formData.append("reason", appealReason.trim());
    formData.append("medical_letter", medicalLetter);

    try {
      const result = await apiRequest("/api/student/appeals", {
        method: "POST",
        body: formData,
      });

      setAttendanceNotice(result.message || "Absence letter submitted.");
      setAppealTarget(null);
      setAppealReason("");
      setMedicalLetter(null);
      setRefreshId((id) => id + 1);
    } catch (err) {
      setAttendanceNotice(
        err.message || "Could not submit your absence letter."
      );
    } finally {
      setAppealBusy(false);
    }
  };

  const [viewerAppeal, setViewerAppeal] = useState(null);

  const chooseLetterFile = (event) => {
    const file = event.target.files?.[0] || null;

    if (file && !isAllowedLetterFile(file)) {
      event.target.value = "";
      setMedicalLetter(null);
      setAttendanceNotice(
        "Only image (JPG, PNG) or document (PDF) files are allowed."
      );
      return;
    }

    setAttendanceNotice("");
    setMedicalLetter(file);
  };

  const deleteOwnAccount = async () => {
    const confirmed = window.confirm(
      "Permanently delete your account and attendance records? This cannot be undone."
    );

    if (!confirmed) return;

    const typed = window.prompt(
      "Type DELETE to confirm account deletion:"
    );

    if (typed !== "DELETE") {
      setAttendanceNotice("Account deletion cancelled.");
      return;
    }

    try {
      const result = await apiRequest("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({}),
      });

      window.alert(result.message || "Your account has been deleted.");

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      await onLogout();
    } catch (err) {
      setAttendanceNotice(
        err.message || "Could not delete your account."
      );
    }
  };

  return (
    <PortalShell
      role="student"
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
      activePage={activePage}
      setActivePage={setActivePage}
      search={search}
      setSearch={setSearch}
    >
      <div className="portal-content">
        {error && (
          <div className="portal-alert error-alert">
            <strong>Records could not load.</strong>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRefreshId((id) => id + 1)}
            >
              Retry
            </button>
          </div>
        )}

        {attendanceNotice && (
          <div className="portal-alert notice-alert">
            <span>{attendanceNotice}</span>
            <button
              type="button"
              onClick={() => setAttendanceNotice("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {loading && !payload ? <LoadingState /> : <>
          {activePage === "home" && <>
            <PageHeading
              title={new Date().toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "Asia/Manila",
              })}
              subtitle={`Welcome back, ${fullName}. Here's your attendance for today.`}
            />

            <div className="home-section-label">
              Today's attendance
              <small> · full history is in My Attendance</small>
            </div>

            <div className="student-stat-grid">
              <StatCard status="Present" value={todayStats.Present} />
              <StatCard status="Absent" value={todayStats.Absent} />
              <StatCard status="Late" value={todayStats.Late} />
            </div>

            <section className="panel student-home-panel">
              <div className="panel-header-line">
                <div>
                  <h2>My Classes & Schedule</h2>
                  <p>Classes associated with your student account</p>
                </div>
                <span className="date-chip">{classes.length} subjects</span>
              </div>

              {filteredClasses.length === 0 ? (
                <EmptyPanel
                  title="No enrolled classes"
                  text={
                    q
                      ? "Try another search term."
                      : "Your enrolled subjects will appear here when a class_enrollments record exists for your account."
                  }
                />
              ) : (
                <div className="timetable">
                  {filteredClasses.map((item) => {
                    const record = todayByClass.get(String(item.class_id));
                    const options = item.manual_options || {};

                    return (
                      <article className="timetable-slot" key={item.class_id}>
                        <div className="slot-time">
                          {item.schedule_time || "Schedule TBA"}
                        </div>
                        <div className="slot-details">
                          <div className="manual-attendance-class-info">
                            <strong>{item.subject_name}</strong>
                            <span>
                              {item.subject_code} · {item.teacher_name || "Teacher not assigned"}
                            </span>
                            <small>{item.room || "Room not assigned"}</small>

                            <p className="manual-attendance-hint">
                              {record
                                ? `Attendance recorded: ${record.status}`
                                : options.message ||
                                  "Your teacher needs to configure this class schedule before self-check is available."}
                            </p>
                          </div>

                          <div className="manual-attendance-actions">
                            {record ? (
                              <StatusBadge status={record.status} />
                            ) : (
                              <>
                                {options.can_present && (
                                  <button
                                    type="button"
                                    className="manual-attendance-button manual-present"
                                    disabled={attendanceBusy}
                                    onClick={() =>
                                      submitManualAttendance(item, "Present")
                                    }
                                  >
                                    {attendanceBusy
                                      ? "Saving…"
                                      : "Confirm Present · On Time"}
                                  </button>
                                )}

                                {options.can_late && (
                                  <button
                                    type="button"
                                    className="manual-attendance-button manual-late"
                                    disabled={attendanceBusy}
                                    onClick={() =>
                                      submitManualAttendance(item, "Late")
                                    }
                                  >
                                    {attendanceBusy ? "Saving…" : "Mark Late"}
                                  </button>
                                )}

                                {options.can_absent && (
                                  <button
                                    type="button"
                                    className="manual-attendance-button manual-absent"
                                    disabled={attendanceBusy}
                                    onClick={() =>
                                      submitManualAttendance(item, "Absent")
                                    }
                                  >
                                    {attendanceBusy ? "Saving…" : "Report Absent"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>}

          {activePage === "subjects" && <>
            <PageHeading
              title="My Class Calendar"
              subtitle="View your enrolled classes by date, time, and room."
              right={
                <button
                className="refresh-button"
                type="button"
                onClick={() => setRefreshId((id) => id + 1)}
                  >
                  ↻ Refresh
                </button> 
              }
            />

            <StudentCalendar classes={filteredClasses} />
          </>}
          {activePage === "subjects" && <>
          
            {filteredClasses.length === 0 ? (
              <section className="panel">
                <EmptyPanel
                  title="No subjects found"
                  text={q ? "Try another search term." : "Subjects will appear when you are enrolled in a class."}
                />
              </section>
            ) : (
              <div className="class-card-grid">
                {filteredClasses.map((item) => (
                  <article className="class-card" key={item.class_id}>
                    <div className="class-card-top">
                      <span className="class-card-icon">
                        <NavIcon name="subjects" />
                      </span>
                      <span className="class-id">CLASS #{item.class_id}</span>
                    </div>
                    <h3>{item.subject_name}</h3>
                    <p className="class-code">{item.subject_code}</p>
                    <div className="class-detail-line">
                      <span>Teacher</span>
                      <strong>{item.teacher_name || "Not assigned"}</strong>
                    </div>
                    <div className="class-detail-line">
                      <span>Schedule</span>
                      <strong>{item.schedule_time || "Not set"}</strong>
                    </div>
                    <div className="class-detail-line">
                      <span>Room</span>
                      <strong>{item.room || "Not set"}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setActivePage("attendance")}
                    >
                      View attendance <span>→</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>}

          {activePage === "schedule" && <>
            <PageHeading
              title="Class Schedule"
              subtitle="Your weekly subject schedule, grouped by day."
              right={
                <button
                  className="refresh-button"
                  type="button"
                  onClick={() => setRefreshId((id) => id + 1)}
                >
                  ↻ Refresh
                </button>
              }
            />

            <StudentSchedule classes={classes} search={q} />
          </>}

          {activePage === "attendance" && <>
            <PageHeading
              title="My Attendance"
              subtitle={
                attendanceClassId
                  ? "Attendance history for the selected class"
                  : "Your attendance history from all enrolled classes"
              }
              right={
                <div className="attendance-class-picker">
                  <select
                    className="class-select"
                    value={attendanceClassId}
                    onChange={(event) => setAttendanceClassId(event.target.value)}
                    aria-label="Select class"
                  >
                    <option value="">All classes</option>
                    {classes.map((item) => (
                      <option key={item.class_id} value={String(item.class_id)}>
                        {item.subject_code} — {item.subject_name}
                      </option>
                    ))}
                  </select>
                  <span className="date-chip">{filteredAttendance.length} records</span>
                </div>
              }
            />

            <section className="student-attendance-summary">
              <StatCard status="Present" value={stats.Present} />
              <StatCard status="Absent" value={stats.Absent} />
              <StatCard status="Late" value={stats.Late} />
            </section>

            <section className="panel data-panel">
              <div className="panel-header-line">
                <div>
                  <h2>Attendance Records</h2>
                  <p>Only records associated with your account are shown.</p>
                </div>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => setRefreshId((id) => id + 1)}
                >
                  ↻ Refresh
                </button>
              </div>

              {filteredAttendance.length === 0 ? (
                <EmptyPanel
                  title="No attendance records"
                  text={
                    q
                      ? "Try another search term."
                      : "Your teacher has not recorded attendance for you yet."
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((record) => (
                        <tr key={record.attendance_id}>
                          <td>{record.date || "—"}</td>
                          <td>
                            <div className="subject-cell">
                              <strong>
                                {record.subject_name || `Class ${record.class_id}`}
                              </strong>
                              <small>
                                {record.subject_code || `Class ID ${record.class_id}`}
                              </small>
                            </div>
                          </td>
                          <td>{record.schedule_time || "—"}</td>
                          <td><StatusBadge status={record.status} /></td>
                          <td>
                            {record.status === "Absent" ? (
                              <button
                                type="button"
                                className="absence-letter-upload-link"
                                onClick={() => {
                                  setAppealTarget(record);
                                  setAppealReason("");
                                  setMedicalLetter(null);
                                  setAttendanceNotice("");
                                  setActivePage("appeals");
                                }}
                              >
                                Upload letter
                              </button>
                            ) : (
                              <span className="muted-text">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>}

          {activePage === "appeals" && <>
            <PageHeading
              title="My Absence Letters"
              subtitle="Upload a medical or excuse letter for a day marked Absent."
              right={
                <button
                  className="refresh-button"
                  type="button"
                  onClick={() => setRefreshId((id) => id + 1)}
                >
                  ↻ Refresh
                </button>
              }
            />

            {appealTarget && (
              <section className="panel absence-letter-form-panel">
                <div className="panel-header-line">
                  <div>
                    <h2>Upload Absence Letter</h2>
                    <p>
                      {appealTarget.subject_name ||
                        `Class ${appealTarget.class_id}`}{" "}
                      · {appealTarget.date}
                    </p>
                  </div>
                  <StatusBadge status={appealTarget.status} />
                </div>

                <form
                  className="absence-letter-form"
                  onSubmit={submitAbsenceLetter}
                >
                  <label htmlFor="absence-letter-reason">Reason for absence</label>
                  <textarea
                    id="absence-letter-reason"
                    value={appealReason}
                    onChange={(event) => setAppealReason(event.target.value)}
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    placeholder="Explain your absence, for example illness or medical appointment..."
                    required
                  />

                  <label htmlFor="medical-letter-file">
                    Medical / excuse letter (image: JPG or PNG, or document: PDF; maximum 5 MB)
                  </label>
                  <input
                    id="medical-letter-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={chooseLetterFile}
                    required
                  />

                  {medicalLetter && (
                    <p className="muted-text">
                      Selected file: {medicalLetter.name} (
                      {Math.ceil(medicalLetter.size / 1024)} KB)
                    </p>
                  )}

                  <div className="absence-letter-form-actions">
                    <button
                      type="button"
                      className="btn-outline compact"
                      disabled={appealBusy}
                      onClick={() => {
                        setAppealTarget(null);
                        setMedicalLetter(null);
                        setAppealReason("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="absence-letter-submit"
                      disabled={appealBusy}
                    >
                      {appealBusy ? "Uploading…" : "Submit letter"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {appealsError && (
              <div className="portal-alert error-alert">
                <span>{appealsError}</span>
              </div>
            )}

            <section className="panel data-panel">
              <div className="panel-header-line">
                <div>
                  <h2>Submission History</h2>
                  <p>See which absence letters are still pending or have been reviewed.</p>
                </div>
                <span className="date-chip">
                  {studentAppeals.length} submitted
                </span>
              </div>

              {appealsLoading ? (
                <LoadingState />
              ) : studentAppeals.length === 0 ? (
                <EmptyPanel
                  title="No letters submitted"
                  text="Open My Attendance and select Upload letter next to an Absent record."
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Reason</th>
                        <th>Uploaded Letter</th>
                        <th>Submitted</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentAppeals.map((appeal) => (
                        <tr key={appeal.appeal_id}>
                          <td>{appeal.date}</td>
                          <td>{appeal.subject_name || appeal.subject_code}</td>
                          <td>
                            <div className="absence-letter-reason">
                              {appeal.reason}
                            </div>
                          </td>
                          <td>
                            {appeal.has_document ? (
                              <button
                                type="button"
                                className="text-action"
                                onClick={() => setViewerAppeal(appeal)}
                              >
                                View letter
                              </button>
                            ) : (
                              <span className="muted-text">No file</span>
                            )}
                          </td>
                          <td>{appeal.submitted_at}</td>
                          <td><StatusBadge status={appeal.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {viewerAppeal && (
              <LetterViewer
                appeal={viewerAppeal}
                onClose={() => setViewerAppeal(null)}
              />
            )}
          </>}

          {activePage === "settings" && (
            <ProfileSettings
              user={user}
              roleLabel="Student"
              onUserUpdated={onUserUpdated}
              onToggleTheme={onToggleTheme}
              theme={theme}
              onDeleteAccount={deleteOwnAccount}
            />
          )}
        </>}
      </div>
    </PortalShell>
  );
}

function ProfileSettings({
  user,
  roleLabel,
  onUserUpdated,
  onToggleTheme,
  theme,
  onDeleteAccount,
}) {
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
    contact_number: user.contact_number || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      contact_number: user.contact_number || "",
    });
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          contact_number: form.contact_number.trim(),
        }),
      });

      if (!result.user) {
        throw new Error("The server did not return the updated profile.");
      }

      onUserUpdated(result.user);
      setMessage(
        result.message || "Personal information updated successfully."
      );
    } catch (err) {
      setError(err.message || "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      contact_number: user.contact_number || "",
    });

    setError("");
    setMessage("");
  };

  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Edit your personal information and account details."
      />

      {message && (
        <div className="portal-alert notice-alert">
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="portal-alert error-alert">
          <span>{error}</span>
        </div>
      )}

      <section className="panel settings-panel profile-settings-panel">
        <div className="settings-profile">
          <span className="settings-avatar">
            {(user.first_name || user.email || "U")[0].toUpperCase()}
          </span>
          <div>
            <h2>
              {`${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                roleLabel}
            </h2>
            <p>{user.email}</p>
          </div>
        </div>

        <form className="profile-settings-form" onSubmit={saveProfile}>
          <div className="profile-settings-grid">
            <div className="profile-settings-field">
              <label htmlFor={`${roleLabel}-first-name`}>First Name</label>
              <input
                id={`${roleLabel}-first-name`}
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                maxLength={100}
                autoComplete="given-name"
                required
              />
            </div>

            <div className="profile-settings-field">
              <label htmlFor={`${roleLabel}-last-name`}>Last Name</label>
              <input
                id={`${roleLabel}-last-name`}
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                maxLength={100}
                autoComplete="family-name"
                required
              />
            </div>

            <div className="profile-settings-field">
              <label htmlFor={`${roleLabel}-email`}>Email Address</label>
              <input
                id={`${roleLabel}-email`}
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                maxLength={150}
                autoComplete="email"
                required
              />
            </div>

            <div className="profile-settings-field">
              <label htmlFor={`${roleLabel}-contact`}>Contact Number</label>
              <input
                id={`${roleLabel}-contact`}
                type="tel"
                name="contact_number"
                value={form.contact_number}
                onChange={handleChange}
                maxLength={30}
                autoComplete="tel"
                placeholder="Enter contact number"
              />
            </div>
          </div>

          <div className="profile-settings-actions">
            <button
              type="button"
              className="btn-outline compact"
              disabled={saving}
              onClick={resetForm}
            >
              Reset
            </button>
            <button
              type="submit"
              className="profile-settings-save"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>

        <div className="settings-row">
          <span>Account role</span>
          <strong>{roleLabel}</strong>
        </div>
        <div className="settings-row">
          <span>Appearance</span>
          <button
            className="btn-outline compact"
            onClick={onToggleTheme}
            type="button"
          >
            Switch to {theme === "light" ? "dark" : "light"} mode
          </button>
        </div>

        {onDeleteAccount && (
          <div className="account-delete-row">
            <div>
              <strong>Delete my account</strong>
              <p>
                This permanently removes your student account and associated
                attendance records.
              </p>
            </div>
            <button
              type="button"
              className="account-delete-button"
              onClick={onDeleteAccount}
            >
              Delete Account
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function TeacherAccountManager({classes,onRefresh,isAdmin = false,}) {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletedAccounts, setDeletedAccounts] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [form, setForm] = useState({
    role: "student",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    password: "",
    class_id: classes?.[0]?.class_id
      ? String(classes[0].class_id)
      : "",
  });

  const classKey = (classes || [])
    .map((item) => item.class_id)
    .join(",");
  
  const accountsEndpoint = isAdmin
    ? "/api/admin/accounts"
    : "/api/teacher/accounts";

  const deleteAccountEndpoint = isAdmin
    ? "/api/admin/accounts/delete"
    : "/api/teacher/accounts/delete";

  const loadAccounts = async () => {
    setLoadingAccounts(true);

    try {
      const data = await apiRequest(accountsEndpoint);
      setAccounts(data.accounts || []);
      setDeletedAccounts(data.deleted_accounts || []);
      setError("");
    } catch (err) {
      setError(
        err.message || "Could not load students in your classes."
      );
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (!form.class_id && classes?.[0]?.class_id) {
      setForm((current) => ({
        ...current,
        class_id: String(classes[0].class_id),
      }));
    }
  }, [classKey]);

  useEffect(() => {
    loadAccounts();
  }, [classKey]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const createAccount = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiRequest(accountsEndpoint, {
        method: "POST",
        body: JSON.stringify({
          role: form.role,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          contact_number: form.contact_number.trim(),
          password: form.password,
          class_id: form.role === "student" ? Number(form.class_id) : null,
        }),
      });

      setMessage(
        `${data.message || `${form.role} account created successfully.`} Temporary password: ${form.password}`
      );

      setForm((current) => ({
        ...current,
        first_name: "",
        last_name: "",
        email: "",
        contact_number: "",
        password: "",
      }));

      await loadAccounts();

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not create the account.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (account) => {
    setEditError("");
    setEditTarget(account);
    setEditForm({
      first_name: account.first_name || "",
      last_name: account.last_name || "",
      email: account.email || "",
      contact_number: account.contact_number || "",
      rfid_uid: account.rfid_uid || "",
      password: "",
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editTarget) return;

    setEditSaving(true);
    setEditError("");

    try {
      const data = await apiRequest("/api/admin/accounts/update", {
        method: "POST",
        body: JSON.stringify({
          user_id: Number(editTarget.user_id),
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          email: editForm.email.trim(),
          contact_number: editForm.contact_number.trim(),
          rfid_uid: editForm.rfid_uid.trim(),
          password: editForm.password,
        }),
      });

      setEditTarget(null);
      setMessage(data.message || "Account updated successfully.");
      await loadAccounts();
      if (onRefresh) onRefresh();
    } catch (err) {
      setEditError(err.message || "Could not update the account.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmAdminDelete = async () => {
    if (!deleteTarget) return;

    setDeleteBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await apiRequest(deleteAccountEndpoint, {
        method: "POST",
        body: JSON.stringify({ user_id: Number(deleteTarget.user_id) }),
      });

      setDeleteTarget(null);
      setMessage(data.message || "Account deleted.");
      await loadAccounts();
      if (onRefresh) onRefresh();
    } catch (err) {
      setDeleteTarget(null);
      setError(err.message || "Could not delete the account.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const restoreAccount = async (account) => {
    const name =
      `${account.first_name || ""} ${account.last_name || ""}`.trim() ||
      account.email;

    if (!window.confirm(`Restore ${name}'s account? They will be able to sign in again.`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/api/admin/accounts/restore", {
        method: "POST",
        body: JSON.stringify({ user_id: Number(account.user_id) }),
      });

      setMessage(data.message || "Account restored.");
      await loadAccounts();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not restore the account.");
    }
  };

  const removeStudent = async (student) => {
    if (isAdmin) {
      setDeleteTarget(student);
      return;
    }

    const name =
      `${student.first_name || ""} ${student.last_name || ""}`.trim();

    const confirmed = window.confirm(
      `Permanently delete ${name || student.email}'s account and attendance history? This cannot be undone.`
    );

    if (!confirmed) return;

    const typed = window.prompt(
      "Type DELETE to confirm permanent removal:"
    );

    if (typed !== "DELETE") {
      setMessage("Account deletion cancelled.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const data = await apiRequest(deleteAccountEndpoint, {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(student.user_id),
        }),
      });

      setMessage(data.message || "Student account deleted.");

      await loadAccounts();

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(
        err.message || "Could not delete the student account."
      );
    }
  };

  return (
    <section className="panel account-manager-panel">
      <PageHeading
        title="Manage Accounts"
        subtitle={
          isAdmin
            ? "The administrator creates and manages student, teacher, and fellow administrator accounts."
            : "Create student or teacher accounts. Students are enrolled in the class you choose."
        }
      />

      {message && (
        <div className="portal-alert notice-alert">
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="portal-alert error-alert">
          <span>{error}</span>
        </div>
      )}

      <form className="account-create-form" onSubmit={createAccount}>
        <div className="account-create-grid">
          <div className="profile-settings-field">
            <label htmlFor="new-account-role">Account type</label>
            <select
              id="new-account-role"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              {isAdmin && <option value="admin">Administrator</option>}
            </select>
          </div>

          <div className="profile-settings-field">
            <label htmlFor="new-account-first">First name</label>
            <input
              id="new-account-first"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              maxLength={100}
              required
            />
          </div>

          <div className="profile-settings-field">
            <label htmlFor="new-account-last">Last name</label>
            <input
              id="new-account-last"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              maxLength={100}
              required
            />
          </div>

          <div className="profile-settings-field">
            <label htmlFor="new-account-email">Email</label>
            <input
              id="new-account-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              maxLength={150}
              required
            />
          </div>

          <div className="profile-settings-field">
            <label htmlFor="new-account-contact">Contact number</label>
            <input
              id="new-account-contact"
              name="contact_number"
              value={form.contact_number}
              onChange={handleChange}
              maxLength={30}
            />
          </div>

          <div className="profile-settings-field">
            <label htmlFor="new-account-password">Temporary password</label>
            <div className="password-reveal">
              <input
                id="new-account-password"
                name="password"
                type={showNewPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-reveal-button"
                onClick={() => setShowNewPassword((value) => !value)}
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {form.role === "student" && (
            <div className="profile-settings-field account-class-field">
              <label htmlFor="new-account-class">Enroll student in class</label>
              <select
                id="new-account-class"
                name="class_id"
                value={form.class_id}
                onChange={handleChange}
                required
              >
                <option value="">Choose your class</option>
                {classes.map((item) => (
                  <option
                    key={item.class_id}
                    value={String(item.class_id)}
                  >
                    {item.subject_code ? `${item.subject_code} — ` : ""}
                    {item.subject_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="muted-text">
          Share the temporary password securely with the new account owner.
          They can use Settings to update their personal information.
        </p>

        <div className="profile-settings-actions">
          <button
            type="submit"
            className="profile-settings-save"
            disabled={
              saving ||
              (form.role === "student" && !form.class_id)
            }
          >
            {saving ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>

      <div className="account-list-heading">
        <h2>{isAdmin ? "All School Accounts" : "Students in Your Classes"}</h2>
        <button
          type="button"
          className="text-action"
          onClick={loadAccounts}
        >
          ↻ Refresh
        </button>
      </div>

      {loadingAccounts ? (
        <LoadingState />
      ) : accounts.length === 0 ? (
        <EmptyPanel
          title={isAdmin ? "No school accounts" : "No enrolled students"}
          text={isAdmin ? "Create a student, teacher, or administrator account above." : "Create a student account above or check class enrollments."}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{isAdmin ? "Account" : "Student"}</th>
                <th>Email</th>
                {isAdmin && <th>Role</th>}
                <th>Account</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((student) => (
                <tr key={student.user_id}>
                  <td>
                    <div className="person-cell">
                      <span className="person-initial">
                        {(student.first_name || "S")[0].toUpperCase()}
                      </span>
                      <span>
                        <strong>
                          {`${student.first_name || ""} ${student.last_name || ""}`.trim()}
                        </strong>
                        <small>
                          {`${(student.role || "student").charAt(0).toUpperCase()}${(student.role || "student").slice(1)}`} ID #{student.user_id}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{student.email}</td>
                  {isAdmin && (
                    <td>
                      <StatusBadge status={student.role || "student"} />
                    </td>
                  )}
                  <td><StatusBadge status="Active" /></td>
                  <td>
                    <div className="note-row-actions">
                      {isAdmin && student.role !== "admin" && (
                        <button
                          className="note-edit-button"
                          type="button"
                          onClick={() => openEdit(student)}
                        >
                          Edit
                        </button>
                      )}
                      {student.role !== "admin" && (
                        <button
                          className="account-delete-button"
                          type="button"
                          onClick={() => removeStudent(student)}
                        >
                          Delete Account
                        </button>
                      )}
                      {student.role === "admin" && <small className="muted-text">Administrator account</small>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && deletedAccounts.length > 0 && (
        <div className="deleted-accounts-block">
          <div className="account-list-heading">
            <h2>Recently Deleted Accounts</h2>
          </div>
          <p className="muted-text">
            Deleted accounts cannot sign in, but their records are kept so you
            can restore them.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Deleted On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deletedAccounts.map((account) => (
                  <tr key={account.user_id}>
                    <td>
                      {`${account.first_name || ""} ${account.last_name || ""}`.trim()}
                    </td>
                    <td>{account.email}</td>
                    <td>
                      <StatusBadge status={account.role || "student"} />
                    </td>
                    <td>{account.deleted_at}</td>
                    <td>
                      <button
                        type="button"
                        className="note-edit-button"
                        onClick={() => restoreAccount(account)}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
          <form className="portal-modal" onSubmit={saveEdit}>
            <h2>Edit {editTarget.role === "teacher" ? "Teacher" : "Student"} Account</h2>

            {editError && (
              <div className="portal-alert error-alert">
                <span>{editError}</span>
              </div>
            )}

            <div className="account-create-grid">
              <div className="profile-settings-field">
                <label htmlFor="edit-first">First name</label>
                <input
                  id="edit-first"
                  name="first_name"
                  value={editForm.first_name}
                  onChange={handleEditChange}
                  maxLength={100}
                  required
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="edit-last">Last name</label>
                <input
                  id="edit-last"
                  name="last_name"
                  value={editForm.last_name}
                  onChange={handleEditChange}
                  maxLength={100}
                  required
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  maxLength={150}
                  required
                />
              </div>

              <div className="profile-settings-field">
                <label htmlFor="edit-contact">Contact number</label>
                <input
                  id="edit-contact"
                  name="contact_number"
                  value={editForm.contact_number}
                  onChange={handleEditChange}
                  maxLength={30}
                />
              </div>

              {editTarget.role === "student" && (
                <div className="profile-settings-field">
                  <label htmlFor="edit-rfid">RFID card UID</label>
                  <input
                    id="edit-rfid"
                    name="rfid_uid"
                    value={editForm.rfid_uid}
                    onChange={handleEditChange}
                    maxLength={64}
                    placeholder="Tap the card on the reader"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="profile-settings-field">
                <label htmlFor="edit-password">New password (optional)</label>
                <div className="password-reveal">
                  <input
                    id="edit-password"
                    name="password"
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={handleEditChange}
                    minLength={8}
                    maxLength={200}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current"
                  />
                  <button
                    type="button"
                    className="password-reveal-button"
                    onClick={() => setShowEditPassword((value) => !value)}
                  >
                    {showEditPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                disabled={editSaving}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="profile-settings-save"
                disabled={editSaving}
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="portal-modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="portal-modal portal-modal-small">
            <h2>Delete this account?</h2>
            <p>
              <strong>
                {`${deleteTarget.first_name || ""} ${deleteTarget.last_name || ""}`.trim() ||
                  deleteTarget.email}
              </strong>{" "}
              ({deleteTarget.role}) will no longer be able to sign in and will
              be hidden from the lists.
            </p>
            <p className="muted-text">
              Their records are kept, and you can restore the account anytime
              from "Recently Deleted Accounts".
            </p>

            <div className="profile-settings-actions">
              <button
                type="button"
                className="btn-outline compact"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="account-delete-button"
                disabled={deleteBusy}
                onClick={confirmAdminDelete}
              >
                {deleteBusy ? "Deleting…" : "Yes, delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TeacherStudentNotes({ onRefresh }) {
  const emptyForm = {
    student_id: "",
    note_type: "General",
    title: "",
    note_text: "",
  };

  const [students, setStudents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadNotes = async () => {
    const data = await apiRequest("/api/teacher/notes");
    setNotes(data.notes || []);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      apiRequest("/api/teacher/notes"),
      apiRequest("/api/teacher/accounts"),
    ])
      .then(([noteData, studentData]) => {
        if (!active) return;
        setNotes(noteData.notes || []);

        const list = studentData.accounts || [];
        setStudents(list);
        setForm((current) => ({
          ...current,
          student_id:
            current.student_id ||
            (list[0]?.user_id ? String(list[0].user_id) : ""),
        }));
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load student notes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      student_id: students[0]?.user_id ? String(students[0].user_id) : "",
    });
  };

  const startEdit = (note) => {
    setEditingId(note.note_id);
    setError("");
    setMessage("");
    setForm({
      student_id: String(note.student_id),
      note_type: note.note_type || "General",
      title: note.title || "",
      note_text: note.note_text || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitNote = async (event) => {
    event.preventDefault();

    if (!form.student_id) {
      setError("Please select a student.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        note_type: form.note_type,
        title: form.title.trim(),
        note_text: form.note_text.trim(),
      };

      const data = editingId
        ? await apiRequest("/api/teacher/notes/update", {
            method: "POST",
            body: JSON.stringify({ ...payload, note_id: Number(editingId) }),
          })
        : await apiRequest("/api/teacher/notes", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              student_id: Number(form.student_id),
            }),
          });

      setMessage(data.message || "Student note saved successfully.");

      setEditingId(null);
      setForm((current) => ({ ...current, title: "", note_text: "" }));

      await loadNotes();

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (note) => {
    const confirmed = window.confirm(
      `Delete the note "${note.title}" for ${note.student_name}? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/api/teacher/notes/delete", {
        method: "POST",
        body: JSON.stringify({ note_id: Number(note.note_id) }),
      });

      setMessage(data.message || "Student note deleted.");

      if (editingId === note.note_id) resetForm();

      await loadNotes();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not delete the note.");
    }
  };

  return (
    <>
      <section className="panel">
        <PageHeading
          title={editingId ? "Edit Student Note" : "Add Student Note"}
          subtitle={
            editingId
              ? "Update the title, category, or details, then save your changes."
              : "Choose a student, then record a school-related note."
          }
        />

        {error && (
          <div className="portal-alert error-alert">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="portal-alert notice-alert">
            <span>{message}</span>
          </div>
        )}

        <form className="account-create-form" onSubmit={submitNote}>
          <div className="account-create-grid">
            <div className="profile-settings-field">
              <label htmlFor="teacher-note-student">Student</label>

              <select
                id="teacher-note-student"
                name="student_id"
                value={form.student_id}
                onChange={handleChange}
                disabled={Boolean(editingId)}
                required
              >
                <option value="">Choose student</option>

                {students.map((student) => (
                  <option
                    key={student.user_id}
                    value={String(student.user_id)}
                  >
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="profile-settings-field">
              <label htmlFor="teacher-note-type">Note Category</label>

              <select
                id="teacher-note-type"
                name="note_type"
                value={form.note_type}
                onChange={handleChange}
              >
                <option>General</option>
                <option>Academic</option>
                <option>Behavior</option>
                <option>Attendance</option>
                <option>Guidance</option>
              </select>
            </div>

            <div className="profile-settings-field">
              <label htmlFor="teacher-note-title">Note Title</label>

              <input
                id="teacher-note-title"
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={150}
                required
              />
            </div>
          </div>

          <div className="profile-settings-field">
            <label htmlFor="teacher-note-text">Note Details</label>

            <textarea
              id="teacher-note-text"
              name="note_text"
              value={form.note_text}
              onChange={handleChange}
              rows={5}
              maxLength={5000}
              minLength={3}
              placeholder="Write the student's note here..."
              required
            />
          </div>

          <div className="profile-settings-actions">
            {editingId && (
              <button
                type="button"
                className="btn-outline compact"
                disabled={saving}
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="profile-settings-save"
              disabled={saving || !students.length}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Save Student Note"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header-line">
          <div>
            <h2>Your Submitted Notes</h2>
            <p>Notes you have already submitted. You can edit or delete them.</p>
          </div>

          <button
            type="button"
            className="text-action"
            onClick={async () => {
              try {
                await loadNotes();
                setError("");
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : notes.length === 0 ? (
          <EmptyPanel
            title="No notes submitted"
            text="Your submitted student notes will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Category</th>
                  <th>Title</th>
                  <th>Note</th>
                  <th>Date Added</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {notes.map((note) => (
                  <tr key={note.note_id}>
                    <td>{note.student_name}</td>
                    <td>{note.note_type || "General"}</td>
                    <td>{note.title}</td>
                    <td>{note.note_text}</td>
                    <td>{note.created_at}</td>
                    <td>
                      <div className="note-row-actions">
                        <button
                          type="button"
                          className="note-edit-button"
                          onClick={() => startEdit(note)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="account-delete-button"
                          onClick={() => deleteNote(note)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}


function AdminGateLogs({ search = "" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/gate-logs");
      setLogs(data.logs || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load gate attendance logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const q = search.trim().toLowerCase();
  const visible = logs.filter((item) =>
    [item.name, item.email, item.role, item.event_type, item.device_name, item.scanned_at]
      .some((value) => String(value || "").toLowerCase().includes(q))
  );

  return (
    <section className="panel admin-section-panel">
      <div className="panel-header-line">
        <div><h2>Gate Attendance Logs</h2><p>RFID IN and OUT scans recorded for students, teachers, and staff.</p></div>
        <button className="refresh-button" type="button" onClick={load}>↻ Refresh</button>
      </div>
      {error && <div className="portal-alert error-alert">{error}</div>}
      {loading ? <LoadingState /> : visible.length === 0 ? (
        <EmptyPanel title="No gate scans yet" text="Successful scans from the standalone gate kiosk will appear here." />
      ) : (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Role</th><th>Event</th><th>Date and time</th><th>Device</th></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.log_id}>
            <td><strong>{item.name}</strong><small className="muted-text">{item.email}</small></td>
            <td>{item.role}</td>
            <td><span className={`rfid-badge ${item.event_type === "IN" ? "rfid-badge-open" : "rfid-badge-closed"}`}>{item.event_type}</span></td>
            <td>{item.scanned_at}</td><td>{item.device_name}</td>
          </tr>)}</tbody>
        </table></div>
      )}
    </section>
  );
}

function AdminPortal({
  user,
  theme,
  onToggleTheme,
  onLogout,
  onUserUpdated,
}) {
  const [activePage, setActivePage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [classes, setClasses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [teacherLogs, setTeacherLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshId, setRefreshId] = useState(0);

  const refresh = () => {
    setRefreshId((value) => value + 1);
  };

  useEffect(() => {
    let active = true;

    const loadAdminData = async () => {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        apiRequest("/api/admin/accounts"),
        apiRequest("/api/admin/notes"),
        apiRequest("/api/admin/teacher-logins"),
      ]);

      if (!active) return;

      const [accountResult, noteResult, loginResult] = results;

      if (accountResult.status === "fulfilled") {
        setAccounts(accountResult.value.accounts || []);
        setClasses(accountResult.value.classes || []);
      } else {
        setError(
          accountResult.reason?.message ||
            "Could not load school accounts."
        );
      }

      if (noteResult.status === "fulfilled") {
        setNotes(noteResult.value.notes || []);
      }

      if (loginResult.status === "fulfilled") {
        setTeacherLogs(loginResult.value.logs || []);
      }

      setLoading(false);
    };

    loadAdminData();

    return () => {
      active = false;
    };
  }, [refreshId]);

  const studentCount = accounts.filter(
    (account) => account.role === "student"
  ).length;

  const teacherCount = accounts.filter(
    (account) => account.role === "teacher"
  ).length;
  const adminCount = accounts.filter(
    (account) => account.role === "admin"
  ).length;

  const query = search.trim().toLowerCase();

  return (
    <PortalShell
      role="admin"
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
      activePage={activePage}
      setActivePage={setActivePage}
      search={search}
      setSearch={setSearch}
    >
      <div className="portal-content">

        {error && (
          <div className="portal-alert error-alert">
            <span>{error}</span>
            <button type="button" onClick={refresh}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {activePage === "dashboard" && (
              <>
                <PageHeading
                  title="Administrator Dashboard"
                  subtitle="Manage school accounts and monitor teacher activities."
                  right={
                    <button
                      className="refresh-button"
                      type="button"
                      onClick={refresh}
                    >
                      ↻ Refresh
                    </button>
                  }
                />

                <div className="admin-kpi-grid">
                  <article className="panel admin-kpi-card">
                    <span>Student Accounts</span>
                    <strong>{studentCount}</strong>
                    <small>Registered students</small>
                  </article>

                  <article className="panel admin-kpi-card">
                    <span>Teacher Accounts</span>
                    <strong>{teacherCount}</strong>
                    <small>Registered teachers</small>
                  </article>
                  <article className="panel admin-kpi-card">
                    <span>Administrator Accounts</span>
                    <strong>{adminCount}</strong>
                    <small>Registered administrators</small>
                  </article>

                  <article className="panel admin-kpi-card">
                    <span>Classes</span>
                    <strong>{classes.length}</strong>
                    <small>School classes</small>
                  </article>

                  <article className="panel admin-kpi-card">
                    <span>Teacher Login Logs</span>
                    <strong>{teacherLogs.length}</strong>
                    <small>Recorded successful logins</small>
                  </article>
                </div>

                <section className="panel admin-quick-actions">
                  <div className="panel-header-line">
                    <div>
                      <h2>Administration</h2>
                      <p>
                        Manage teachers, students, and school records.
                      </p>
                    </div>
                  </div>

                  <div className="admin-action-row">
                    <button
                      type="button"
                      className="profile-settings-save"
                      onClick={() => setActivePage("accounts")}
                    >
                      Manage Accounts
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setActivePage("notes")}
                    >
                      Student Notes Log
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setActivePage("teacher-logins")}
                    >
                      Teacher Login Logs
                    </button>
                  </div>
                </section>

                <AdminTeacherLoginLogs
                  logs={teacherLogs}
                  search={query}
                  compact
                  onRefresh={refresh}
                />
              </>
            )}

            {activePage === "accounts" && (
              <TeacherAccountManager
                classes={classes}
                onRefresh={refresh}
                isAdmin
              />
            )}

            {activePage === "notes" && (
              <AdminNotesLog
                notes={notes}
                students={accounts.filter(
                  (account) => account.role === "student"
                )}
                search={query}
                onRefresh={refresh}
              />
            )}

            {activePage === "teacher-logins" && (
              <AdminTeacherLoginLogs
                logs={teacherLogs}
                search={query}
                onRefresh={refresh}
              />
            )}

            {activePage === "classes" && (
              <AdminClassManager search={query} />
            )}

            {activePage === "transfers" && (
              <AdminTransferRequests search={query} />
            )}

            {activePage === "rfid" && (
              <AdminRfidManager search={query} onRefresh={refresh} />
            )}
            {activePage === "gate-logs" && (
              <AdminGateLogs search={query} />
            )}
            {activePage === "face" && (
              <FaceEnrollment api={apiRequest} search={query} />
            )}

            {activePage === "settings" && (
              <ProfileSettings
                user={user}
                roleLabel="Administrator"
                onUserUpdated={onUserUpdated}
                onToggleTheme={onToggleTheme}
                theme={theme}
              />
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}

function AdminTeacherLoginLogs({
  logs = [],
  search = "",
  compact = false,
  onRefresh,
}) {
  const filtered = logs.filter((log) =>
    [
      log.teacher_name,
      log.teacher_id,
      log.login_at,
    ].some((value) =>
      String(value || "").toLowerCase().includes(search)
    )
  );

  const visible = compact ? filtered.slice(0, 5) : filtered;

  return (
    <section className="panel admin-section-panel">
      <div className="panel-header-line">
        <div>
          <h2>
            {compact
              ? "Recent Teacher Logins"
              : "Teacher Login Activity"}
          </h2>
          <p>
            Successful teacher login records.
          </p>
        </div>

        <button
          className="text-action"
          type="button"
          onClick={onRefresh}
        >
          ↻ Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyPanel
          title="No teacher login history"
          text="Teacher login records will appear here after a teacher signs in."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Login Date</th>
                <th>Login Time</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((log) => (
                <tr key={log.login_id}>
                  <td>
                    <div className="person-cell">
                      <span className="person-initial">
                        {(log.teacher_name || "T")[0].toUpperCase()}
                      </span>
                      <span>
                        <strong>
                          {log.teacher_name || "Teacher"}
                        </strong>
                        <small>
                          Teacher ID #{log.teacher_id}
                        </small>
                      </span>
                    </div>
                  </td>

                  <td>{splitLoginDateTime(log.login_at).date}</td>
                  <td>{splitLoginDateTime(log.login_at).time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminNotesLog({
  notes = [],
  students = [],
  search = "",
  onRefresh,
}) {
  const [studentFilter, setStudentFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    student_id: "",
    note_type: "General",
    title: "",
    note_text: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitNote = async (event) => {
    event.preventDefault();

    if (!form.student_id) {
      setError("Please select a student.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/api/admin/notes", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(form.student_id),
          note_type: form.note_type,
          title: form.title.trim(),
          note_text: form.note_text.trim(),
        }),
      });

      setMessage(data.message || "Administrator note saved successfully.");
      setForm((current) => ({ ...current, title: "", note_text: "" }));

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = notes.filter((note) => {
    if (
      studentFilter &&
      String(note.student_id) !== String(studentFilter)
    ) {
      return false;
    }

    return [
      note.student_name,
      note.teacher_name,
      note.author_name,
      note.subject_name,
      note.note_text,
      note.note,
      note.title,
    ].some((value) =>
      String(value || "").toLowerCase().includes(search)
    );
  });

  return (
    <>
      <section className="panel admin-section-panel">
        <div className="panel-header-line">
          <div>
            <h2>Add Student Note</h2>
            <p>Select the specific student this note is for.</p>
          </div>
        </div>

        {error && (
          <div className="portal-alert error-alert">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="portal-alert notice-alert">
            <span>{message}</span>
          </div>
        )}

        <form className="account-create-form" onSubmit={submitNote}>
          <div className="account-create-grid">
            <div className="profile-settings-field">
              <label htmlFor="admin-note-student">Student</label>
              <select
                id="admin-note-student"
                name="student_id"
                value={form.student_id}
                onChange={handleChange}
                required
              >
                <option value="">Choose student</option>
                {students.map((student) => (
                  <option
                    key={student.user_id}
                    value={String(student.user_id)}
                  >
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="profile-settings-field">
              <label htmlFor="admin-note-type">Note Category</label>
              <select
                id="admin-note-type"
                name="note_type"
                value={form.note_type}
                onChange={handleChange}
              >
                <option>General</option>
                <option>Academic</option>
                <option>Behavior</option>
                <option>Attendance</option>
                <option>Guidance</option>
              </select>
            </div>

            <div className="profile-settings-field">
              <label htmlFor="admin-note-title">Note Title</label>
              <input
                id="admin-note-title"
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={150}
                required
              />
            </div>
          </div>

          <div className="profile-settings-field">
            <label htmlFor="admin-note-text">Note Details</label>
            <textarea
              id="admin-note-text"
              name="note_text"
              value={form.note_text}
              onChange={handleChange}
              rows={4}
              maxLength={5000}
              minLength={3}
              required
            />
          </div>

          <div className="profile-settings-actions">
            <button
              type="submit"
              className="profile-settings-save"
              disabled={saving || !students.length}
            >
              {saving ? "Saving..." : "Save Student Note"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel admin-section-panel">
        <div className="panel-header-line">
          <div>
            <h2>Student Notes Log</h2>
            <p>Notes recorded by teachers and administrators about students.</p>
          </div>

          <div className="admin-note-tools">
            <select
              className="class-select"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              aria-label="Filter by student"
            >
              <option value="">All students</option>
              {students.map((student) => (
                <option
                  key={student.user_id}
                  value={String(student.user_id)}
                >
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>

            <button
              className="text-action"
              type="button"
              onClick={onRefresh}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyPanel
            title="No student notes"
            text="Notes will appear here once they are saved."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Added By</th>
                  <th>Category</th>
                  <th>Title</th>
                  <th>Note</th>
                  <th>Date Added</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((note) => (
                  <tr key={note.note_id || note.log_id}>
                    <td>{note.student_name || note.student_id || "—"}</td>
                    <td>
                      {note.teacher_name || note.author_name || note.teacher_id || "—"}
                      {note.author_role ? (
                        <small className="muted-text"> ({note.author_role})</small>
                      ) : null}
                    </td>
                    <td>{note.note_type || "General"}</td>
                    <td>{note.title || "—"}</td>
                    <td>{note.note_text || note.note || "—"}</td>
                    <td>{note.created_at || note.date_created || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function LoadingState() {
  return (
    <section className="panel loading-panel">
      <span className="loading-spinner" />
      <strong>Loading attendance data…</strong>
      <p>Connecting to your local LavaLust database.</p>
    </section>
  );
}

export default App;
