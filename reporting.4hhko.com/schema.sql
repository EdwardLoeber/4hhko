-- Analytics Database Schema
-- Run once: psql -U femmy -d analytics -f schema.sql

CREATE TABLE IF NOT EXISTS pageviews (
    id              SERIAL PRIMARY KEY,
    session_id      TEXT,
    url             TEXT,
    title           TEXT,
    referrer        TEXT,
    entered_at      TEXT,
    timestamp       TEXT,
    user_agent      TEXT,
    language        TEXT,
    cookies_enabled TEXT,
    js_enabled      TEXT,
    images_enabled  TEXT,
    css_enabled     TEXT,
    screen_width    TEXT,
    screen_height   TEXT,
    viewport_width  TEXT,
    viewport_height TEXT,
    network_type    TEXT,
    page_start_time TEXT,
    page_end_time   TEXT,
    total_load_time TEXT,
    technographics  JSONB,
    timing          JSONB
);

CREATE TABLE IF NOT EXISTS activity_events (
    id         SERIAL PRIMARY KEY,
    session_id TEXT,
    url        TEXT,
    timestamp  TEXT,
    events     JSONB
);

CREATE TABLE IF NOT EXISTS errors (
    id         SERIAL PRIMARY KEY,
    session_id TEXT,
    url        TEXT,
    timestamp  TEXT,
    type       TEXT,
    message    TEXT,
    source     TEXT,
    line       TEXT,
    col        TEXT,
    stack      TEXT,
    error_data JSONB
);

CREATE TABLE IF NOT EXISTS page_exits (
    id           SERIAL PRIMARY KEY,
    session_id   TEXT,
    url          TEXT,
    timestamp    TEXT,
    time_on_page TEXT,
    vitals       JSONB
);
