// buttonHandlers.js
import { deleteInteractionMessage } from './memoryManager.js';
import { getKoreanTime, sendToChannel, withErrorHandling } from './utils.js';
import { CONFIG } from './config.js';
import {
    createRecruitmentCompleteMenu,
    createTableManageMenu,
    createReservationStatusEmbed,
    createErrorEmbed
} from './uiComponents.js';
import {
    resetReservations,
    resetAllReservations,
    getReservationStatus,
    generateRecruitmentTemplate
} from './reservationService.js';
import {
    isGuestUser
} from './nicknameService.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

// 버튼 상호작용 처리
export const handleButtonInteractions = withErrorHandling(async (interaction) => {
    switch (interaction.customId) {
        case 'execute_reset':
            await handleExecuteReset(interaction);
            break;

        case 'execute_reset_all':
            await handleExecuteResetAll(interaction);
            break;

        case 'price_change':
            await handlePriceChange(interaction);
            break;

        case 'time_change':
            await handleTimeChange(interaction);
            break;

        case 'recruitment_template':
            await handleRecruitmentTemplate(interaction);
            break;

        case 'recruitment_complete':
            await handleRecruitmentComplete(interaction);
            break;

        case 'table_manage':
            await handleTableManage(interaction);
            break;

        case 'enter_guild':
            await handleEnterGuild(interaction);
            break;

        case 'show_reservations':
            await handleShowReservations(interaction);
            break;

        // 구인완료 순번 선택 버튼들
        case 'turn1_first':
        case 'turn1_second':
        case 'turn1_third':
        case 'turn2_first':
        case 'turn2_second':
        case 'turn2_third':
        case 'skillbook1':
        case 'skillbook2':
        case 'enre_eat':
            await handlePositionSelection(interaction);
            break;

        default:
            console.log(`처리되지 않은 버튼: ${interaction.customId}`);
            break;
    }
});

// 선택된 항목 초기화 실행
async function handleExecuteReset(interaction) {
    const { globalState } = await import('./memoryManager.js');
    const selectedItems = globalState.getResetItems();

    if (selectedItems.size === 0) {
        throw new Error('초기화할 항목을 선택해주세요!');
    }

    const resetItems = await resetReservations(interaction.client, selectedItems);

    await interaction.reply({
        content: '선택된 항목이 성공적으로 초기화되었습니다!',
        ephemeral: true
    });

    globalState.clearResetItems();
    deleteInteractionMessage('tableManage');
}

// 모든 항목 초기화 실행
async function handleExecuteResetAll(interaction) {
    await resetAllReservations(interaction.client);

    await interaction.reply({
        content: '모든 항목이 성공적으로 초기화되었습니다!',
        ephemeral: true
    });

    deleteInteractionMessage('tableManage');
}

// 구인완료 메뉴 표시
async function handleRecruitmentComplete(interaction) {
    const menu = createRecruitmentCompleteMenu();
    const reply = await interaction.reply({ ...menu, ephemeral: true });

    const { globalState } = await import('./memoryManager.js');
    globalState.setInteractionData('recruitment', {
        interaction: interaction,
        messageId: reply.id
    });
}

// 테이블 관리 메뉴 표시
async function handleTableManage(interaction) {
    const menu = createTableManageMenu();
    const reply = await interaction.reply({ ...menu, ephemeral: true });

    const { globalState } = await import('./memoryManager.js');
    globalState.setInteractionData('tableManage', {
        interaction: interaction,
        messageId: reply.id
    });
}

// 신규 가입자 입장 처리
async function handleEnterGuild(interaction) {
    const userMember = interaction.member;

    // 역할 확인
    if (!isGuestUser(userMember)) {
        throw new Error('손님이 아니면 이용할 수 없는 기능입니다');
    }

    const userId = interaction.user.id;
    const { globalState } = await import('./memoryManager.js');
    const selectedPosition = globalState.getUserSelection(userId);

    if (!selectedPosition) {
        throw new Error('먼저 순번을 선택해주세요!');
    }

    const modal = createNewUserModal(selectedPosition);
    await interaction.showModal(modal);
}

// 시세 변경 모달 표시
async function handlePriceChange(interaction) {
    const modal = await createPriceChangeModal();
    await interaction.showModal(modal);
}

// 시간 변경 모달 표시
async function handleTimeChange(interaction) {
    const modal = await createTimeChangeModal();
    await interaction.showModal(modal);
}

// 구인 템플릿 전송
async function handleRecruitmentTemplate(interaction) {
    const template = await generateRecruitmentTemplate();
    await interaction.reply({ content: template, ephemeral: true });
}

// 예약 현황 표시
async function handleShowReservations(interaction) {
    const reservationData = await getReservationStatus();
    const enreCustomers = reservationData.enreEat;

    const embed = createReservationStatusEmbed(reservationData, enreCustomers);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 순번 선택 처리 (구인완료)
async function handlePositionSelection(interaction) {
    if (interaction.customId === 'enre_eat') {
        const modal = createEnreEatModal();
        await interaction.showModal(modal);
    } else {
        const modal = createReservationModal(interaction.customId);
        await interaction.showModal(modal);
    }
}

// 모달 생성 함수들
function createNewUserModal(selectedPosition) {
    const positionNames = CONFIG.POSITION_MAPPING;

    const modal = new ModalBuilder()
        .setCustomId(`new_user_modal_${selectedPosition}`)
        .setTitle(positionNames[selectedPosition] || '신규 가입');

    const nicknameInput = new TextInputBuilder()
        .setCustomId('nickname_input')
        .setLabel('메이플랜드 닉네임을 입력해주세요.')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('메랜 인게임 닉네임만 적어주세요!')
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(nicknameInput);
    modal.addComponents(row);

    return modal;
}

async function createPriceChangeModal() {
    const { readData } = await import('./database.js');
    const data = await readData();

    const modal = new ModalBuilder()
        .setCustomId('price_change_modal')
        .setTitle('시세 변경');

    const firstSecondPriceInput = new TextInputBuilder()
        .setCustomId('first_second_price')
        .setLabel('확투 시세')
        .setStyle(TextInputStyle.Short)
        .setValue(data.prices.firstSecond.toString())
        .setRequired(true);

    const thirdPriceInput = new TextInputBuilder()
        .setCustomId('third_price')
        .setLabel('3순 시세')
        .setStyle(TextInputStyle.Short)
        .setValue(data.prices.third.toString())
        .setRequired(true);

    const skillbook1PriceInput = new TextInputBuilder()
        .setCustomId('skillbook1_price')
        .setLabel('스킬북1 시세')
        .setStyle(TextInputStyle.Short)
        .setValue(data.prices.skillbook1.toString())
        .setRequired(true);

    const skillbook2PriceInput = new TextInputBuilder()
        .setCustomId('skillbook2_price')
        .setLabel('스킬북2 시세')
        .setStyle(TextInputStyle.Short)
        .setValue(data.prices.skillbook2.toString())
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(firstSecondPriceInput);
    const row2 = new ActionRowBuilder().addComponents(thirdPriceInput);
    const row3 = new ActionRowBuilder().addComponents(skillbook1PriceInput);
    const row4 = new ActionRowBuilder().addComponents(skillbook2PriceInput);

    modal.addComponents(row1, row2, row3, row4);

    return modal;
}

async function createTimeChangeModal() {
    const { readData } = await import('./database.js');
    const data = await readData();

    const modal = new ModalBuilder()
        .setCustomId('time_change_modal')
        .setTitle('출발시간 변경');

    const turn1HourInput = new TextInputBuilder()
        .setCustomId('turn1_hour')
        .setLabel('1트 출발시간 (시)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.departureTimes.turn1.hour.toString())
        .setPlaceholder('0-23')
        .setRequired(true);

    const turn1MinuteInput = new TextInputBuilder()
        .setCustomId('turn1_minute')
        .setLabel('1트 출발시간 (분)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.departureTimes.turn1.minute.toString())
        .setPlaceholder('0-59')
        .setRequired(true);

    const turn2HourInput = new TextInputBuilder()
        .setCustomId('turn2_hour')
        .setLabel('2트 출발시간 (시)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.departureTimes.turn2.hour.toString())
        .setPlaceholder('0-23')
        .setRequired(true);

    const turn2MinuteInput = new TextInputBuilder()
        .setCustomId('turn2_minute')
        .setLabel('2트 출발시간 (분)')
        .setStyle(TextInputStyle.Short)
        .setValue(data.departureTimes.turn2.minute.toString())
        .setPlaceholder('0-59')
        .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(turn1HourInput);
    const row2 = new ActionRowBuilder().addComponents(turn1MinuteInput);
    const row3 = new ActionRowBuilder().addComponents(turn2HourInput);
    const row4 = new ActionRowBuilder().addComponents(turn2MinuteInput);

    modal.addComponents(row1, row2, row3, row4);

    return modal;
}

function createEnreEatModal() {
    const modal = new ModalBuilder()
        .setCustomId('enre_eat_modal')
        .setTitle('엔레먹자');

    const customerNicknameInput = new TextInputBuilder()
        .setCustomId('customer_nickname')
        .setLabel('손님 닉네임을 입력해주세요')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('정확히 입력해주세요')
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(customerNicknameInput);
    modal.addComponents(row);

    return modal;
}

function createReservationModal(position) {
    let positionName = CONFIG.BUTTON_POSITION_MAPPING[position];
    let modalTitle = `${positionName} 구인 정보 입력`;

    // 스킬북 모달 제목 수정
    if (position === 'skillbook1') {
        modalTitle = '스킬북1 구인 정보 입력';
    } else if (position === 'skillbook2') {
        modalTitle = '스킬북2 구인 정보 입력';
    }

    const modal = new ModalBuilder()
        .setCustomId(`complete_${position}`)
        .setTitle(modalTitle);

    const myNicknameInput = new TextInputBuilder()
        .setCustomId('my_nickname')
        .setLabel('인센티브 받으실 분의 닉네임을 입력해주세요.(손님 데려오신분)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('예: 대칭')
        .setRequired(true);

    const customerNicknameInput = new TextInputBuilder()
        .setCustomId('customer_nickname')
        .setLabel('손님 닉네임을 입력해주세요.')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('정확히 입력해주세요')
        .setRequired(true);

    const depositInput = new TextInputBuilder()
        .setCustomId('deposit_amount')
        .setLabel('받으신 예약금을 입력해주세요.(만 단위, 없을 시 0)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('예: 100 (100만원) 또는 0')
        .setRequired(true);

    let rows = [
        new ActionRowBuilder().addComponents(myNicknameInput),
        new ActionRowBuilder().addComponents(customerNicknameInput),
        new ActionRowBuilder().addComponents(depositInput)
    ];

    // 스킬북인 경우 스킬북 이름 입력칸 추가
    if (position === 'skillbook1' || position === 'skillbook2') {
        const skillbookNameInput = new TextInputBuilder()
            .setCustomId('skillbook_name')
            .setLabel('스킬북 이름을 입력해주세요.')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 트스')
            .setRequired(false);

        rows.push(new ActionRowBuilder().addComponents(skillbookNameInput));
    }

    modal.addComponents(...rows);
    return modal;
}