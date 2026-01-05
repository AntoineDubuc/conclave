/**
 * Session persistence for chat.
 */

import fs from 'fs';
import path from 'path';
import { ChatSession } from './session.js';

const SESSIONS_DIR = path.join(process.cwd(), '.conclave', 'chat_sessions');

function ensureSessionsDir(): void {
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
}

export function saveSession(session: ChatSession, filename?: string): string {
    ensureSessionsDir();

    const name = filename || `session-${session.sessionId}`;
    const filePath = path.join(SESSIONS_DIR, `${name}.json`);

    fs.writeFileSync(filePath, JSON.stringify(session.toJSON(), null, 2));
    return filePath;
}

export function loadSession(filename: string): ChatSession {
    let filePath = filename;

    // If it's not an absolute path, look in sessions dir
    if (!path.isAbsolute(filename)) {
        // Try with and without .json extension
        const withExt = filename.endsWith('.json') ? filename : `${filename}.json`;
        filePath = path.join(SESSIONS_DIR, withExt);

        if (!fs.existsSync(filePath)) {
            // Try the original filename as-is
            filePath = filename;
        }
    }

    if (!fs.existsSync(filePath)) {
        throw new Error(`Session file not found: ${filename}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return ChatSession.fromJSON(data);
}

export function listSessions(): string[] {
    ensureSessionsDir();

    return fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}
