import type * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { SPECIES_BY_ID } from '../logic/pets.ts';
import type { PetState } from '../logic/needs.ts';
import { toast } from '../ui/dom.ts';
import type { AvatarPoseWire, MountWire, PlaceWire, PetWire } from './protocol.ts';
import { RemotePlayers } from './remotes.ts';
import { MpSession } from './session.ts';
import { openEmotePicker, openMpSheet } from './ui.ts';

/** Minimal game surface needed by multiplayer (avoids circular imports). */
export interface MpHost {
  scene: THREE.Scene;
  save: { avatar: Avatar; playerId: string };
  player: { pos: THREE.Vector3; yaw: number; speed: number };
  mode: 'town' | 'house';
  using: { id: string } | null;
  riding: string | null;
  holding: string | null;
  flying: boolean;
  town: {
    insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null;
    seatWorld(id: string, u: number): { x: number; y: number; z: number; yaw: number };
    housePlots: { x: number; z: number; rot: number }[];
    setPlotHouse(plot: number, style: 'hytte' | 'villa' | 'gard' | 'slott' | 'moderne' | 'trehus' | 'sjohus' | null, label?: string): void;
  };
  mainPet(): PetState | null;
}

export class MpClient {
  session: MpSession;
  remotes: RemotePlayers;

  constructor(private game: MpHost) {
    this.remotes = new RemotePlayers(game.scene);
    this.session = new MpSession({
      onRemotes: () => this.updateBadge(),
      onStatus: (s, detail) => {
        this.updateBadge();
        if (s === 'error' && detail) toast(detail, 'bad');
        if (s === 'open' && this.session.code) toast(`Koblet til rom ${this.session.code}`, 'ok');
      },
      onRoom: () => this.updateBadge(),
      onError: (message) => toast(message, 'bad'),
      onAvatar: () => this.updateBadge(),
    });
  }

  openMenu() {
    openMpSheet(
      this.session,
      () => this.game.save.avatar,
      () => this.game.save.playerId,
      () => this.updateBadge(),
    );
  }

  openEmotes() {
    openEmotePicker(this.session);
  }

  leave() {
    this.session.leave();
    this.remotes.clear();
    this.updateBadge();
  }

  /** Call after the local player changes outfit mid-session. */
  broadcastAvatar(avatar: Avatar) {
    this.session.sendAvatar(avatar);
  }

  tick(pose: AvatarPoseWire) {
    const g = this.game;
    const now = performance.now();
    const place = this.currentPlace();
    const area = place === 'house' ? g.save.playerId : null;

    if (this.session.active) {
      this.session.sendState(
        {
          x: g.player.pos.x,
          y: g.player.pos.y,
          z: g.player.pos.z,
          yaw: g.player.yaw,
          pose,
          speed: g.player.speed,
          place,
          area,
          pet: this.petWire(),
          equip: g.using?.id ?? null,
          mount: this.currentMount(),
        },
        now,
      );
    }

    this.remotes.sync(
      this.session,
      now,
      (id, u) => {
        try {
          return g.town.seatWorld(id, u);
        } catch {
          return null;
        }
      },
      place,
      area,
    );
    this.syncHousePlots();
  }

  /** Put each remote player's house on its own neighbourhood plot. */
  private syncHousePlots() {
    const plots = this.game.town.housePlots;
    if (!plots?.length) return;
    const remotes = [...this.session.remotes.values()];
    const styles = ['villa', 'gard', 'moderne', 'trehus', 'sjohus', 'slott'] as const;
    for (let i = 1; i < plots.length; i++) {
      const r = remotes[i - 1];
      if (!r) {
        this.game.town.setPlotHouse(i, null);
        continue;
      }
      // Stable style from id hash so the same friend always gets the same house look.
      let h = 0;
      for (let k = 0; k < r.id.length; k++) h = (h * 31 + r.id.charCodeAt(k)) | 0;
      const style = styles[Math.abs(h) % styles.length];
      this.game.town.setPlotHouse(i, style, r.name);
    }
  }

  private currentPlace(): PlaceWire {
    if (this.game.mode === 'house') return 'house';
    const inside = this.game.town.insideBuilding(this.game.player.pos.x, this.game.player.pos.z);
    if (inside) return inside;
    return 'town';
  }

  private currentMount(): MountWire {
    if (this.game.flying && this.game.riding) return 'fly';
    if (this.game.riding) return 'ride';
    if (this.game.holding) return 'hold';
    return 'none';
  }

  private petWire(): PetWire | null {
    const pet = this.game.mainPet();
    if (!pet || !SPECIES_BY_ID[pet.speciesId]) return null;
    return { speciesId: pet.speciesId, name: pet.name };
  }

  private updateBadge() {
    const btn = document.querySelector('.dock-btn.mp') as HTMLElement | null;
    if (!btn) return;
    const on = !!this.session.code;
    btn.classList.toggle('on', on);
    const b = btn.querySelector('b');
    if (b) b.textContent = on ? (this.session.code ?? 'Rom') : 'Sammen';
  }
}
