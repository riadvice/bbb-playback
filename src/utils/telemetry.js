import { telemetry as config } from 'config';
import {
  BUILD,
  ROUTER,
} from 'utils/constants';

const FLUSH_INTERVAL = 15000;
const MAX_SPANS = 500;

const hex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
  .map(b => b.toString(16).padStart(2, '0')).join('');

const nanos = (ms) => `${Math.round(ms * 1e6)}`;

const round = (seconds) => Math.round(seconds * 10) / 10;

const attribute = (key, value) => {
  if (typeof value === 'number') return { key, value: { doubleValue: value } };

  if (typeof value === 'boolean') return { key, value: { boolValue: value } };

  return { key, value: { stringValue: String(value) } };
};

const spans = [];
let session = null;
let recording = null;
let opened = false;
let source = null;
let player = null;
let allowed = false;
const reached = new Set();

const span = (name, category, outcome, details = {}, start = Date.now()) => {
  if (!session) return;

  if (spans.length >= MAX_SPANS) spans.shift();
  spans.push({
    traceId: hex(16),
    spanId: hex(8),
    name,
    kind: 1,
    startTimeUnixNano: nanos(start),
    endTimeUnixNano: nanos(Date.now()),
    status: { code: outcome === 'failure' ? 2 : 1 },
    attributes: [
      attribute('bbb.action', name),
      attribute('bbb.action.outcome', outcome),
      attribute('bbb.action.category', category),
      attribute('bbb.playback.format', 'presentation'),
      ...Object.keys(details).filter(key => details[key] != null)
        .map(key => attribute(`bbb.${key}`, details[key])),
    ],
  });
};

const flush = () => {
  if (!allowed || spans.length === 0) return;

  const body = JSON.stringify({
    resourceSpans: [{
      resource: {
        attributes: [
          attribute('service.version', BUILD || ''),
          attribute('session.id', session),
          attribute('bbb.recording.id', recording),
        ],
      },
      scopeSpans: [{ scope: { name: 'bbb-playback.viewer-actions' }, spans: spans.splice(0) }],
    }],
  });

  fetch(`${config.url.replace(/\/$/, '')}/v1/traces`, {
    method: 'POST',
    body,
    keepalive: body.length < 60000,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
};

const percent = (seconds) => {
  const duration = player?.duration();

  return duration ? Math.round(seconds / duration * 100) : null;
};

// Where the viewer is in the recording, in seconds and percent
const where = () => player ? {
  'playback.position': round(player.currentTime()),
  'playback.percent': percent(player.currentTime()),
} : {};

const watched = (ranges) => {
  let total = 0;
  for (let i = 0; i < ranges.length; i++) total += ranges.end(i) - ranges.start(i);

  return total;
};

const telemetry = {
  init(recordId) {
    if (session || !ROUTER || !recordId) return;

    session = hex(16);
    recording = recordId;
    // The server says whether it traces viewers; events wait for its answer
    fetch(`${config.url.replace(/\/$/, '')}/v1/traces`).then((response) => {
      if (!response.ok) throw new Error('playback telemetry off');
      allowed = true;
      flush();
      setInterval(flush, FLUSH_INTERVAL);
    }).catch(() => {
      session = null;
      spans.length = 0;
    });
    window.addEventListener('pagehide', () => {
      span('leave recording', 'navigation', 'success', {
        ...where(),
        'playback.watched': player ? round(watched(player.played())) : null,
      });
      flush();
    });
  },
  track(name, category, details) {
    span(name, category, 'success', { ...where(), ...details });
  },
  // Content the recording reaches (a poll, a video link), counted once per viewer session
  reach(name, key, details) {
    if (!session || reached.has(key)) return;

    reached.add(key);
    span(name, 'content', 'success', {
      ...where(),
      'playback.playing': player ? !player.paused() : null,
      ...details,
    });
  },
  open(error) {
    if (opened) return;

    opened = true;
    span('open recording', 'navigation', error ? 'failure' : 'success', { 'error.code': error }, performance.timeOrigin);
  },
  // Tags the next seek with where it came from (thumbnail, chat, slide...)
  jump(via) {
    source = via;
  },
  watch(media) {
    if (!session) return;

    player = media;
    let position = media.currentTime();
    let rate = media.playbackRate();
    let seek = null;
    let scrubbed = false;

    const details = (extra) => ({
      ...where(),
      'playback.rate': media.playbackRate(),
      ...extra,
    });

    media.on('timeupdate', () => {
      if (!media.seeking()) position = media.currentTime();
    });

    // The seek bar pauses before it seeks and resumes on release
    media.on('play', () => {
      if (scrubbed) scrubbed = false;
      else span('play', 'playback', 'success', details());
    });

    media.on('pause', () => {
      if (media.scrubbing() || media.seeking()) scrubbed = true;
      else if (!media.ended()) span('pause', 'playback', 'success', details());
    });

    media.on('seeking', () => {
      if (!seek) seek = { from: position, start: Date.now() };
      if (source) seek.via = source;
      source = null;
    });

    media.on('seeked', () => {
      if (!seek) return;

      const { from, start, via } = seek;
      position = media.currentTime();
      seek = null;
      span(via ? 'jump' : 'seek', via ? 'navigation' : 'playback', 'success', details({
        'seek.from': round(from),
        'seek.to': round(position),
        'seek.from_percent': percent(from),
        'seek.to_percent': percent(position),
        'navigation.source': via,
      }), start);
    });

    media.on('ratechange', () => {
      const from = rate;
      rate = media.playbackRate();
      if (from !== rate) span('change rate', 'playback', 'success', details({ 'playback.rate.from': from }));
    });

    media.on('ended', () => span('end', 'playback', 'success', details({
      'playback.watched': round(watched(media.played())),
      'playback.duration': round(media.duration()),
    })));

    media.on('error', () => {
      const error = media.error();
      span('play media', 'error', 'failure', details({
        'error.code': error?.code,
        'error.message': error?.message,
      }));
    });
  },
};

export default telemetry;
