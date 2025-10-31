// config.js
export const CONFIG = {
    // 채널 설정
    CHANNELS: {
        ANNOUNCEMENT: '1393544289052528710',  // 공지용 채널
        MANAGEMENT: '1394981387643392221',    // 관리용 채널
        SHORTCUT: '1369614604426149908'       // 바로가기 채널
    },

    // 데이터베이스 설정
    DATABASE: {
        FILE_PATH: './database.json'
    },

    // 기본 데이터 구조
    DEFAULT_DATA: {
        prices: {
            firstSecond: "1000",   // 문자열로 변경 - 1,2순 시세
            third: "800",          // 문자열로 변경 - 3순 시세
            skillbook1: "1000",    // 문자열로 변경 - 스킬북1 시세
            skillbook2: "300"      // 문자열로 변경 - 스킬북2 시세
        },
        // 공대원 명단
        guildMembers: [
            // { nickname: '대칭', job: '전사' }
        ],
        reservations: {
            turn1: {
                first: { customer: '-', incentiveMember: '-', deposit: 0 },
                second: { customer: '-', incentiveMember: '-', deposit: 0 },
                third: { customer: '-', incentiveMember: '-', deposit: 0 }
            },
            turn2: {
                first: { customer: '-', incentiveMember: '-', deposit: 0 },
                second: { customer: '-', incentiveMember: '-', deposit: 0 },
                third: { customer: '-', incentiveMember: '-', deposit: 0 }
            },
            skillbook1: { customer: '-', incentiveMember: '-', deposit: 0, skillbookName: '-' },
            skillbook2: { customer: '-', incentiveMember: '-', deposit: 0, skillbookName: '-' },
            enreEat: [] // 엔레먹자를 배열로 데이터베이스에 저장
        },
        departureTimes: {
            turn1: { hour: 20, minute: 30 },  // 1트 출발시간 기본값
            turn2: { hour: 21, minute: 30 }   // 2트 출발시간 기본값
        },
        timers: []
    },

    // 순번 매핑
    POSITION_MAPPING: {
        '1t1': '1트 1순',
        '1t2': '1트 2순',
        '1t3': '1트 3순',
        '2t1': '2트 1순',
        '2t2': '2트 2순',
        '2t3': '2트 3순',
        'tris': '트스북',
        'arcom': '어콤북',
        'skillbook1': '스킬북1',
        'skillbook2': '스킬북2',
        'enre': '엔레먹자',
        'other': '기타'
    },

    // 버튼 ID 매핑
    BUTTON_POSITION_MAPPING: {
        'turn1_first': '1트1순',
        'turn1_second': '1트2순',
        'turn1_third': '1트3순',
        'turn2_first': '2트1순',
        'turn2_second': '2트2순',
        'turn2_third': '2트3순',
        'skillbook1': '스킬북1',
        'skillbook2': '스킬북2'
    }
};