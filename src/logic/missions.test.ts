import { describe, expect, it } from 'vitest';
import { MISSIONS, bumpQuest, freshQuestLog, normalizeQuestLog, questBoard } from './missions.ts';

describe('missions', () => {
  it('starts two quests and shows the rest as upcoming', () => {
    const log = freshQuestLog(1);
    expect(log.active.map((a) => a.kind)).toEqual(['kjør', 'benk']);
    const board = questBoard(log);
    expect(board.filter((r) => r.state === 'active').map((r) => r.kind)).toEqual(['kjør', 'benk']);
    expect(board.filter((r) => r.state === 'upcoming').length).toBe(MISSIONS.length - 2);
    expect(board.filter((r) => r.state === 'done')).toEqual([]);
    expect(board.filter((r) => r.state === 'active').every((r) => r.progress === 0)).toBe(true);
  });

  it('progresses one active quest without touching the other', () => {
    let log = freshQuestLog(1);
    const r = bumpQuest(log, 'kjør', 0.4, 2);
    expect(r.changed).toBe(true);
    expect(r.completed).toBeNull();
    expect(r.log.active.find((a) => a.kind === 'kjør')!.progress).toBeCloseTo(0.4);
    expect(r.log.active.find((a) => a.kind === 'benk')!.progress).toBe(0);
    log = r.log;
    expect(bumpQuest(log, 'epler', 1, 3).changed).toBe(false);
  });

  it('completion pays the way to the next quest and never skips ahead', () => {
    let log = freshQuestLog(1);
    const r = bumpQuest(log, 'benk', 1, 5);
    expect(r.completed?.kind).toBe('benk');
    expect(r.log.done).toEqual(['benk']);
    expect(r.log.active.map((a) => a.kind).sort()).toEqual(['butikk', 'kjør']);
    const board = questBoard(r.log);
    expect(board.find((row) => row.kind === 'benk')!.state).toBe('done');
    expect(board.find((row) => row.kind === 'epler')!.state).toBe('upcoming');
  });

  it('keeps earned progress when a save is repaired', () => {
    const log = normalizeQuestLog({
      done: ['kjør'],
      active: [{ kind: 'benk', progress: 0.5, offeredAt: 9 }, { kind: 'nope', progress: 1 }],
    }, 4);
    expect(log.done).toEqual(['kjør']);
    expect(log.active.find((a) => a.kind === 'benk')!.progress).toBeCloseTo(0.5);
    expect(log.active).toHaveLength(2);
    expect(log.active.some((a) => a.kind === 'kjør')).toBe(false);
  });
});
