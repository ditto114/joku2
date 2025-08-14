// index.js
import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { initDatabase } from './database.js';
import { getKoreanTime, sendToChannel, withErrorHandling } from './utils.js';
import { CONFIG } from './config.js';
import { globalState, deleteInteractionMessage } from './memoryManager.js';
import { 
    createNewUserMenu, 
    createMainMenu, 
    createRecruitmentCompleteMenu,
    createTableManageMenu,
    createReservationStatusEmbed,
    createErrorEmbed,
    createSuccessEmbed
} from './uiComponents.js';
import {
    completeReservation,
    resetReservations,
    resetAllReservations,
    updatePrices,
    getReservationStatus,
    generateRecruitmentTemplate
} from './reservationService.js';
import {
    changeNickname,
    assignGuestRole,
    isGuestUser,
    sendNicknameChangeMessage,
    sendNewMemberMessage,
    getErrorMessage
} from './nicknameService.js';
import { handleMessageCommands } from './commandHandlers.js';
import { handleButtonInteractions } from './buttonHandlers.js';
import { handleModalSubmissions } from './modalHandlers.js';
import { handleSelectMenuInteractions } from './selectMenuHandlers.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 봇 준비 이벤트
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    await initDatabase();
    console.log('봇이 성공적으로 시작되었습니다.');
});

// 메시지 이벤트 처리
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        await handleMessageCommands(message);
    } catch (error) {
        console.error('메시지 처리 중 오류:', error);
        try {
            await message.reply('명령어 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } catch (replyError) {
            console.error('에러 메시지 전송 실패:', replyError);
        }
    }
});

// 상호작용 이벤트 처리
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteractions(interaction);
        } else if (interaction.isButton()) {
            await handleButtonInteractions(interaction);
        } else if (interaction.isModalSubmit()) {
            await handleModalSubmissions(interaction);
        }
    } catch (error) {
        console.error('상호작용 처리 중 오류:', error);
        
        try {
            const errorMessage = typeof error.message === 'string' ? error.message : '알 수 없는 오류가 발생했습니다.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: `❌ ${errorMessage}`, 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${errorMessage}`, 
                    ephemeral: true 
                });
            }
        } catch (replyError) {
            console.error('에러 메시지 전송 실패:', replyError);
        }
    }
});

// 에러 처리
client.on('error', error => {
    console.error('클라이언트 오류:', error);
});

// 봇 로그인
client.login(process.env.DISCORD_TOKEN);
            