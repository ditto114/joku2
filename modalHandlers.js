// modalHandlers.js
import { deleteInteractionMessage } from './memoryManager.js';
import { sendToChannel, withErrorHandling, validators } from './utils.js';
import { CONFIG } from './config.js';
import {
    changeNickname,
    assignGuestRole,
    sendNicknameChangeMessage,
    sendWelcomePrivateMessage,
    sendNewMemberMessage,
    getErrorMessage
} from './nicknameService.js';
import {
    completeReservation,
    addEnreCustomer,
    updatePrices,
    updateDepartureTimes
} from './reservationService.js';

// 모달 제출 처리
export const handleModalSubmissions = withErrorHandling(async (interaction) => {
    const customId = interaction.customId;

    if (customId === 'enre_eat_modal') {
        await handleEnreEatModal(interaction);
    } else if (customId.startsWith('complete_')) {
        await handleReservationCompleteModal(interaction);
    } else if (customId.startsWith('new_user_modal_')) {
        await handleNewUserModal(interaction);
    } else if (customId === 'price_change_modal') {
        await handlePriceChangeModal(interaction);
    } else if (customId === 'time_change_modal') {
        await handleTimeChangeModal(interaction);
    } else {
        console.log(`처리되지 않은 모달: ${customId}`);
    }
});

// 엔레먹자 모달 처리
async function handleEnreEatModal(interaction) {
    const customerNickname = interaction.fields.getTextInputValue('customer_nickname');

    // 닉네임 검증
    if (!validators.isValidNickname(customerNickname)) {
        throw new Error('손님 닉네임이 유효하지 않습니다. (한글 1글자, 영어/숫자 0.5글자로 총 6글자까지, 특수문자 불허)');
    }

    // 엔레먹자 손님 목록에 추가 (데이터베이스에 저장)
    await addEnreCustomer(interaction.client, customerNickname);

    await interaction.reply({
        content: '엔레먹자 정보가 등록되었습니다!',
        ephemeral: true
    });

    deleteInteractionMessage('recruitment');
}

// 예약 완료 모달 처리
async function handleReservationCompleteModal(interaction) {
    const position = interaction.customId.replace('complete_', '');

    const reservationData = {
        myNickname: interaction.fields.getTextInputValue('my_nickname'),
        customerNickname: interaction.fields.getTextInputValue('customer_nickname'),
        depositAmount: interaction.fields.getTextInputValue('deposit_amount'),
        skillbookName: (position === 'skillbook1' || position === 'skillbook2') ?
            (interaction.fields.getTextInputValue('skillbook_name') || '-') : undefined
    };

    await completeReservation(interaction.client, position, reservationData);

    await interaction.reply({
        content: '구인완료 정보가 저장되었습니다!',
        ephemeral: true
    });

    deleteInteractionMessage('recruitment');
}

// 신규 사용자 모달 처리
async function handleNewUserModal(interaction) {
    const selectedPosition = interaction.customId.replace('new_user_modal_', '');
    const nickname = interaction.fields.getTextInputValue('nickname_input');
    const userId = interaction.user.id;

    // 모달은 시작 즉시 에페메랄 지연 응답
    await interaction.deferReply({ ephemeral: true });

    try {
        // position 매핑 (트스북/어콤북은 동일하게 'skillbook1'으로 처리)
        let mappedPosition = selectedPosition;
        if (selectedPosition === 'tris' || selectedPosition === 'arcom') {
            mappedPosition = 'skillbook1';
        }

        const finalNickname = await changeNickname(interaction, nickname, selectedPosition);

        // 역할 부여
        await assignGuestRole(interaction.member);

        // 신규 손님 안내 메시지(공지 채널 등)
        await sendNewMemberMessage(interaction.client, finalNickname);

        // 환영 DM (실패 시 에페메랄로 대체됨)
        await sendWelcomePrivateMessage(interaction);

        // 선택 정보 삭제
        const { globalState } = await import('./memoryManager.js');
        globalState.removeUserSelection(userId);

        // 응답 마무리
        await interaction.editReply('✅ 닉네임/역할 적용 완료! 환영 안내를 전송했습니다.');
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        await interaction.editReply(errorMessage);
    }
}

// 시세 변경 모달 처리
async function handlePriceChangeModal(interaction) {
    const priceData = {
        firstSecond: interaction.fields.getTextInputValue('first_second_price'),
        third: interaction.fields.getTextInputValue('third_price'),
        skillbook1: interaction.fields.getTextInputValue('skillbook1_price'),
        skillbook2: interaction.fields.getTextInputValue('skillbook2_price')
    };

    await updatePrices(interaction.client, priceData);

    await interaction.reply({
        content: '시세가 성공적으로 변경되었습니다!',
        ephemeral: true
    });
}

// 시간 변경 모달 처리
async function handleTimeChangeModal(interaction) {
    const timeData = {
        turn1Hour: interaction.fields.getTextInputValue('turn1_hour'),
        turn1Minute: interaction.fields.getTextInputValue('turn1_minute'),
        turn2Hour: interaction.fields.getTextInputValue('turn2_hour'),
        turn2Minute: interaction.fields.getTextInputValue('turn2_minute')
    };

    await updateDepartureTimes(interaction.client, timeData);

    await interaction.reply({
        content: '출발시간이 성공적으로 변경되었습니다!',
        ephemeral: true
    });
}