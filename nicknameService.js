import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
// nicknameService.js
import { CONFIG } from './config.js';
import { validators, sendToChannel, withErrorHandling } from './utils.js';
import { readData } from './database.js';
import { formatHHMM, formatTodayMMDDKST } from './timeUtils.js';

// 현재 시간을 HH:MM 형식으로 가져오기
function getCurrentTimeFormatted() {
    const now = new Date();
    const koreanTime = new Date(now.getTime()); // UTC+9
    const hours = String(koreanTime.getHours()).padStart(2, '0');
    const minutes = String(koreanTime.getMinutes()).padStart(2, '0');
    return `[${hours}:${minutes}]`;
}

// 닉네임 변경 공통 함수
export const changeNickname = withErrorHandling(async (interaction, nickname, position = null) => {
    // 입력 검증
    if (!validators.isValidNickname(nickname)) {
        throw new Error('유효하지 않은 닉네임입니다. (1-32자)');
    }

    if (position && !validators.isValidPosition(position)) {
        throw new Error('유효하지 않은 순번입니다.');
    }

    const finalNickname = position ? formatNicknameWithPosition(nickname, position) : nickname;

    // 권한 검증
    await validatePermissions(interaction);

    // 닉네임 변경 실행
    await interaction.member.setNickname(finalNickname);

    return finalNickname;
});

// 순번에 따른 닉네임 포맷팅
function formatNicknameWithPosition(nickname, position) {
    const positionText = CONFIG.POSITION_MAPPING[position];
    const dateTag = `[${formatTodayMMDDKST()}]`;
    if (positionText) {
        return `${dateTag} ${positionText} ${nickname}`;
    }
    return `${dateTag} ${nickname}`;
}


// 권한 검증 함수
async function validatePermissions(interaction) {
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const userMember = interaction.member;

    // 봇 권한 확인
    if (!botMember.permissions.has('ManageNicknames') && !botMember.permissions.has('Administrator')) {
        throw new Error('봇에게 닉네임 관리 권한이 없습니다. 서버 관리자에게 문의해주세요.');
    }

    // 서버 소유자 확인
    if (userMember.id === interaction.guild.ownerId) {
        throw new Error('서버 소유자의 닉네임은 변경할 수 없습니다.');
    }

    // 역할 계층 확인
    if (userMember.roles.highest.position >= botMember.roles.highest.position && !botMember.permissions.has('Administrator')) {
        throw new Error(`봇의 역할(${botMember.roles.highest.name})이 회원님의 역할(${userMember.roles.highest.name})보다 낮아서 닉네임을 변경할 수 없습니다. 서버 관리자에게 문의해주세요.`);
    }
}

// 역할 부여 함수
export const assignGuestRole = withErrorHandling(async (member) => {
    try {
        const guestRole = member.guild.roles.cache.find(role => role.name === '손님');
        if (guestRole) {
            await member.roles.add(guestRole);
            return true;
        } else {
            console.log('"손님" 역할을 찾을 수 없습니다.');
            return false;
        }
    } catch (error) {
        console.error('역할 부여 오류:', error);
        return false;
    }
});

// 사용자 권한 확인 (손님인지 체크)
export function isGuestUser(member) {
    const userRoles = member.roles.cache.filter(role => role.name !== '@everyone');
    const hasOnlyGuestRole = userRoles.size === 1 && userRoles.some(role => role.name === '손님');
    const hasNoRole = userRoles.size === 0;

    return hasNoRole || hasOnlyGuestRole;
}

// 닉네임 변경 결과 메시지 전송
export const sendNicknameChangeMessage = withErrorHandling(async (client, oldName, newName) => {
    const message = `✅ 닉네임이 변경되었습니다!\n👤 ${oldName} → **${newName}**`;
    return await sendToChannel(client, CONFIG.CHANNELS.ANNOUNCEMENT, message);
});

// 신규 멤버 가입 메시지 전송
export const sendNewMemberMessage = withErrorHandling(async (client, nickname) => {
    const currentTime = getCurrentTimeFormatted();

    // 닉네임에서 순번 부분 추출
    let positionName = nickname;

    // CONFIG.POSITION_MAPPING의 모든 값들을 확인하여 닉네임에서 순번 찾기
    for (const [key, value] of Object.entries(CONFIG.POSITION_MAPPING)) {
        if (nickname.startsWith(value + ' ')) {
            positionName = value;
            break;
        }
    }

    const message = `${currentTime} 📢 신규 가입 알림! 👤**${nickname}** `;
    return await sendToChannel(client, CONFIG.CHANNELS.MANAGEMENT, message);
});



export const sendWelcomePrivateMessage = withErrorHandling(async (interaction) => {
    // 1) 캐시 강제 갱신
    await interaction.member.fetch(true);             // 멤버(역할 포함) 최신화
    await interaction.guild.roles.fetch();            // 길드 역할 목록 최신화

    // 2) '손님' 역할 ID 우선 사용 (CONFIG에 있으면 가장 안전)
    const GUEST_ID =
        CONFIG.ROLES?.GUEST_ID ??
        interaction.guild.roles.cache.find(r => r.name === '손님')?.id;

    const roles = interaction.member.roles.cache;

    // 3) 보유 여부 계산 (ID가 있으면 ID로, 없으면 이름으로)
    const hasGuestRole = GUEST_ID
        ? roles.has(GUEST_ID)
        : roles.some(r => r.name === '손님');

    const hasOtherRoles = roles.some(r =>
        (GUEST_ID ? r.id !== GUEST_ID : r.name !== '손님') &&
        r.name !== '@everyone'
    );

    // 4) 시간 계산 (1트 기준 30분 전)
    const shiftMinutes = (t, delta) => {
        if (!t) return undefined;
        const total = (t.hour * 60 + t.minute + delta) % 1440;
        const norm = total < 0 ? total + 1440 : total;
        return { hour: Math.floor(norm / 60), minute: norm % 60 };
    };

    const data = await readData();
    const t1 = data?.departureTimes?.turn1;      // { hour, minute } | undefined
    const t1Minus30 = shiftMinutes(t1, -30);

    // 5) 메시지들
    const longMessage = `
**예약이 정상적으로 완료되었습니다!**

**금일 ${formatHHMM(t1Minus30)} 까지 [엘나스] 혹은 [자쿰으로통하는문] 맵에 주차 후 https://discord.com/channels/1378989621987508244/1378989621987508251 접속 부탁드립니다.**

**https://discord.com/channels/1378989621987508244/1379346115983441990 내용을 꼭 숙지 부탁드립니다!**

**궁금하신점이 있으시다면 https://discord.com/channels/1378989621987508244/1384111491392868402 에 자유롭게 질문해주시면 됩니다.**
  `.trim();

    const shortMessage = `✅ 예약이 완료되었습니다`;

    // 6) 분기: 손님+다른 역할 ⇒ 짧은 멘트 / 그 외 ⇒ 긴 멘트
    const content = (hasGuestRole && hasOtherRoles) ? shortMessage : longMessage;

    return await interaction.followUp({
        content,
        components: [],
        ephemeral: true
    });
});


// 에러 메시지 매핑
export function getErrorMessage(error) {
    const errorMessages = {
        50013: '❌ 권한이 부족합니다. 서버 관리자에게 봇 권한 설정을 요청해주세요.',
        50035: '❌ 닉네임이 너무 깁니다. 32자 이하로 입력해주세요.',
        10013: '❌ 사용자를 찾을 수 없습니다.',
        10007: '❌ 알 수 없는 멤버입니다.'
    };

    if (error.code && errorMessages[error.code]) {
        return errorMessages[error.code];
    }

    return `❌ 닉네임 변경에 실패했습니다.\n오류: ${error.message}`;
}