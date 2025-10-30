// index.js
import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { initDatabase } from './database.js';
import express from 'express';
import path from 'path';
import { updateDepartureTimes } from './reservationService.js';
import { readData, saveData } from './database.js';
import { validators } from './utils.js';
import { fileURLToPath } from 'url';
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

// ── Socket.IO 추가 ──────────────────────────────────────────────────────
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { realtimeBus, notifyUpdate } from './realtime.js';
import {
    getTimerSnapshot,
    createTimer,
    updateTimerMeta,
    startTimer as startSharedTimer,
    resetTimer as resetSharedTimer,
    deleteTimer as deleteSharedTimer
} from './timerService.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// 화면 캡쳐 이미지(base64) 전송을 위해 바디 용량 상향
app.use(express.json({ limit: '15mb' }));

// ── 관리자 비밀번호 설정 ───────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1011';

// API 보호 미들웨어: /api/* 요청만 검사
app.use('/api', (req, res, next) => {
    const pwd = req.get('x-admin-password');
    if (pwd !== ADMIN_PASSWORD) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    next();
});

// 정적파일: public 폴더 (admin.html이 public에 있다면 그대로 사용)
app.use(express.static(path.join(__dirname, 'public')));

// 필요 시 루트 경로에서 admin.html 서빙 (public이 없거나 다른 위치일 경우 안전장치)
// 주석을 해제해도 됩니다.
// import fs from 'fs/promises';
// app.get('/', async (req, res) => {
//     try {
//         const html = await fs.readFile(path.join(__dirname, 'public', 'admin.html'), 'utf8');
//         res.setHeader('Content-Type', 'text/html; charset=utf-8');
//         res.send(html);
//     } catch {
//         try {
//             const html = await fs.readFile(path.join(__dirname, 'admin.html'), 'utf8');
//             res.setHeader('Content-Type', 'text/html; charset=utf-8');
//             res.send(html);
//         } catch {
//             res.status(404).send('admin.html not found');
//         }
//     }
// });

// 상태 조회 (관리페이지가 쓰는 엔드포인트)
app.get('/api/status', async (req, res) => {
    try {
        const status = await getReservationStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── 공대원(Guild Members) API ─────────────────────────────────────────
// 목록 조회
app.get('/api/members', async (req, res) => {
    try {
        const data = await readData();
        res.json({ ok: true, members: Array.isArray(data.guildMembers) ? data.guildMembers : [] });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// 추가
app.post('/api/members', async (req, res) => {
    try {
        const { nickname, job } = req.body || {};
        if (!validators.isValidNickname(nickname)) {
            return res.status(400).json({ ok: false, error: '닉네임 형식이 올바르지 않습니다.' });
        }
        if (!validators.isValidJob(job)) {
            return res.status(400).json({ ok: false, error: '직업 형식이 올바르지 않습니다.' });
        }

        const data = await readData();
        const list = Array.isArray(data.guildMembers) ? data.guildMembers : (data.guildMembers = []);
        if (list.some(m => m.nickname === nickname)) {
            return res.status(400).json({ ok: false, error: '이미 존재하는 닉네임입니다.' });
        }
        list.push({ nickname, job });
        await saveData(data);

        // 실시간 반영
        realtimeBus.emit('update', { type: 'guildMembers', ts: Date.now() });
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// 삭제 (닉네임 기준)
app.delete('/api/members', async (req, res) => {
    try {
        const { nickname } = req.body || {};
        if (!validators.isValidNickname(nickname)) {
            return res.status(400).json({ ok: false, error: '닉네임 형식이 올바르지 않습니다.' });
        }
        const data = await readData();
        const before = Array.isArray(data.guildMembers) ? data.guildMembers.length : 0;
        data.guildMembers = (Array.isArray(data.guildMembers) ? data.guildMembers : []).filter(m => m.nickname !== nickname);
        const after = data.guildMembers.length;
        if (before === after) {
            return res.status(404).json({ ok: false, error: '해당 닉네임을 찾을 수 없습니다.' });
        }
        await saveData(data);

        realtimeBus.emit('update', { type: 'guildMembers', ts: Date.now() });
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});
// 시세 변경
app.post('/api/prices', async (req, res) => {
    try {
        await updatePrices(client, req.body);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// 출발시간 변경
app.post('/api/times', async (req, res) => {
    try {
        await updateDepartureTimes(client, req.body);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// 선택 초기화
app.post('/api/reset', async (req, res) => {
    try {
        const items = Array.isArray(req.body.items) ? new Set(req.body.items) : new Set();
        const resetItems = await resetReservations(client, items);
        res.json({ ok: true, resetItems });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// 전체 초기화
app.post('/api/reset-all', async (req, res) => {
    try {
        await resetAllReservations(client);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// ── 화면 캡쳐 업로드 → 디스코드 채널 전송 ───────────────────────────────
app.post('/api/screenshot', async (req, res) => {
    try {
        const { image } = req.body || {};
        if (!image || typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) {
            return res.status(400).json({ ok: false, error: 'invalid_image' });
        }
        // data URL → Buffer
        const base64 = image.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');

        // 파일명: admin-YYYYMMDD-HHmm.png
        const now = new Date();
        const YYYY = String(now.getFullYear());
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const filename = `admin-${YYYY}${MM}${DD}-${HH}${mm}.png`;

        const channelId = CONFIG?.CHANNELS?.ANNOUNCEMENT; // “시세 알림 등” 통상 알림 채널
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            return res.status(500).json({ ok: false, error: 'channel_not_found' });
        }

        await channel.send({
            content: '📸 관리 페이지 화면 캡쳐',
            files: [{ attachment: buffer, name: filename }]
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('screenshot upload error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

function mapTimerErrorStatus(error) {
    if (!error || typeof error.message !== 'string') {
        return 400;
    }
    return error.message.includes('찾을 수 없습니다') ? 404 : 400;
}

app.get('/api/timers', async (req, res) => {
    try {
        const snapshot = await getTimerSnapshot();
        res.json({ ok: true, snapshot });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/timers', async (req, res) => {
    try {
        const { timer } = await createTimer(req.body || {});
        notifyUpdate('timers');
        res.json({ ok: true, timer });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.patch('/api/timers/:id', async (req, res) => {
    const id = req.params?.id;
    try {
        const { timer, changed } = await updateTimerMeta(id, req.body || {});
        if (changed) notifyUpdate('timers');
        res.json({ ok: true, timer });
    } catch (e) {
        res.status(mapTimerErrorStatus(e)).json({ ok: false, error: e.message });
    }
});

app.post('/api/timers/:id/start', async (req, res) => {
    const id = req.params?.id;
    try {
        const { timer, changed } = await startSharedTimer(id);
        if (changed) notifyUpdate('timers');
        res.json({ ok: true, timer });
    } catch (e) {
        res.status(mapTimerErrorStatus(e)).json({ ok: false, error: e.message });
    }
});

app.post('/api/timers/:id/reset', async (req, res) => {
    const id = req.params?.id;
    try {
        const { timer, changed } = await resetSharedTimer(id);
        if (changed) notifyUpdate('timers');
        res.json({ ok: true, timer });
    } catch (e) {
        res.status(mapTimerErrorStatus(e)).json({ ok: false, error: e.message });
    }
});

app.delete('/api/timers/:id', async (req, res) => {
    const id = req.params?.id;
    try {
        const { changed } = await deleteSharedTimer(id);
        if (changed) notifyUpdate('timers');
        res.json({ ok: true });
    } catch (e) {
        res.status(mapTimerErrorStatus(e)).json({ ok: false, error: e.message });
    }
});

// ── HTTP + Socket.IO 서버 시작 ────────────────────────────────────────
const PORT = process.env.PORT || 47984;
const httpServer = createServer(app);

// Socket.IO 서버
const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    // CORS가 필요하면 여기서 설정 (동일 오리진이면 기본값으로 OK)
    cors: { origin: true, credentials: true }
});

// 인증 미들웨어 (클라이언트 auth.pwd 검사)
io.use((socket, next) => {
    const pwd = socket.handshake?.auth?.pwd;
    if (pwd !== ADMIN_PASSWORD) {
        return next(new Error('unauthorized'));
    }
    next();
});

// 최신 상태를 모든 클라이언트에 브로드캐스트
async function broadcastStatus() {
    try {
        const status = await getReservationStatus();
        io.emit('status', { status });
    } catch (e) {
        console.error('broadcastStatus error:', e);
    }
}

async function broadcastTimers() {
    try {
        const snapshot = await getTimerSnapshot();
        io.emit('timers', { snapshot });
    } catch (e) {
        console.error('broadcastTimers error:', e);
    }
}

// 최초 접속 시 1회 상태 전송
io.on('connection', async (socket) => {
    try {
        const status = await getReservationStatus();
        socket.emit('status', { status });
        const timers = await getTimerSnapshot();
        socket.emit('timers', { snapshot: timers });
    } catch (e) {
        console.error('socket connection status send error:', e);
    }
});

// 서비스 레벨 업데이트 이벤트에 반응하여 실시간 push
realtimeBus.on('update', (payload = {}) => {
    const type = payload.type;
    if (type === 'timers') {
        broadcastTimers();
    } else {
        broadcastStatus();
    }
});

httpServer.listen(PORT, () => {
    console.log(`관리 웹서버가 http://localhost:${PORT} 에서 실행 중입니다`);
    console.log(`ADMIN_PASSWORD length: ${String(ADMIN_PASSWORD).length}`);
});