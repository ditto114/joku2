// database.js
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { CONFIG } from './config.js';
import { withErrorHandling } from './utils.js';

// 메모리 캐시
let dataCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 데이터베이스 초기화
export const initDatabase = withErrorHandling(async () => {
    try {
        await fs.access(CONFIG.DATABASE.FILE_PATH);
        console.log('데이터베이스 파일이 존재합니다.');

        // 기존 데이터 읽어서 새로운 필드 추가 확인
        const data = await readData(true);

        // skillbook -> skillbook1, skillbook2로 마이그레이션
        let needsSave = false;

        if (data.reservations.skillbook && !data.reservations.skillbook1) {
            data.reservations.skillbook1 = { ...data.reservations.skillbook };
            delete data.reservations.skillbook;
            needsSave = true;
            console.log('skillbook -> skillbook1로 마이그레이션되었습니다.');
        }

        if (data.reservations.skillbookNoLying && !data.reservations.skillbook2) {
            data.reservations.skillbook2 = { ...data.reservations.skillbookNoLying };
            delete data.reservations.skillbookNoLying;
            needsSave = true;
            console.log('skillbookNoLying -> skillbook2로 마이그레이션되었습니다.');
        }

        if (!data.reservations.skillbook1) {
            data.reservations.skillbook1 = { ...CONFIG.DEFAULT_DATA.reservations.skillbook1 };
            needsSave = true;
            console.log('skillbook1 필드가 추가되었습니다.');
        }

        if (!data.reservations.skillbook2) {
            data.reservations.skillbook2 = { ...CONFIG.DEFAULT_DATA.reservations.skillbook2 };
            needsSave = true;
            console.log('skillbook2 필드가 추가되었습니다.');
        }

        if (!data.reservations.enreEat) {
            data.reservations.enreEat = [];
            needsSave = true;
            console.log('enreEat 필드가 추가되었습니다.');
        }

        // 시세 필드 마이그레이션
        if (data.prices.skillbook && !data.prices.skillbook1) {
            data.prices.skillbook1 = data.prices.skillbook;
            delete data.prices.skillbook;
            needsSave = true;
            console.log('시세 skillbook -> skillbook1로 마이그레이션되었습니다.');
        }

        if (data.prices.skillbookPerTurn && !data.prices.skillbook2) {
            data.prices.skillbook2 = data.prices.skillbookPerTurn;
            delete data.prices.skillbookPerTurn;
            needsSave = true;
            console.log('시세 skillbookPerTurn -> skillbook2로 마이그레이션되었습니다.');
        }

        if (!Array.isArray(data.timers)) {
            data.timers = [];
            needsSave = true;
            console.log('timers 필드가 추가되었습니다.');
        }

        if (needsSave) {
            await saveData(data);
        }
    } catch (error) {
        console.log('데이터베이스 파일을 생성합니다.');
        await fs.writeFile(CONFIG.DATABASE.FILE_PATH, JSON.stringify(CONFIG.DEFAULT_DATA, null, 2));
    }
});

// 데이터 읽기 (캐시 적용)
export const readData = withErrorHandling(async (forceRefresh = false) => {
    const now = Date.now();

    // 캐시가 유효하고 강제 새로고침이 아닌 경우 캐시 반환
    if (!forceRefresh && dataCache && (now - lastCacheUpdate) < CACHE_DURATION) {
        return { ...dataCache }; // 깊은 복사 방지를 위한 얕은 복사
    }

    try {
        const data = await fs.readFile(CONFIG.DATABASE.FILE_PATH, 'utf8');
        const parsedData = JSON.parse(data);

        // 데이터 무결성 검증
        const validatedData = validateAndFixData(parsedData);

        // 캐시 업데이트
        dataCache = validatedData;
        lastCacheUpdate = now;

        return { ...validatedData };
    } catch (error) {
        console.error('데이터 읽기 오류:', error);
        // 기본 데이터로 복구
        dataCache = { ...CONFIG.DEFAULT_DATA };
        lastCacheUpdate = now;
        return { ...CONFIG.DEFAULT_DATA };
    }
});

// 데이터 저장
export const saveData = withErrorHandling(async (data) => {
    try {
        // 데이터 검증
        const validatedData = validateAndFixData(data);

        await fs.writeFile(CONFIG.DATABASE.FILE_PATH, JSON.stringify(validatedData, null, 2));

        // 캐시 업데이트
        dataCache = validatedData;
        lastCacheUpdate = Date.now();

        return true;
    } catch (error) {
        console.error('데이터 저장 오류:', error);
        return false;
    }
});

// 데이터 무결성 검증 및 복구
function validateAndFixData(data) {
    const defaultData = CONFIG.DEFAULT_DATA;

    // 기본 구조가 없으면 기본값으로 초기화
    if (!data || typeof data !== 'object') {
        return { ...defaultData };
    }

    const result = { ...data };

    // 공대원(guildMembers) 검증
    if (!Array.isArray(result.guildMembers)) {
        result.guildMembers = Array.isArray(defaultData.guildMembers) ? [...defaultData.guildMembers] : [];
    } else {
        result.guildMembers = result.guildMembers
            .filter(m => m && typeof m === 'object')
            .map(m => validateMember(m))
            // 닉네임 중복 제거 (앞쪽 우선)
            .reduce((acc, cur) => {
                if (!acc.some(x => x.nickname === cur.nickname)) acc.push(cur);
                return acc;
            }, []);
    }
    // prices 검증 - 문자열 기반으로 수정
    if (!result.prices || typeof result.prices !== 'object') {
        result.prices = { ...defaultData.prices };
    } else {
        result.prices = {
            firstSecond: validatePriceString(result.prices.firstSecond, defaultData.prices.firstSecond),
            third: validatePriceString(result.prices.third, defaultData.prices.third),
            skillbook1: validatePriceString(result.prices.skillbook1, defaultData.prices.skillbook1),
            skillbook2: validatePriceString(result.prices.skillbook2, defaultData.prices.skillbook2)
        };

        // 기존 숫자 타입 데이터를 문자열로 변환 (마이그레이션)
        Object.keys(result.prices).forEach(key => {
            if (typeof result.prices[key] === 'number') {
                result.prices[key] = result.prices[key].toString();
            }
        });
    }

    // reservations 검증
    if (!result.reservations || typeof result.reservations !== 'object') {
        result.reservations = JSON.parse(JSON.stringify(defaultData.reservations));
    } else {
        // turn1, turn2 검증
        ['turn1', 'turn2'].forEach(turn => {
            if (!result.reservations[turn]) {
                result.reservations[turn] = JSON.parse(JSON.stringify(defaultData.reservations[turn]));
            } else {
                ['first', 'second', 'third'].forEach(position => {
                    if (!result.reservations[turn][position]) {
                        result.reservations[turn][position] = { ...defaultData.reservations[turn][position] };
                    } else {
                        result.reservations[turn][position] = validateReservation(result.reservations[turn][position]);
                    }
                });
            }
        });

        // skillbook1, skillbook2 검증
        ['skillbook1', 'skillbook2'].forEach(skillbook => {
            if (!result.reservations[skillbook]) {
                result.reservations[skillbook] = { ...defaultData.reservations[skillbook] };
            } else {
                result.reservations[skillbook] = validateSkillbookReservation(result.reservations[skillbook]);
            }
        });

        // enreEat 검증
        if (!result.reservations.enreEat || !Array.isArray(result.reservations.enreEat)) {
            result.reservations.enreEat = [];
        }
    }

    // departureTimes 검증
    if (!result.departureTimes || typeof result.departureTimes !== 'object') {
        result.departureTimes = { ...defaultData.departureTimes };
    } else {
        ['turn1', 'turn2'].forEach(turn => {
            if (!result.departureTimes[turn]) {
                result.departureTimes[turn] = { ...defaultData.departureTimes[turn] };
            } else {
                result.departureTimes[turn] = {
                    hour: validateHour(result.departureTimes[turn].hour, defaultData.departureTimes[turn].hour),
                    minute: validateMinute(result.departureTimes[turn].minute, defaultData.departureTimes[turn].minute)
                };
            }
        });
    }

    // timers 검증
    if (!Array.isArray(result.timers)) {
        result.timers = [];
    } else {
        result.timers = result.timers
            .filter(t => t && typeof t === 'object')
            .map(validateTimerEntry);
    }

    return result;
}

// 개별 검증 함수들
function validatePrice(price, defaultValue) {
    const num = parseInt(price);
    return (!isNaN(num) && num >= 0 && num <= 100000) ? num : defaultValue;
}

function validateReservation(reservation) {
    return {
        customer: (typeof reservation.customer === 'string') ? reservation.customer : '-',
        incentiveMember: (typeof reservation.incentiveMember === 'string') ? reservation.incentiveMember : '-',
        deposit: validatePrice(reservation.deposit, 0)
    };
}

function validateSkillbookReservation(reservation) {
    const validated = validateReservation(reservation);
    validated.skillbookName = (typeof reservation.skillbookName === 'string') ? reservation.skillbookName : '-';
    return validated;
}

function validateHour(hour, defaultValue) {
    const num = parseInt(hour);
    return (!isNaN(num) && num >= 0 && num <= 23) ? num : defaultValue;
}

function validateMinute(minute, defaultValue) {
    const num = parseInt(minute);
    return (!isNaN(num) && num >= 0 && num <= 59) ? num : defaultValue;
}

function clampDuration(ms) {
    if (!Number.isFinite(ms)) return 0;
    const clamped = Math.max(0, Math.min(ms, 1000 * 60 * 60 * 12)); // 최대 12시간
    return Math.round(clamped);
}

function validateTimerEntry(timer) {
    const name = typeof timer.name === 'string' ? timer.name.trim() : '';
    const durationMs = clampDuration(Number(timer.durationMs));
    let remainingMs = clampDuration(Number(timer.remainingMs));
    const parsedStartedAt = Number(timer.startedAt);
    const parsedUpdatedAt = Number(timer.updatedAt);
    const startedAt = Number.isFinite(parsedStartedAt) ? parsedStartedAt : null;
    const updatedAt = Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : null;
    const isRunning = Boolean(timer.isRunning) && remainingMs > 0 && Number.isFinite(startedAt);

    if (!Number.isFinite(remainingMs)) {
        remainingMs = durationMs;
    }

    if (remainingMs > durationMs && durationMs > 0) {
        remainingMs = durationMs;
    }

    return {
        id: (typeof timer.id === 'string' && timer.id.trim().length > 0) ? timer.id.trim() : randomUUID(),
        name: name || '타이머',
        durationMs,
        remainingMs: isRunning ? Math.min(remainingMs, durationMs || remainingMs) : remainingMs,
        isRunning,
        startedAt: isRunning ? startedAt : null,
        updatedAt: updatedAt ?? null
    };
}

function validatePriceString(price, defaultValue) {
    // 문자열인지 확인
    if (typeof price === 'string' && price.length <= 30) {
        return price;
    }

    // 숫자인 경우 문자열로 변환 (기존 데이터 호환성)
    if (typeof price === 'number' && price >= 0 && price <= 100000) {
        return price.toString();
    }

    // 모든 검증 실패 시 기본값 반환
    return defaultValue;
}

// 공대원 항목 검증
function validateMember(m) {
    const nick = (typeof m.nickname === 'string') ? m.nickname.trim() : '';
    const job = (typeof m.job === 'string') ? m.job.trim() : '';
    // 닉네임/직업이 비어있으면 스킵되도록 기본값 제공
    return {
        nickname: nick || '-',
        job: job || '-'
    };
}
// 캐시 무효화
export function invalidateCache() {
    dataCache = null;
    lastCacheUpdate = 0;
}

// 캐시 상태 확인
export function getCacheStatus() {
    return {
        cached: dataCache !== null,
        lastUpdate: lastCacheUpdate,
        age: Date.now() - lastCacheUpdate
    };
}