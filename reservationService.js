// reservationService.js
import { readData, saveData } from './database.js';
import { validators, formatReservation, checkRecruitmentStatus, sendToChannel, withErrorHandling } from './utils.js';
import { CONFIG } from './config.js';
import { notifyUpdate } from './realtime.js';

// 현재 시간을 HH:MM 형식으로 가져오기
function getCurrentTimeFormatted() {
    const now = new Date();
    const koreanTime = new Date(now.getTime()); // UTC+9
    const hours = String(koreanTime.getHours()).padStart(2, '0');
    const minutes = String(koreanTime.getMinutes()).padStart(2, '0');
    return `[${hours}:${minutes}]`;
}

// 예약 완료 처리
export const completeReservation = withErrorHandling(async (client, position, reservationData) => {
    // 데이터 검증
    validateReservationData(reservationData);

    const data = await readData();

    // 위치에 따라 데이터 저장
    updateReservationData(data, position, reservationData);

    // 데이터베이스 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('데이터 저장에 실패했습니다.');
    }

    // 완료 메시지 전송
    await sendReservationCompleteMessage(client, position, reservationData);
    notifyUpdate('completeReservation');

    return true;
});

// 엔레먹자 추가 처리
export const addEnreCustomer = withErrorHandling(async (client, customerNickname) => {
    const data = await readData();

    // 엔레먹자 목록에 추가
    if (!data.reservations.enreEat) {
        data.reservations.enreEat = [];
    }
    data.reservations.enreEat.push(customerNickname);

    // 데이터베이스 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('데이터 저장에 실패했습니다.');
    }

    const message = `🍖 엔레먹자!\n👤 손님: ${customerNickname}`;
    await sendToChannel(client, CONFIG.CHANNELS.ANNOUNCEMENT, message);

    return true;
});

// 예약 데이터 검증
function validateReservationData(data) {
    const { myNickname, customerNickname, depositAmount, skillbookName } = data;

    if (!validators.isValidNickname(myNickname)) {
        throw new Error('인센티브 멤버 닉네임이 유효하지 않습니다. (한글 1글자, 영어/숫자 0.5글자로 총 6글자까지, 특수문자 불허)');
    }

    if (!validators.isValidNickname(customerNickname)) {
        throw new Error('손님 닉네임이 유효하지 않습니다. (한글 1글자, 영어/숫자 0.5글자로 총 6글자까지, 특수문자 불허)');
    }

    if (!validators.isValidNumber(depositAmount, 0, 1000)) {
        throw new Error('예약금은 0-1000 사이의 숫자여야 합니다.');
    }

    if (skillbookName && !validators.isValidSkillbookName(skillbookName)) {
        throw new Error('스킬북 이름이 유효하지 않습니다. (한글 1글자, 영어/숫자 0.5글자로 총 6글자까지, 특수문자 불허)');
    }
}

// 예약 데이터 업데이트
function updateReservationData(data, position, reservationData) {
    const { myNickname, customerNickname, depositAmount, skillbookName } = reservationData;
    const deposit = parseInt(depositAmount) || 0;

    const reservation = {
        customer: customerNickname,
        incentiveMember: myNickname,
        deposit: deposit
    };

    switch (position) {
        case 'turn1_first':
            data.reservations.turn1.first = reservation;
            break;
        case 'turn1_second':
            data.reservations.turn1.second = reservation;
            break;
        case 'turn1_third':
            data.reservations.turn1.third = reservation;
            break;
        case 'turn2_first':
            data.reservations.turn2.first = reservation;
            break;
        case 'turn2_second':
            data.reservations.turn2.second = reservation;
            break;
        case 'turn2_third':
            data.reservations.turn2.third = reservation;
            break;
        case 'skillbook1':
            data.reservations.skillbook1 = {
                ...reservation,
                skillbookName: skillbookName || '-'
            };
            break;
        case 'skillbook2':
            data.reservations.skillbook2 = {
                ...reservation,
                skillbookName: skillbookName || '-'
            };
            break;
        default:
            throw new Error('유효하지 않은 예약 위치입니다.');
    }
}

// 예약 완료 메시지 전송
async function sendReservationCompleteMessage(client, position, reservationData) {
    const { myNickname, customerNickname, depositAmount, skillbookName } = reservationData;
    const currentTime = getCurrentTimeFormatted();

    let positionName = CONFIG.BUTTON_POSITION_MAPPING[position];

    // 스킬북의 경우 이름을 함께 표시
    if ((position === 'skillbook1' || position === 'skillbook2') && skillbookName && skillbookName !== '-') {
        positionName = `${positionName}(${skillbookName})`;
    }

    const message = `${currentTime} 📢 구인완료!! ${positionName} 👤${customerNickname} 🎯${myNickname} 💰예약금 ${depositAmount}`;

    await sendToChannel(client, CONFIG.CHANNELS.MANAGEMENT, message);
}

// 예약 초기화
export const resetReservations = withErrorHandling(async (client, selectedItems) => {
    if (!selectedItems || selectedItems.size === 0) {
        throw new Error('초기화할 항목을 선택해주세요.');
    }

    const data = await readData();
    const resetItems = [];

    // 선택된 항목들 초기화
    selectedItems.forEach(item => {
        const resetResult = resetSingleReservation(data, item);
        if (resetResult) {
            resetItems.push(resetResult);
        }
    });

    // 데이터 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('초기화에 실패했습니다.');
    }

    // 초기화 완료 메시지 전송
    const message = `🗑️ 다음 항목이 초기화되었습니다:\n${resetItems.join(', ')}`;
    await sendToChannel(client, CONFIG.CHANNELS.ANNOUNCEMENT, message);
    notifyUpdate('resetReservations');

    return resetItems;
});

// 단일 예약 초기화
function resetSingleReservation(data, item) {
    const emptyReservation = { customer: '-', incentiveMember: '-', deposit: 0 };

    switch (item) {
        case 'turn1_first':
            data.reservations.turn1.first = { ...emptyReservation };
            return '1트1순';
        case 'turn1_second':
            data.reservations.turn1.second = { ...emptyReservation };
            return '1트2순';
        case 'turn1_third':
            data.reservations.turn1.third = { ...emptyReservation };
            return '1트3순';
        case 'turn2_first':
            data.reservations.turn2.first = { ...emptyReservation };
            return '2트1순';
        case 'turn2_second':
            data.reservations.turn2.second = { ...emptyReservation };
            return '2트2순';
        case 'turn2_third':
            data.reservations.turn2.third = { ...emptyReservation };
            return '2트3순';
        case 'skillbook1':
            data.reservations.skillbook1 = { ...emptyReservation, skillbookName: '-' };
            return '스킬북1';
        case 'skillbook2':
            data.reservations.skillbook2 = { ...emptyReservation, skillbookName: '-' };
            return '스킬북2';
        case 'enre_eat':
            data.reservations.enreEat = [];
            return '엔레먹자';
        default:
            return null;
    }
}

// 모든 예약 초기화
export const resetAllReservations = withErrorHandling(async (client) => {
    const data = await readData();

    // 모든 항목 초기화
    const emptyReservation = { customer: '-', incentiveMember: '-', deposit: 0 };

    data.reservations.turn1.first = { ...emptyReservation };
    data.reservations.turn1.second = { ...emptyReservation };
    data.reservations.turn1.third = { ...emptyReservation };
    data.reservations.turn2.first = { ...emptyReservation };
    data.reservations.turn2.second = { ...emptyReservation };
    data.reservations.turn2.third = { ...emptyReservation };
    data.reservations.skillbook1 = { ...emptyReservation, skillbookName: '-' };
    data.reservations.skillbook2 = { ...emptyReservation, skillbookName: '-' };
    data.reservations.enreEat = [];

    // 데이터 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('초기화에 실패했습니다.');
    }

    // 초기화 완료 메시지 전송
    const message = '🗑️ 모든 예약이 초기화되었습니다!';
    await sendToChannel(client, CONFIG.CHANNELS.ANNOUNCEMENT, message);
    notifyUpdate('resetAllReservations');

    return true;
});

// 시세 변경
export const updatePrices = withErrorHandling(async (client, priceData) => {
    // 데이터 검증
    validatePriceData(priceData);

    const data = await readData();

    // 시세 업데이트 - 문자열로 그대로 저장
    data.prices.firstSecond = priceData.firstSecond || data.prices.firstSecond;
    data.prices.third = priceData.third || data.prices.third;
    data.prices.skillbook1 = priceData.skillbook1 || data.prices.skillbook1;
    data.prices.skillbook2 = priceData.skillbook2 || data.prices.skillbook2;

    // 데이터 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('시세 변경에 실패했습니다.');
    }

    // 시세 변경 완료 메시지 전송
    const message = `💰 시세가 변경되었습니다!\n🏆 확투(1,2순): ${data.prices.firstSecond}\n🥉 3순: ${data.prices.third}\n📚 스킬북1: ${data.prices.skillbook1}\n📖 스킬북2: ${data.prices.skillbook2}`;
    await sendToChannel(client, CONFIG.CHANNELS.MANAGEMENT, message);
    notifyUpdate('updatePrices');

    return true;
});


// 출발시간 변경
export const updateDepartureTimes = withErrorHandling(async (client, timeData) => {
    // 데이터 검증
    validateTimeData(timeData);

    const data = await readData();

    // 출발시간 업데이트
    if (timeData.turn1Hour !== undefined && timeData.turn1Minute !== undefined) {
        data.departureTimes.turn1 = {
            hour: parseInt(timeData.turn1Hour),
            minute: parseInt(timeData.turn1Minute)
        };
    }

    if (timeData.turn2Hour !== undefined && timeData.turn2Minute !== undefined) {
        data.departureTimes.turn2 = {
            hour: parseInt(timeData.turn2Hour),
            minute: parseInt(timeData.turn2Minute)
        };
    }

    // 데이터 저장
    const saved = await saveData(data);
    if (!saved) {
        throw new Error('출발시간 변경에 실패했습니다.');
    }

    // 출발시간 변경 완료 메시지 전송
    const turn1Time = `${data.departureTimes.turn1.hour}:${String(data.departureTimes.turn1.minute).padStart(2, '0')}`;
    const turn2Time = `${data.departureTimes.turn2.hour}:${String(data.departureTimes.turn2.minute).padStart(2, '0')}`;
    const message = `⏰ 출발시간이 변경되었습니다!\n🔸 1트: ${turn1Time}\n🔹 2트: ${turn2Time}`;
    await sendToChannel(client, CONFIG.CHANNELS.MANAGEMENT, message);
    notifyUpdate('updateDepartureTimes');

    return true;
});

// 시세 데이터 검증
function validatePriceData(priceData) {
    const { firstSecond, third, skillbook1, skillbook2 } = priceData;

    // 기본 문자열 검증
    if (firstSecond && (typeof firstSecond !== 'string' || firstSecond.length > 20)) {
        throw new Error('확투 시세는 20자 이하의 문자열이어야 합니다.');
    }

    if (third && (typeof third !== 'string' || third.length > 20)) {
        throw new Error('3순 시세는 20자 이하의 문자열이어야 합니다.');
    }

    if (skillbook1 && (typeof skillbook1 !== 'string' || skillbook1.length > 30)) {
        throw new Error('스킬북1 시세는 30자 이하의 문자열이어야 합니다.');
    }

    if (skillbook2 && (typeof skillbook2 !== 'string' || skillbook2.length > 30)) {
        throw new Error('스킬북2 시세는 30자 이하의 문자열이어야 합니다.');
    }
}

// 시간 데이터 검증
function validateTimeData(timeData) {
    const { turn1Hour, turn1Minute, turn2Hour, turn2Minute } = timeData;

    if (turn1Hour !== undefined && !validators.isValidHour(turn1Hour)) {
        throw new Error('1트 출발 시간(시)은 0-23 사이의 숫자여야 합니다.');
    }

    if (turn1Minute !== undefined && !validators.isValidMinute(turn1Minute)) {
        throw new Error('1트 출발 시간(분)은 0-59 사이의 숫자여야 합니다.');
    }

    if (turn2Hour !== undefined && !validators.isValidHour(turn2Hour)) {
        throw new Error('2트 출발 시간(시)은 0-23 사이의 숫자여야 합니다.');
    }

    if (turn2Minute !== undefined && !validators.isValidMinute(turn2Minute)) {
        throw new Error('2트 출발 시간(분)은 0-59 사이의 숫자여야 합니다.');
    }
}

// 예약 현황 조회
function normalizeReservationDetail(reservation = {}) {
    const customer = typeof reservation.customer === 'string' ? reservation.customer.trim() : '';
    const incentive = typeof reservation.incentiveMember === 'string' ? reservation.incentiveMember.trim() : '';
    const rawDeposit = reservation.deposit;
    const depositNumber = typeof rawDeposit === 'number' ? rawDeposit : parseInt(rawDeposit, 10);
    const hasReservation = !!customer && customer !== '-';

    return {
        hasReservation,
        nickname: hasReservation ? customer : '',
        incentive: hasReservation && incentive !== '-' ? incentive : '',
        deposit: hasReservation && !Number.isNaN(depositNumber) ? depositNumber : null,
        rawDeposit,
        skillbookName: typeof reservation.skillbookName === 'string' && reservation.skillbookName !== '-' ? reservation.skillbookName : ''
    };
}

export const getReservationStatus = withErrorHandling(async () => {
    const data = await readData();

    const turn1Details = {
        first: normalizeReservationDetail(data.reservations.turn1.first),
        second: normalizeReservationDetail(data.reservations.turn1.second),
        third: normalizeReservationDetail(data.reservations.turn1.third)
    };

    const turn2Details = {
        first: normalizeReservationDetail(data.reservations.turn2.first),
        second: normalizeReservationDetail(data.reservations.turn2.second),
        third: normalizeReservationDetail(data.reservations.turn2.third)
    };

    const skillbook1Detail = normalizeReservationDetail(data.reservations.skillbook1);
    const skillbook2Detail = normalizeReservationDetail(data.reservations.skillbook2);

    return {
        // 공대원 명단 포함
        guildMembers: Array.isArray(data.guildMembers) ? data.guildMembers : [],
        turn1: {
            first: formatReservation(data.reservations.turn1.first),
            second: formatReservation(data.reservations.turn1.second),
            third: formatReservation(data.reservations.turn1.third)
        },
        turn2: {
            first: formatReservation(data.reservations.turn2.first),
            second: formatReservation(data.reservations.turn2.second),
            third: formatReservation(data.reservations.turn2.third)
        },
        turn1Details,
        turn2Details,
        skillbook1: {
            reservation: formatReservation(data.reservations.skillbook1),
            name: data.reservations.skillbook1.skillbookName && data.reservations.skillbook1.skillbookName !== '-'
                ? `(${data.reservations.skillbook1.skillbookName})`
                : ''
        },
        skillbook2: {
            reservation: formatReservation(data.reservations.skillbook2),
            name: data.reservations.skillbook2.skillbookName && data.reservations.skillbook2.skillbookName !== '-'
                ? `(${data.reservations.skillbook2.skillbookName})`
                : ''
        },
        skillbookDetails: {
            skillbook1: skillbook1Detail,
            skillbook2: skillbook2Detail
        },
        enreEat: data.reservations.enreEat || [],
        prices: data.prices,
        departureTimes: data.departureTimes
    };
});

// 구인 템플릿 생성
export const generateRecruitmentTemplate = withErrorHandling(async () => {
    const data = await readData();

    // 랜덤 멘트 선택
    const ment1Options = ["자쿰", "눕클", "자투", "쿰구"];
    const ment2Options = ["다수", "다수보유", "많음", "多"];
    const ment3Options = ["안전운영", "안전하게"];
    const ment4Options = ["(사고X)", "(사고NO)", "(사고걱정X)", "(사고걱정NO)"];

    const ment1 = ment1Options[Math.floor(Math.random() * ment1Options.length)];
    const ment2 = ment2Options[Math.floor(Math.random() * ment2Options.length)];
    const ment3 = ment3Options[Math.floor(Math.random() * ment3Options.length)];
    const ment4 = ment4Options[Math.floor(Math.random() * ment4Options.length)];

    // 현재 날짜 정보
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[now.getDay()];

    // 출발시간 정보
    const turn1Time = data.departureTimes?.turn1 || { hour: 20, minute: 30 };
    const turn2Time = data.departureTimes?.turn2 || { hour: 21, minute: 30 };

    const formatTime = (hour, minute) => `${hour}시 ${minute === 0 ? '' : minute + '분'}`.trim();
    const turn1TimeStr = formatTime(turn1Time.hour, turn1Time.minute);
    const turn2TimeStr = formatTime(turn2Time.hour, turn2Time.minute);

    // 시세 정보
    const prices = data.prices;

    // 숫자 계산이 필요한 부분에서만 숫자 추출 함수 사용
    const extractFirstNumber = (str) => {
        const match = str.toString().match(/(\d+)/);
        return match ? match[1] : str;
    };

    // 각 순번의 구인 여부 확인
    const getStatus = (reservation) => checkRecruitmentStatus(reservation);
    const getStatusText = (reservation) => reservation.customer !== '-' ? '마감' : '가능';

    const template = `:fire:카스공대 ${ment1}:fire: :one::alarm_clock:${turn1Time.hour} : ${turn1Time.minute === 0 ? '00' : turn1Time.minute} :two::alarm_clock:${turn2Time.hour} : ${turn2Time.minute === 0 ? '00' : turn2Time.minute} :green_circle:가능:x:마감
:one:【${getStatus(data.reservations.turn1.first)}/${getStatus(data.reservations.turn1.second)}확투 ${prices.firstSecond}】【${getStatus(data.reservations.turn1.third)}3순 ${prices.third}】【${getStatus(data.reservations.skillbook1)}트스 ${prices.skillbook1}】
:two:【${getStatus(data.reservations.turn2.first)}/${getStatus(data.reservations.turn2.second)}확투 ${prices.firstSecond}】【${getStatus(data.reservations.skillbook2)}어콤/어차/엔레 ${prices.skillbook2}】 `;
    return template;
});