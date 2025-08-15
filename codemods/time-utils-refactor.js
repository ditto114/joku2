// codemods/new-join-recruit-button.js
// 실행: node codemods/new-join-recruit-button.js
// 목적:
// 1) 신규 가입 알림의 "(구인완료 버튼 클릭해주세요)" 문구를 실제 버튼으로 대체
// 2) 버튼 클릭 시 모달 띄우고, 손님 닉네임 입력칸 기본값을 신규 가입자 닉으로 프리필

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const guessFiles = [
    'nicknameService.js',   // 신규 가입/닉변/환영 메시지 보낼 가능성이 큼
    'modalHandlers.js',
    'buttonHandlers.js',
];

function read(p) { return fs.readFileSync(p, 'utf-8'); }
function write(p, s) { fs.writeFileSync(p, s, { encoding: 'utf-8' }); }
function exists(p) { return fs.existsSync(p); }

function ensureImport(src, spec, from) {
    const re = new RegExp(`import\\s*\\{[^}]*\\b${spec}\\b[^}]*\\}\\s*from\\s*['"]${from}['"];?`);
    if (re.test(src)) return src;
    // 이미 discord.js import가 있으면 그 줄에 spec 추가
    const anyImp = src.match(/import\s*\{[^}]*\}\s*from\s*['"]discord\.js['"];?/);
    if (anyImp) {
        const line = anyImp[0];
        const replaced = line.replace(/\{([^}]*)\}/, (m, g1) => `{ ${g1.trim().length ? g1.trim() + ', ' : ''}${spec} }`);
        return src.replace(line, replaced);
    }
    // 없으면 새 import 추가
    return `import { ${spec} } from 'discord.js';\n` + src;
}

// 1) 신규 가입 알림 메시지에 버튼 달기 (nicknameService.js가 있으면 우선 시도)
(function patchNewJoinAlert() {
    const file = path.join(root, 'nicknameService.js');
    if (!exists(file)) {
        console.log('ℹ️ nicknameService.js 없음: 이 단계는 건너뜁니다.');
        return;
    }
    let src = read(file);

    // (a) 안내 문구 제거
    src = src.replace(/\(구인완료\s*버튼\s*클릭해주세요\)/g, '');

    // (b) 버튼 컴포넌트 삽입: followUp(...) / reply(...) 에 components 추가
    // 대상 오브젝트 리터럴을 찾아 components 필드를 주입
    const objCallRe = /(followUp|reply)\s*\(\s*\{\s*([^]*?)\}\s*\)/g;
    let replacedAny = false;

    src = src.replace(objCallRe, (m, fn, inner) => {
        // 이미 components가 있으면 그대로 둠
        if (/components\s*:/.test(inner)) return m;

        // 신규 가입자 member 변수명을 추정: setNickname 호출에서 변수명 캡처
        const guessMemberVar =
            (src.match(/await\s+([A-Za-z_$][\w$]*)\.setNickname\s*\(/)?.[1]) ||
            (src.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*.*guild\.members/i)?.[1]) ||
            'member';

        const inject = `
components: [
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('recruit_complete_new_user:' + (${guessMemberVar}?.id ?? interaction?.member?.id ?? interaction?.user?.id))
      .setLabel('구인완료')
      .setStyle(ButtonStyle.Primary)
  )
],`.trim();

        // 오브젝트 앞쪽에 components 필드 삽입 (content보다 위에 넣음)
        const withComponents = inner.replace(/^\s*/, (lead) => `${lead}${inject}\n`);
        replacedAny = true;
        return `${fn}({ ${withComponents} })`;
    });

    if (replacedAny) {
        // discord.js 컴포넌트 import 확보
        src = ensureImport(src, 'ActionRowBuilder', 'discord.js');
        src = ensureImport(src, 'ButtonBuilder', 'discord.js');
        src = ensureImport(src, 'ButtonStyle', 'discord.js');
        write(file, src);
        console.log('✅ 신규 가입 알림에 [구인완료] 버튼을 추가했습니다. (nicknameService.js)');
    } else {
        console.log('⚠️ followUp/reply 패턴을 찾지 못해 신규 가입 알림 버튼 주입을 건너뜀. (nicknameService.js를 수동 확인 필요)');
    }
})();

// 2) 버튼 핸들러 추가: recruit_complete_new_user:<memberId> → 모달 띄우고 닉네임 프리필
(function patchButtonHandler() {
    const file = path.join(root, 'buttonHandlers.js');
    if (!exists(file)) {
        console.log('ℹ️ buttonHandlers.js 없음: 이 단계는 건너뜁니다.');
        return;
    }
    let src = read(file);

    // 필요한 import 보강
    src = ensureImport(src, 'ActionRowBuilder', 'discord.js');
    src = ensureImport(src, 'ModalBuilder', 'discord.js');
    src = ensureImport(src, 'TextInputBuilder', 'discord.js');
    src = ensureImport(src, 'TextInputStyle', 'discord.js');

    // handleButtonInteractions 내에 분기 추가
    // 대략적으로 함수 시그니처를 찾음
    const handlerRe = /export\s+async\s+function\s+handleButtonInteractions\s*\(\s*interaction\s*\)\s*\{\s*([^]*?)\}\s*$/m;
    if (!handlerRe.test(src)) {
        console.log('⚠️ handleButtonInteractions(interaction) 함수를 찾지 못했습니다. 수동 삽입 지시문을 추가합니다.');
        // 최하단에 독립 핸들러(등록 예시)를 덧붙임 (프로젝트에서 라우팅에 맞춰 연결 필요)
        src += `

/** Fallback handler (route this in your index.js if needed)
import { handleRecruitCompleteNewUserButton } from './buttonHandlers.js'
client.on('interactionCreate', (i) => {
  if (i.isButton() && i.customId.startsWith('recruit_complete_new_user:')) handleRecruitCompleteNewUserButton(i);
});
*/
export async function handleRecruitCompleteNewUserButton(interaction) {
  try {
    if (!interaction?.guild) return;
    const targetId = interaction.customId.split(':')[1];
    let member = null;
    try { member = await interaction.guild.members.fetch(targetId); } catch {}
    const displayName = member?.nickname ?? member?.user?.globalName ?? member?.user?.username ?? '';

    const modal = new ModalBuilder()
      .setCustomId('recruit_complete_new_user_modal')
      .setTitle('구인 완료');

    const nicknameInput = new TextInputBuilder()
      .setCustomId('customer_nickname')
      .setLabel('손님 닉네임')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    if (displayName) nicknameInput.setValue(displayName);

    modal.addComponents(new ActionRowBuilder().addComponents(nicknameInput));

    await interaction.showModal(modal);
  } catch (e) {
    console.error('recruit_complete_new_user button error:', e);
  }
}
`;
        write(file, src);
        console.log('✅ 버튼 전용 fallback 핸들러를 추가했습니다. (buttonHandlers.js 하단)');
        return;
    }

    src = src.replace(handlerRe, (m, body) => {
        const guardRe = /interaction\.customId\.startsWith\(['"]recruit_complete_new_user:/;
        if (guardRe.test(body)) {
            // 이미 추가됨
            return m;
        }
        const injected = `
  // 신규 가입 알림의 [구인완료] 버튼
  if (interaction.customId?.startsWith('recruit_complete_new_user:')) {
    try {
      const targetId = interaction.customId.split(':')[1];
      let member = null;
      try { member = await interaction.guild.members.fetch(targetId); } catch {}
      const displayName = member?.nickname ?? member?.user?.globalName ?? member?.user?.username ?? '';

      const modal = new ModalBuilder()
        .setCustomId('recruit_complete_new_user_modal')
        .setTitle('구인 완료');

      const nicknameInput = new TextInputBuilder()
        .setCustomId('customer_nickname')
        .setLabel('손님 닉네임')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (displayName) nicknameInput.setValue(displayName);

      modal.addComponents(new ActionRowBuilder().addComponents(nicknameInput));

      await interaction.showModal(modal);
      return;
    } catch (e) {
      console.error('recruit_complete_new_user button error:', e);
    }
  }
`;
        return m.replace('{', '{' + injected);
    });

    write(file, src);
    console.log('✅ 버튼 핸들러 분기를 추가했습니다. (buttonHandlers.js)');
})();

// 3) 모달 제출 핸들러(최소) 추가: recruit_complete_new_user_modal
(function patchModalHandler() {
    const file = path.join(root, 'modalHandlers.js');
    if (!exists(file)) {
        console.log('ℹ️ modalHandlers.js 없음: 이 단계는 건너뜁니다.');
        return;
    }
    let src = read(file);

    // 이미 처리 분기가 있으면 생략
    if (/customId\s*===\s*['"]recruit_complete_new_user_modal['"]/.test(src)) {
        console.log('ℹ️ recruit_complete_new_user_modal 처리가 이미 존재합니다.');
        return;
    }

    // 상단 import 보강은 필요 없고, 본문 내 분기만 추가
    const handlerRe = /export\s+async\s+function\s+handleModalSubmissions\s*\(\s*interaction\s*\)\s*\{\s*([^]*?)\}\s*$/m;
    if (!handlerRe.test(src)) {
        console.log('⚠️ handleModalSubmissions(interaction) 함수를 찾지 못했습니다. 수동 삽입 필요.');
        return;
    }

    src = src.replace(handlerRe, (m, body) => {
        const injected = `
  // 신규 가입 알림에서 띄운 구인완료 모달(테스트용 최소 처리)
  if (interaction.customId === 'recruit_complete_new_user_modal') {
    try {
      const nickname = interaction.fields.getTextInputValue('customer_nickname');
      await interaction.reply({ content: \`구인완료 접수됨: \${nickname}\`, ephemeral: true });
      return;
    } catch (e) {
      console.error('recruit_complete_new_user_modal error:', e);
      try { await interaction.reply({ content: '처리 중 오류가 발생했습니다.', ephemeral: true }); } catch {}
      return;
    }
  }
`;
        return m.replace('{', '{' + injected);
    });

    write(file, src);
    console.log('✅ 최소 모달 제출 분기를 추가했습니다. (modalHandlers.js)');
})();

console.log('🎉 Codemod 완료: 신규 가입 알림 → [구인완료] 버튼 + 모달 닉네임 프리필');
