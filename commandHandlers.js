// commandHandlers.js
import { createNewUserMenu, createMainMenu } from './uiComponents.js';
import { withErrorHandling } from './utils.js';

// 메시지 명령어 처리
export const handleMessageCommands = withErrorHandling(async (message) => {
    const content = message.content.trim();

    switch (content) {
        case 'ping':
            await message.channel.send('pong');
            break;

        case '!신규':
            const newUserMenu = await createNewUserMenu();  // async로 변경
            await message.channel.send(newUserMenu);
            break;

        case '!메뉴':
            const mainMenu = createMainMenu();
            await message.reply(mainMenu);
            break;

        default:
            // 다른 명령어는 무시
            break;
    }
});