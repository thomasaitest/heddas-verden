import type * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { SPECIES_BY_ID } from '../logic/pets.ts';
import type { PetState } from '../logic/needs.ts';
import { toast } from '../ui/dom.ts';
import type { AvatarPoseWire, PlaceWire, PetWire } from './protocol.ts';
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
  town: {
    insideBuilding(x: number, z: number): 'shop' | 'vet' | null;
    seatWorld(id: string, u: number): { x: number; y: number; z: number; yaw: number };
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

  tick(pose: AvatarPoseWire) {
    const g = this.game;
    const now = performance.now();

    if (this.session.active) {
      this.session.sendState(
        {
          x: g.player.pos.x,
          y: g.player.pos.y,
          z: g.player.pos.z,
          yaw: g.player.yaw,
          pose,
          speed: g.player.speed,
          place: this.currentPlace(),
          pet: this.petWire(),
          equip: g.using?.id ?? null,
        },
        now,
      );
    }

    this.remotes.sync(this.session, now, (id, u) => {
      try {
        return g.town.seatWorld(id, u);
      } catch {
        return null;
      }
    });
  }

  private currentPlace(): PlaceWire {
    if (this.game.mode === 'house') return 'house';
    const inside = this.game.town.insideBuilding(this.game.player.pos.x, this.game.player.pos.z);
    if (inside === 'shop' || inside === 'vet') return inside;
    return 'town';
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
