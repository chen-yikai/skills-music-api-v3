import { Database } from 'bun:sqlite'

interface Alarm {
    id: number
    soundId: number
    soundName: string
    alarmTime: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

const db = new Database('alarms.db')

// Create alarms table
db.run(`
  CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    soundId INTEGER NOT NULL,
    soundName TEXT NOT NULL,
    alarmTime TEXT NOT NULL,
    isActive BOOLEAN DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

// Insert new alarm
export function createAlarm(soundId: number, soundName: string, alarmTime: string): Alarm {
    const stmt = db.prepare(`
    INSERT INTO alarms (soundId, soundName, alarmTime)
    VALUES (?, ?, ?)
  `)

    const result = stmt.run(soundId, soundName, alarmTime)
    return getAlarmById(Number(result.lastInsertRowid))
}

// Get alarm by ID
export function getAlarmById(id: number): Alarm {
    const stmt = db.prepare('SELECT * FROM alarms WHERE id = ?')
    return stmt.get(id) as Alarm
}

// Get all alarms
export function getAllAlarms(): Alarm[] {
    const stmt = db.prepare('SELECT * FROM alarms ORDER BY alarmTime')
    return stmt.all() as Alarm[]
}

// Update alarm
export function updateAlarm(id: number, updates: Partial<Alarm>): Alarm {
    const currentAlarm = getAlarmById(id)
    if (!currentAlarm) throw new Error('Alarm not found')

    const stmt = db.prepare(`
    UPDATE alarms 
    SET soundId = ?,
        soundName = ?,
        alarmTime = ?,
        isActive = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

    stmt.run(
        updates.soundId ?? currentAlarm.soundId,
        updates.soundName ?? currentAlarm.soundName,
        updates.alarmTime ?? currentAlarm.alarmTime,
        updates.isActive ?? currentAlarm.isActive,
        id
    )

    return getAlarmById(id)
}

// Delete alarm
export function deleteAlarm(id: number): void {
    const stmt = db.prepare('DELETE FROM alarms WHERE id = ?')
    stmt.run(id)
}

// Get active alarms for a specific time
export function getActiveAlarmsForTime(time: string): Alarm[] {
    const stmt = db.prepare('SELECT * FROM alarms WHERE alarmTime = ? AND isActive = 1')
    return stmt.all(time) as Alarm[]
}

// Toggle alarm active status
export function toggleAlarmStatus(id: number): Alarm {
    const currentAlarm = getAlarmById(id)
    if (!currentAlarm) throw new Error('Alarm not found')

    const stmt = db.prepare(`
    UPDATE alarms 
    SET isActive = ?,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

    stmt.run(!currentAlarm.isActive, id)
    return getAlarmById(id)
}
