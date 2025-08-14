// selectMenuHandlers.js
import { withErrorHandling } from './utils.js';

// 셀렉트 메뉴 상호작용 처리
export const handleSelectMenuInteractions = withErrorHandling(async (interaction) => {
    switch (interaction.customId) {
        case 'reset_selection':
            await handleResetSelection(interaction);
            break;

        case 'new_user_position':
            await handleNewUserPosition(interaction);
            break;

        case 'position_select':
            await handlePositionSelect(interaction);
            break;

        default:
            console.log(`처리되지 않은 셀렉트 메뉴: ${interaction.customId}`);
            break;
    }
});

// 초기화 항목 선택 처리
async function handleResetSelection(interaction) {
    const { globalState } = await import('./memoryManager.js');
    globalState.setResetItems(interaction.values);

    const selectedText = interaction.values.length > 0
        ? `선택된 항목: ${interaction.values.map(v => {
            // 매핑을 위한 커스텀 처리
            switch (v) {
                case 'turn1_first': return '1트 1순';
                case 'turn1_second': return '1트 2순';
                case 'turn1_third': return '1트 3순';
                case 'turn2_first': return '2트 1순';
                case 'turn2_second': return '2트 2순';
                case 'turn2_third': return '2트 3순';
                case 'skillbook1': return '스킬북1';
                case 'skillbook2': return '스킬북2';
                case 'enre_eat': return '엔레먹자';
                default: return v;
            }
        }).join(', ')}`
        : '선택된 항목이 없습니다.';

    await interaction.reply({ content: selectedText, ephemeral: true });
}

// 신규 가입자 순번 선택 처리
async function handleNewUserPosition(interaction) {
    const selectedPosition = interaction.values[0];
    const userId = interaction.user.id;

    const { globalState } = await import('./memoryManager.js');
    globalState.setUserSelection(userId, selectedPosition);

    // 확인 메시지 없이 바로 상호작용 완료 처리
    await interaction.deferUpdate();
}

// 순번 선택 처리 (닉네임 변경용)
async function handlePositionSelect(interaction) {
    // 이 기능은 현재 사용되지 않지만 확장성을 위해 유지
    await interaction.reply({
        content: '이 기능은 현재 구현되지 않았습니다.',
        ephemeral: true
    });
}