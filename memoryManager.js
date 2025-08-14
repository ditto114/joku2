// memoryManager.js
import { memoryManager } from './utils.js';

// 전역 상태 관리
class GlobalStateManager {
    constructor() {
        // 선택된 초기화 항목
        this.selectedResetItems = new Set();

        // 신규 가입자 선택 정보 (타임스탬프 포함)
        this.newUserSelections = new Map();

        // 상호작용 데이터 (메시지 삭제용)
        this.interactionData = {
            tableManage: null,
            recruitment: null
        };

        // 정리 인터벌 설정 (5분마다)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    // 선택된 초기화 항목 관리
    setResetItems(items) {
        this.selectedResetItems = new Set(items);
        memoryManager.limitSetSize(this.selectedResetItems, 20);
    }

    getResetItems() {
        return this.selectedResetItems;
    }

    clearResetItems() {
        this.selectedResetItems.clear();
    }

    // 신규 사용자 선택 정보 관리
    setUserSelection(userId, selection) {
        this.newUserSelections.set(userId, {
            selection,
            timestamp: Date.now()
        });
        memoryManager.limitMapSize(this.newUserSelections, 100);
    }

    getUserSelection(userId) {
        const data = this.newUserSelections.get(userId);
        return data ? data.selection : null;
    }

    removeUserSelection(userId) {
        this.newUserSelections.delete(userId);
    }

    // 상호작용 데이터 관리
    setInteractionData(type, data) {
        this.interactionData[type] = {
            ...data,
            timestamp: Date.now()
        };
    }

    getInteractionData(type) {
        return this.interactionData[type];
    }

    clearInteractionData(type) {
        this.interactionData[type] = null;
    }

    // 메모리 정리
    cleanup() {
        console.log('메모리 정리 시작...');

        // 오래된 사용자 선택 정보 정리 (30분 이상)
        memoryManager.cleanOldData(this.newUserSelections, 30 * 60 * 1000);

        // 오래된 상호작용 데이터 정리 (10분 이상)
        const now = Date.now();
        Object.keys(this.interactionData).forEach(key => {
            const data = this.interactionData[key];
            if (data && data.timestamp && now - data.timestamp > 10 * 60 * 1000) {
                this.interactionData[key] = null;
            }
        });

        console.log(`메모리 정리 완료 - 사용자 선택: ${this.newUserSelections.size}개`);
    }

    // 상태 정보 조회
    getStatus() {
        return {
            resetItems: this.selectedResetItems.size,
            userSelections: this.newUserSelections.size,
            activeInteractions: Object.values(this.interactionData).filter(d => d !== null).length
        };
    }

    // 정리 작업 중단
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// 싱글톤 인스턴스 생성
export const globalState = new GlobalStateManager();

// 상호작용 메시지 삭제 헬퍼
export async function deleteInteractionMessage(type, delay = 1000) {
    setTimeout(async () => {
        try {
            const interactionData = globalState.getInteractionData(type);
            if (interactionData && interactionData.interaction) {
                await interactionData.interaction.deleteReply();
                globalState.clearInteractionData(type);
            }
        } catch (error) {
            console.log(`${type} 메시지 삭제 중 오류 발생:`, error);
        }
    }, delay);
}

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
    console.log('프로세스 종료 중... 메모리 정리');
    globalState.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('프로세스 종료 중... 메모리 정리');
    globalState.destroy();
    process.exit(0);
});