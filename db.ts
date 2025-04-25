import { Database } from 'bun:sqlite'

interface Alarm {
    id: number
    apiKey: string
    soundId: number
    soundName: string
    alarmTime: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

const db = new Database('alarms.db')
const VALID_API_KEYS = [
    'scplay-secret-key',
    'kitty-secret-key',
    'sofia-secret-key',
    'liu-secret-key',
    'external-secret-key',
]

function validateApiKey(apiKey: string): boolean {
    return VALID_API_KEYS.includes(apiKey)
}

db.run(`DROP TABLE IF EXISTS alarms`)
db.run(`
  CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apiKey TEXT NOT NULL,
    soundId INTEGER NOT NULL,
    soundName TEXT NOT NULL,
    alarmTime TEXT NOT NULL,
    isActive BOOLEAN DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_alarms_api_key ON alarms(apiKey)`)

export function createAlarm(apiKey: string, soundId: number, soundName: string, alarmTime: string): Alarm {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const stmt = db.prepare(`INSERT INTO alarms (apiKey, soundId, soundName, alarmTime) VALUES (?, ?, ?, ?)`)
    const result = stmt.run(apiKey, soundId, soundName, alarmTime)
    return getAlarmById(apiKey, Number(result.lastInsertRowid))
}

export function getAlarmById(apiKey: string, id: number): Alarm {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const stmt = db.prepare('SELECT * FROM alarms WHERE id = ? AND apiKey = ?')
    return stmt.get(id, apiKey) as Alarm
}

export function getAllAlarms(apiKey: string): Alarm[] {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const stmt = db.prepare('SELECT * FROM alarms WHERE apiKey = ? ORDER BY alarmTime')
    return stmt.all(apiKey) as Alarm[]
}

export function updateAlarm(apiKey: string, id: number, updates: Partial<Alarm>): Alarm {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const currentAlarm = getAlarmById(apiKey, id)
    if (!currentAlarm) throw new Error('Alarm not found')
    const stmt = db.prepare(`
    UPDATE alarms 
    SET soundId = ?, soundName = ?, alarmTime = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND apiKey = ?
  `)
    stmt.run(
        updates.soundId ?? currentAlarm.soundId,
        updates.soundName ?? currentAlarm.soundName,
        updates.alarmTime ?? currentAlarm.alarmTime,
        updates.isActive ?? currentAlarm.isActive,
        id,
        apiKey
    )
    return getAlarmById(apiKey, id)
}

export function deleteAlarm(apiKey: string, id: number): void {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const stmt = db.prepare('DELETE FROM alarms WHERE id = ? AND apiKey = ?')
    stmt.run(id, apiKey)
}

export function getActiveAlarmsForTime(apiKey: string, time: string): Alarm[] {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const stmt = db.prepare('SELECT * FROM alarms WHERE alarmTime = ? AND isActive = 1 AND apiKey = ?')
    return stmt.all(time, apiKey) as Alarm[]
}

export function toggleAlarmStatus(apiKey: string, id: number): Alarm {
    if (!validateApiKey(apiKey)) throw new Error('Invalid API key')
    const currentAlarm = getAlarmById(apiKey, id)
    if (!currentAlarm) throw new Error('Alarm not found')
    const stmt = db.prepare(`
    UPDATE alarms 
    SET isActive = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND apiKey = ?
  `)
    stmt.run(!currentAlarm.isActive, id, apiKey)
    return getAlarmById(apiKey, id)
}
