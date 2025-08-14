// utils.js
import { CONFIG } from './config.js';

// 한국 시간 포맷 함수
export function getKoreanTime() {
    const now = new Date();
    const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9

    const year = koreanTime.getFullYear();
    const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
    const day = String(koreanTime.getDate()).padStart(2, '0');
    const hours = String(koreanTime.getHours()).padStart(2, '0');
    const minutes = String(koreanTime.getMinutes()).padStart(2, '0');

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[koreanTime.getDay()];

    return `${year}.${month}.${day} ${hours}:${minutes} (${weekday})`;
}

// 글자수 계산 함수 (한글 1글자, 영어/숫자 0.5글자)
export function calculateStringLength(str) {
    let length = 0;
    for (let char of str) {
        // 한글 범위: 가-힣, ㄱ-ㅎ, ㅏ-ㅣ
        if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char)) {
            length += 1; // 한글 1글자
        } else if (/[a-zA-Z0-9]/.test(char)) {
            length += 0.5; // 영어/숫자 0.5글자
        } else {
            // 특수문자는 허용하지 않음
            return -1;
        }
    }
    return length;
}

// 데이터 검증 함수들
export const validators = {
    // 숫자 검증
    isValidNumber: (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
        const num = parseInt(value);
        return !isNaN(num) && num >= min && num <= max;
    },

    // 닉네임 검증 (한글 1글자, 영어/숫자 0.5글자로 총 6글자까지, 특수문자 불허)
    isValidNickname: (nickname) => {
        if (!nickname || typeof nickname !== 'string') {
            return false;
        }

        const trimmed = nickname.trim();
        if (trimmed.length === 0) {
            return false;
        }

        const calculatedLength = calculateStringLength(trimmed);

        // 특수문자가 포함되어 있거나 길이가 6을 초과하면 false
        return calculatedLength > 0 && calculatedLength <= 6;
    },

    // 순번 검증
    isValidPosition: (position) => {
        return Object.keys(CONFIG.POSITION_MAPPING).includes(position);
    },

    // 스킬북 이름 검증
    isValidSkillbookName: (name) => {
        if (!name || typeof name !== 'string') {
            return false;
        }

        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return true; // 빈 문자열 허용
        }

        const calculatedLength = calculateStringLength(trimmed);
        return calculatedLength > 0 && calculatedLength <= 6;
    },

    // 시간 검증
    isValidHour: (hour) => {
        const num = parseInt(hour);
        return !isNaN(num) && num >= 0 && num <= 23;
    },

    isValidMinute: (minute) => {
        const num = parseInt(minute);
        return !isNaN(num) && num >= 0 && num <= 59;
    }
};

// 시간 포맷팅 함수
export function formatTime(hour, minute) {
    return `${hour}시 ${minute === 0 ? '' : minute + '분'}`.trim();
}

// 예약 데이터 포맷팅 함수
export function formatReservation(reservation) {
    if (reservation.customer === '-' || reservation.customer === '') {
        return '';
    }
    return `${reservation.customer} (${reservation.incentiveMember} / ${reservation.deposit})`;
}

// 구인 상태 체크 함수
export function checkRecruitmentStatus(reservation) {
    return reservation.customer !== '-' ? ':x: 마감' : ':green_circle: 가능';
}

// 채널 메시지 전송 함수
export async function sendToChannel(client, channelId, message) {
    try {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            await channel.send(message);
            return true;
        } else {
            console.error(`채널을 찾을 수 없습니다: ${channelId}`);
            return false;
        }
    } catch (error) {
        console.error('메시지 전송 오류:', error);
        return false;
    }
}

// 에러 처리 래퍼 함수
export function withErrorHandling(fn) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error('함수 실행 중 오류:', error);
            throw error;
        }
    };
}

// 메모리 정리 함수들
export const memoryManager = {
    // Map 크기 제한
    limitMapSize: (map, maxSize = 100) => {
        if (map.size > maxSize) {
            const keysToDelete = Array.from(map.keys()).slice(0, map.size - maxSize);
            keysToDelete.forEach(key => map.delete(key));
        }
    },

    // Set 크기 제한
    limitSetSize: (set, maxSize = 100) => {
        if (set.size > maxSize) {
            const valuesToDelete = Array.from(set).slice(0, set.size - maxSize);
            valuesToDelete.forEach(value => set.delete(value));
        }
    },

    // 오래된 데이터 정리 (30분 이상 된 데이터)
    cleanOldData: (dataMap, maxAge = 30 * 60 * 1000) => {
        const now = Date.now();
        for (const [key, value] of dataMap.entries()) {
            if (value.timestamp && now - value.timestamp > maxAge) {
                dataMap.delete(key);
            }
        }
    }
};