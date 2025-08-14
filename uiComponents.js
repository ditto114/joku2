// uiComponents.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { CONFIG } from './config.js';
import { readData } from './database.js';

// 신규 가입자 메뉴 생성 (이미 예약된 항목 필터링)
export async function createNewUserMenu() {
    const embed = new EmbedBuilder()
        .setTitle('🎉 조쿠공대 신규 예약')
        .setDescription('조쿠공대를 찾아주셔서 진심으로 감사드립니다.\n아래 메뉴에서 순번을 선택해 주신 뒤, 예약 버튼을 클릭해주세요.')
        .setColor('#00ff00');

    // 데이터베이스에서 현재 예약 상태 확인
    const data = await readData();
    const availableOptions = [];

    // 각 순번의 예약 상태 확인하여 가능한 옵션만 추가
    if (data.reservations.turn1.first.customer === '-') {
        availableOptions.push({ label: '1트 1순', value: '1t1', emoji: '🥇' });
    }
    if (data.reservations.turn1.second.customer === '-') {
        availableOptions.push({ label: '1트 2순', value: '1t2', emoji: '🥈' });
    }
    if (data.reservations.turn1.third.customer === '-') {
        availableOptions.push({ label: '1트 3순', value: '1t3', emoji: '🥉' });
    }
    if (data.reservations.turn2.first.customer === '-') {
        availableOptions.push({ label: '2트 1순', value: '2t1', emoji: '🥇' });
    }
    if (data.reservations.turn2.second.customer === '-') {
        availableOptions.push({ label: '2트 2순', value: '2t2', emoji: '🥈' });
    }
    if (data.reservations.turn2.third.customer === '-') {
        availableOptions.push({ label: '2트 3순', value: '2t3', emoji: '🥉' });
    }
    if (data.reservations.skillbook1.customer === '-') {
        availableOptions.push({ label: '트스북', value: 'tris', emoji: '📖' });
        availableOptions.push({ label: '어콤북', value: 'arcom', emoji: '📘' });
    }
    if (data.reservations.skillbook2.customer === '-') {
        availableOptions.push({ label: '스킬북2', value: 'skillbook2', emoji: '📕' });
    }

    // 엔레먹자와 기타는 항상 가능
    availableOptions.push({ label: '엔레먹자', value: 'enre', emoji: '👼' });
    availableOptions.push({ label: '기타', value: 'other', emoji: '❓' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('new_user_position')
        .setPlaceholder('순번을 선택해주세요')
        .addOptions(availableOptions);

    const enterButton = new ButtonBuilder()
        .setCustomId('enter_guild')
        .setLabel('예약')
        .setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(enterButton);

    return { embeds: [embed], components: [row1, row2] };
}

// 메인 메뉴 생성
export function createMainMenu() {
    // 첫 번째 임베드 - 손님구인
    const embed1 = new EmbedBuilder()
        .setTitle('📋 손님구인')
        .setDescription('[구인양식] 버튼을 눌러 양식을 복사한 뒤 아래 채널에 홍보해주세요.\n\n📍 구인채널: <#1369614604426149908>\n\n구인 완료 시 https://discord.com/channels/1378989621987508244/1394622826287333376/1396482495989420152 이 내용대로 진행해주세요.\n손님 1명 당 100만 메소의 인센티브가 지급됩니다.\n')
        .setColor('#0099ff');

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('recruitment_template')
                .setLabel('구인양식')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('recruitment_complete')
                .setLabel('구인완료')
                .setStyle(ButtonStyle.Success)
        );

    // 두 번째 행 - 예약현황 관련
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('show_reservations')
                .setLabel('예약현황')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('table_manage')
                .setLabel('예약취소/초기화')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('price_change')
                .setLabel('시세변경')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('time_change')
                .setLabel('시간변경')
                .setStyle(ButtonStyle.Success)
        );

    return { embeds: [embed1], components: [row1, row2] };
}

// 구인완료 선택 메뉴 생성
export function createRecruitmentCompleteMenu() {
    const embed = new EmbedBuilder()
        .setTitle('📋 구인완료')
        .setDescription('등록할 순번을 선택해주세요.')
        .setColor('#00ff00');

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('turn1_first')
                .setLabel('1트1순')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('turn2_first')
                .setLabel('2트1순')
                .setStyle(ButtonStyle.Success)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('turn1_second')
                .setLabel('1트2순')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('turn2_second')
                .setLabel('2트2순')
                .setStyle(ButtonStyle.Success)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('turn1_third')
                .setLabel('1트3순')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('turn2_third')
                .setLabel('2트3순')
                .setStyle(ButtonStyle.Success)
        );

    const row4 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('skillbook1')
                .setLabel('스킬북1')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('skillbook2')
                .setLabel('스킬북2')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('enre_eat')
                .setLabel('엔레먹자')
                .setStyle(ButtonStyle.Danger)
        );

    return { embeds: [embed], components: [row1, row2, row3, row4] };
}

// 테이블 관리 메뉴 생성
export function createTableManageMenu() {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ 테이블 관리')
        .setDescription('초기화할 순번을 선택해주세요')
        .setColor('#ff0000');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('reset_selection')
        .setPlaceholder('초기화할 순번을 선택하세요')
        .setMinValues(0)
        .setMaxValues(9)
        .addOptions([
            { label: '1트 1순', value: 'turn1_first', emoji: '⬜' },
            { label: '1트 2순', value: 'turn1_second', emoji: '⬜' },
            { label: '1트 3순', value: 'turn1_third', emoji: '⬜' },
            { label: '2트 1순', value: 'turn2_first', emoji: '⬜' },
            { label: '2트 2순', value: 'turn2_second', emoji: '⬜' },
            { label: '2트 3순', value: 'turn2_third', emoji: '⬜' },
            { label: '스킬북1', value: 'skillbook1', emoji: '⬜' },
            { label: '스킬북2', value: 'skillbook2', emoji: '⬜' },
            { label: '엔레먹자', value: 'enre_eat', emoji: '⬜' }
        ]);

    const resetButton = new ButtonBuilder()
        .setCustomId('execute_reset')
        .setLabel('초기화')
        .setStyle(ButtonStyle.Danger);

    const resetAllButton = new ButtonBuilder()
        .setCustomId('execute_reset_all')
        .setLabel('모두 초기화')
        .setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(resetButton, resetAllButton);

    return { embeds: [embed], components: [row1, row2] };
}

// uiComponents.js (예약현황 임베드 부분만 수정)

// 예약현황 임베드 생성
export function createReservationStatusEmbed(reservationData, enreCustomers) {
    const { turn1, turn2, skillbook1, skillbook2, prices } = reservationData;

    const embed = new EmbedBuilder()
        .setTitle('📋 현재 예약 현황')
        .setColor('#0099ff')
        .addFields(
            {
                name: '🔸 1트',
                value: `**1순:** ${turn1.first || '구인중'}\n**2순:** ${turn1.second || '구인중'}\n**3순:** ${turn1.third || '구인중'}`,
                inline: true
            },
            {
                name: '🔹 2트',
                value: `**1순:** ${turn2.first || '구인중'}\n**2순:** ${turn2.second || '구인중'}\n**3순:** ${turn2.third || '구인중'}`,
                inline: true
            },
            {
                name: '\u200B',
                value: '\u200B',
                inline: true
            },
            {
                name: `📚 스킬북1${skillbook1.name}`,
                value: skillbook1.reservation || '구인중',
                inline: false
            },
            {
                name: `📚 스킬북2${skillbook2.name}`,
                value: skillbook2.reservation || '구인중',
                inline: false
            },
            {
                name: '👼 엔레먹자',
                value: enreCustomers.length > 0 ? enreCustomers.join(', ') : '구인중',
                inline: false
            },
            {
                name: '💰 현재 시세',
                value: `확투: ${prices.firstSecond}\n3순: ${prices.third}\n스킬북1: ${prices.skillbook1}\n스킬북2: ${prices.skillbook2}`,
                inline: false
            }
        )
        .setTimestamp();

    return embed;
}

// 에러 메시지 임베드 생성
export function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setColor('#ff0000')
        .setTimestamp();
}

// 성공 메시지 임베드 생성
export function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setColor('#00ff00')
        .setTimestamp();
}

// 정보 메시지 임베드 생성
export function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setColor('#0099ff')
        .setTimestamp();
}