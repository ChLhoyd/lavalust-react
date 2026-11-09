import { useMemo, useState } from "react";
import "./StudentCalendar.css";

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

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getClassDays(value) {
  const raw = String(value || "").trim().toUpperCase();

  if (!raw) return [];

  const dayIndexes = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  if (
    /WEEKDAYS|MONDAY\s*-\s*FRIDAY|MON\s*-\s*FRI/.test(raw)
  ) {
    return [1, 2, 3, 4, 5];
  }

  if (/DAILY|EVERY DAY|ALL DAYS/.test(raw)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const matches = raw
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const result = [];

  for (const part of matches) {
    const day = part.slice(0, 3);

    if (Object.prototype.hasOwnProperty.call(dayIndexes, day)) {
      result.push(dayIndexes[day]);
    }
  }

  return [...new Set(result)];
}

function formatTime(value) {
  const raw = String(value || "").trim();

  if (!raw) return "Time not set";

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) return raw;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) return raw;

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatDate(value) {
  return dateFromKey(value).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildEvents(classes, startDate, numberOfDays) {
  const events = [];
  const base = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  for (let offset = 0; offset < numberOfDays; offset += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + offset);

    const weekday = date.getDay();
    const currentKey = dateKey(date);

    for (const item of classes || []) {
      const days = getClassDays(item.class_days);

      if (!days.includes(weekday)) continue;

      events.push({
        eventId: `${item.class_id}-${currentKey}`,
        dateKey: currentKey,
        date,
        class_id: item.class_id,
        subject_code: item.subject_code || "",
        subject_name:
          item.subject_name || `Class ${item.class_id}`,
        teacher_name:
          item.teacher_name || "Teacher not assigned",
        room: item.room || "Room not set",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        schedule_time: item.schedule_time || "",
      });
    }
  }

  return events.sort((a, b) => {
    return (
      a.dateKey.localeCompare(b.dateKey) ||
      String(a.start_time || "99:99").localeCompare(
        String(b.start_time || "99:99")
      )
    );
  });
}

function CalendarEmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">▣</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default function StudentCalendar({ classes = [] }) {
  const todayKey = getManilaDate();
  const todayDate = dateFromKey(todayKey);

  const [monthDate, setMonthDate] = useState(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  );

  const [selectedDate, setSelectedDate] = useState(todayKey);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday is the first calendar column.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthEvents = useMemo(
    () => buildEvents(classes, new Date(year, month, 1), daysInMonth),
    [classes, year, month, daysInMonth]
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map();

    for (const event of monthEvents) {
      if (!grouped.has(event.dateKey)) {
        grouped.set(event.dateKey, []);
      }

      grouped.get(event.dateKey).push(event);
    }

    return grouped;
  }, [monthEvents]);

  const selectedEvents = eventsByDate.get(selectedDate) || [];

  const upcomingEvents = useMemo(() => {
    return buildEvents(classes, todayDate, 31)
      .filter((event) => event.dateKey >= todayKey)
      .slice(0, 8);
  }, [classes, todayKey]);

  const changeMonth = (amount) => {
    const nextMonth = new Date(year, month + amount, 1);

    setMonthDate(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };

  const goToToday = () => {
    setMonthDate(
      new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
    );

    setSelectedDate(todayKey);
  };

  const dayCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (dayCells.length % 7 !== 0) {
    dayCells.push(null);
  }

  return (
    <div className="student-calendar-layout">
      <section className="panel student-calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <h2>
              {monthDate.toLocaleDateString("en-PH", {
                month: "long",
                year: "numeric",
              })}
            </h2>

            <p>
              Select a date to view your class schedules.
            </p>
          </div>

          <div className="calendar-toolbar-actions">
            <button
              type="button"
              className="btn-outline compact"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>

            <button
              type="button"
              className="btn-outline compact"
              onClick={goToToday}
            >
              Today
            </button>

            <button
              type="button"
              className="btn-outline compact"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        {classes.length === 0 ? (
          <CalendarEmptyState
            title="No enrolled classes"
            message="Your calendar will display class schedules after you are enrolled in a class."
          />
        ) : (
          <>
            <div className="calendar-weekdays">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day) => (
                  <span key={day}>{day}</span>
                )
              )}
            </div>

            <div className="calendar-month-grid">
              {dayCells.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="calendar-day calendar-day-empty"
                    />
                  );
                }

                const date = new Date(year, month, day);
                const currentKey = dateKey(date);
                const events = eventsByDate.get(currentKey) || [];

                const isSelected = currentKey === selectedDate;
                const isToday = currentKey === todayKey;

                const classesForDay = [
                  "calendar-day",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  events.length ? "has-events" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    type="button"
                    key={currentKey}
                    className={classesForDay}
                    onClick={() => setSelectedDate(currentKey)}
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(currentKey)}${
                      events.length
                        ? `, ${events.length} scheduled classes`
                        : ", no scheduled classes"
                    }`}
                  >
                    <span className="calendar-day-number">
                      {day}
                    </span>

                    {events.slice(0, 2).map((event) => (
                      <span
                        className="calendar-mini-event"
                        key={event.eventId}
                      >
                        {event.subject_name}
                      </span>
                    ))}

                    {events.length > 2 && (
                      <span className="calendar-more-events">
                        +{events.length - 2} more
                      </span>
                    )}

                    {events.length > 0 && (
                      <span
                        className="calendar-event-dot"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend">
              <span className="calendar-event-dot" />
              Class scheduled
              <span className="calendar-today-outline" />
              Today
            </div>
          </>
        )}
      </section>

      <aside className="student-calendar-side">
        <section className="panel calendar-detail-panel">
          <div className="calendar-side-eyebrow">
            SELECTED DATE
          </div>

          <h2>{formatDate(selectedDate)}</h2>

          {selectedEvents.length === 0 ? (
            <p className="calendar-empty-date">
              No classes are scheduled for this date. Select another
              date or check the upcoming classes.
            </p>
          ) : (
            <div className="calendar-event-list">
              {selectedEvents.map((event) => (
                <article
                  className="calendar-event-card"
                  key={event.eventId}
                >
                  <div className="calendar-event-time">
                    <span>{formatTime(event.start_time)}</span>
                    <span className="calendar-time-divider">to</span>
                    <span>{formatTime(event.end_time)}</span>
                  </div>

                  <h3>{event.subject_name}</h3>

                  <p className="calendar-event-code">
                    {event.subject_code ||
                      `Class ${event.class_id}`}
                  </p>

                  <div className="calendar-event-detail">
                    <span>Room</span>
                    <strong>{event.room}</strong>
                  </div>

                  <div className="calendar-event-detail">
                    <span>Teacher</span>
                    <strong>{event.teacher_name}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel calendar-upcoming-panel">
          <div className="panel-header-line">
            <div>
              <h2>Upcoming classes</h2>
              <p>Next scheduled sessions</p>
            </div>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="calendar-empty-date">
              No upcoming class dates found. Ask your teacher to
              configure the class days and times.
            </p>
          ) : (
            <div className="calendar-upcoming-list">
              {upcomingEvents.map((event) => (
                <button
                  className="calendar-upcoming-item"
                  type="button"
                  key={event.eventId}
                  onClick={() => {
                    setMonthDate(
                      new Date(
                        event.date.getFullYear(),
                        event.date.getMonth(),
                        1
                      )
                    );

                    setSelectedDate(event.dateKey);
                  }}
                >
                  <span className="calendar-upcoming-date">
                    <strong>
                      {event.date.toLocaleDateString("en-PH", {
                        day: "numeric",
                      })}
                    </strong>

                    <small>
                      {event.date.toLocaleDateString("en-PH", {
                        month: "short",
                      })}
                    </small>
                  </span>

                  <span className="calendar-upcoming-copy">
                    <strong>{event.subject_name}</strong>

                    <small>
                      {formatDate(event.dateKey)}
                    </small>

                    <small>
                      {formatTime(event.start_time)} –{" "}
                      {formatTime(event.end_time)}
                    </small>

                    <small>{event.room}</small>
                  </span>

                  <span className="calendar-upcoming-arrow">
                    ›
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}