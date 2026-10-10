import { ServerConfig } from '../../config';
import { ClineControlAdapter } from './ClineControlAdapter';
import { InstructionService } from './InstructionService';
import { AuditLog } from './AuditLog';
import { OfficeRoom } from '../../rooms/OfficeRoom';
import * as path from 'path';

export { ClineControlAdapter } from './ClineControlAdapter';
export type { InstructionRecord, InstructionState } from './InstructionService';
export { InstructionService } from './InstructionService';
export type { AuditEntry } from './AuditLog';
export { AuditLog } from './AuditLog';
export type { ControlCapabilities } from './ControlCapabilities';
export { BLOCKED_DISPATCH_REASONS } from './ControlCapabilities';

/**
 * Block 4 — assembles the control runtime (adapter, instruction
 * pipeline, audit) from the server config. Everything is instantiated
 * once per server process.
 */
export function createControlRuntime(config: ServerConfig) {
    const adapter = new ClineControlAdapter(config);
    const audit = new AuditLog(path.resolve('./data/control-audit.jsonl'));
    const instructions = new InstructionService({
        config,
        adapter,
        audit,
        // Target validation: only currently-registered office agents
        // (real Cline session ids) can receive instructions.
        officeAgents: () => {
            const bridge = OfficeRoom.getActiveRoom()?.getExternalBridge();
            if (!bridge) return [];
            return bridge.getStatus().agents.map(a => ({
                id: a.id, name: a.name, status: String(a.status)
            }));
        }
    });
    return { adapter, audit, instructions };
}
