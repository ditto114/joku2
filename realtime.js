// realtime.js
import { EventEmitter } from 'events';

// 서버 내 공용 이벤트 버스
export const realtimeBus = new EventEmitter();

// 데이터 변경 시 호출해서 실시간 갱신 트리거
export function notifyUpdate(type = 'status') {
    realtimeBus.emit('update', { type, ts: Date.now() });
}
