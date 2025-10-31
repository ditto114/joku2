import { randomUUID } from 'crypto';
import { readData, saveData } from './database.js';

const MAX_DURATION_MS = 1000 * 60 * 60 * 12; // 12시간
const DEFAULT_DURATION_MS = 1000 * 60 * 5; // 5분

function clampDuration(ms) {
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.min(MAX_DURATION_MS, Math.round(ms)));
}

function sanitizeName(name) {
    const str = typeof name === 'string' ? name.trim() : '';
    if (!str) return '새 타이머';
    return str.slice(0, 60);
}

function parseDuration(payload = {}) {
    const hasMinutes = Object.prototype.hasOwnProperty.call(payload, 'minutes');
    const hasSeconds = Object.prototype.hasOwnProperty.call(payload, 'seconds');

    if (!hasMinutes && !hasSeconds) {
        return null;
    }

    let minutes = Number(payload.minutes);
    let seconds = Number(payload.seconds);

    if (!Number.isFinite(minutes)) minutes = 0;
    if (!Number.isFinite(seconds)) seconds = 0;

    minutes = Math.max(0, Math.min(720, Math.floor(minutes)));
    seconds = Math.max(0, Math.min(59, Math.floor(seconds)));

    const totalSeconds = minutes * 60 + seconds;
    return clampDuration(totalSeconds * 1000);
}

function ensureTimers(data) {
    if (!Array.isArray(data.timers)) {
        data.timers = [];
    }
    return data.timers;
}

function applyTimerExpiration(timer, now) {
    let changed = false;

    const normalizedDuration = clampDuration(timer.durationMs);
    if (normalizedDuration !== timer.durationMs) {
        timer.durationMs = normalizedDuration;
        changed = true;
    }

    if (!Number.isFinite(timer.durationMs)) {
        timer.durationMs = 0;
        changed = true;
    }

    if (!Number.isFinite(timer.remainingMs)) {
        timer.remainingMs = timer.durationMs;
        changed = true;
    }

    if (timer.remainingMs < 0) {
        timer.remainingMs = 0;
        changed = true;
    }

    if (timer.durationMs > 0 && timer.remainingMs > timer.durationMs) {
        timer.remainingMs = timer.durationMs;
        changed = true;
    }

    if (typeof timer.repeat !== 'boolean') {
        timer.repeat = false;
        changed = true;
    }

    if (timer.isRunning) {
        const startedAt = Number(timer.startedAt);
        if (!Number.isFinite(startedAt)) {
            timer.isRunning = false;
            timer.startedAt = null;
            changed = true;
        } else {
            const elapsed = Math.max(0, now - startedAt);
            if (elapsed >= timer.remainingMs) {
                if (timer.repeat && timer.durationMs > 0) {
                    const duration = timer.durationMs;
                    const overshoot = Math.max(0, elapsed - timer.remainingMs);
                    const remainder = duration > 0 ? overshoot % duration : 0;
                    let timeLeft = duration - remainder;
                    if (timeLeft <= 0) {
                        timeLeft = duration;
                    }
                    timer.remainingMs = duration;
                    timer.startedAt = now - (duration - timeLeft);
                    timer.isRunning = true;
                    timer.updatedAt = now;
                    changed = true;
                } else {
                    timer.isRunning = false;
                    timer.startedAt = null;
                    timer.remainingMs = 0;
                    changed = true;
                }
            }
        }
    } else if (timer.startedAt != null) {
        timer.startedAt = null;
        changed = true;
    }

    return changed;
}

function toClientTimer(timer, now) {
    const startedAt = Number(timer.startedAt);
    const running = Boolean(timer.isRunning) && Number.isFinite(startedAt);
    const elapsed = running ? Math.max(0, now - startedAt) : 0;
    const baseRemaining = clampDuration(timer.remainingMs);
    const remaining = running ? Math.max(0, baseRemaining - elapsed) : Math.max(0, baseRemaining);
    const isRunning = running && remaining > 0;

    const normalizedUpdatedAt = Number(timer.updatedAt);

    return {
        id: timer.id,
        name: timer.name,
        durationMs: clampDuration(timer.durationMs),
        remainingMs: isRunning ? remaining : Math.max(0, baseRemaining),
        isRunning,
        startedAt: isRunning ? startedAt : null,
        repeat: Boolean(timer.repeat),
        updatedAt: Number.isFinite(normalizedUpdatedAt) ? normalizedUpdatedAt : null
    };
}

function findTimer(timers, id) {
    return timers.find(t => t.id === id);
}

export async function getTimerSnapshot() {
    const now = Date.now();
    const data = await readData(true);
    const timers = ensureTimers(data);
    let changed = false;

    timers.forEach(timer => {
        if (!timer.id) {
            timer.id = randomUUID();
            changed = true;
        }
        if (applyTimerExpiration(timer, now)) {
            changed = true;
        }
    });

    if (changed) {
        await saveData(data);
    }

    return {
        serverTime: now,
        timers: timers.map(timer => toClientTimer(timer, now))
    };
}

export async function createTimer(payload = {}) {
    const now = Date.now();
    const data = await readData(true);
    const timers = ensureTimers(data);

    const durationOverride = parseDuration(payload);
    const durationMs = durationOverride !== null ? durationOverride : DEFAULT_DURATION_MS;

    const timer = {
        id: randomUUID(),
        name: sanitizeName(payload.name),
        durationMs,
        remainingMs: durationMs,
        isRunning: false,
        startedAt: null,
        repeat: false,
        updatedAt: now
    };

    timers.push(timer);
    await saveData(data);

    return { timer: toClientTimer(timer, now), changed: true };
}

export async function updateTimerMeta(id, payload = {}) {
    if (!id) throw new Error('타이머 ID가 필요합니다.');
    const now = Date.now();
    const data = await readData(true);
    const timers = ensureTimers(data);
    const timer = findTimer(timers, id);

    if (!timer) {
        throw new Error('타이머를 찾을 수 없습니다.');
    }

    let updated = false;

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
        const nextName = sanitizeName(payload.name);
        if (nextName !== timer.name) {
            timer.name = nextName;
            updated = true;
        }
    }

    const durationOverride = parseDuration(payload);
    if (durationOverride !== null) {
        timer.durationMs = durationOverride;
        timer.remainingMs = durationOverride;
        timer.isRunning = false;
        timer.startedAt = null;
        updated = true;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'repeat')) {
        const nextRepeat = Boolean(payload.repeat);
        if (nextRepeat !== Boolean(timer.repeat)) {
            timer.repeat = nextRepeat;
            updated = true;
        }
    }

    if (!updated) {
        return { timer: toClientTimer(timer, now), changed: false };
    }

    timer.updatedAt = now;
    await saveData(data);

    return { timer: toClientTimer(timer, now), changed: true };
}

export async function startTimer(id) {
    if (!id) throw new Error('타이머 ID가 필요합니다.');
    const now = Date.now();
    const data = await readData(true);
    const timers = ensureTimers(data);
    const timer = findTimer(timers, id);

    if (!timer) {
        throw new Error('타이머를 찾을 수 없습니다.');
    }

    applyTimerExpiration(timer, now);

    const startedAt = Number(timer.startedAt);
    const running = Boolean(timer.isRunning) && Number.isFinite(startedAt);
    const elapsed = running ? Math.max(0, now - startedAt) : 0;
    let remaining = running ? Math.max(0, timer.remainingMs - elapsed) : timer.remainingMs;

    if (remaining <= 0) {
        const duration = clampDuration(timer.durationMs);
        if (duration > 0) {
            remaining = duration;
            timer.remainingMs = duration;
        } else {
            timer.remainingMs = 0;
            timer.isRunning = false;
            timer.startedAt = null;
            timer.updatedAt = now;
            await saveData(data);
            return { timer: toClientTimer(timer, now), changed: true };
        }
    } else {
        timer.remainingMs = remaining;
    }

    timer.isRunning = true;
    timer.startedAt = now;
    timer.updatedAt = now;

    await saveData(data);
    return { timer: toClientTimer(timer, now), changed: true };
}

export async function resetTimer(id) {
    if (!id) throw new Error('타이머 ID가 필요합니다.');
    const now = Date.now();
    const data = await readData(true);
    const timers = ensureTimers(data);
    const timer = findTimer(timers, id);

    if (!timer) {
        throw new Error('타이머를 찾을 수 없습니다.');
    }

    const duration = clampDuration(timer.durationMs);
    timer.durationMs = duration;
    timer.remainingMs = duration;
    timer.isRunning = false;
    timer.startedAt = null;
    timer.updatedAt = now;

    await saveData(data);
    return { timer: toClientTimer(timer, now), changed: true };
}

export async function deleteTimer(id) {
    if (!id) throw new Error('타이머 ID가 필요합니다.');
    const data = await readData(true);
    const timers = ensureTimers(data);
    const index = timers.findIndex(t => t.id === id);

    if (index === -1) {
        throw new Error('타이머를 찾을 수 없습니다.');
    }

    timers.splice(index, 1);
    await saveData(data);
    return { changed: true };
}
