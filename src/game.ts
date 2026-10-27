import * as THREE from 'three';
import { sfx, setSoundEnabled } from './audio.ts';
import { FURN_BY_ID, HOUSE_BY_STYLE, TOYS, TOY_BY_ID } from './logic/catalog.ts';
import { activeHouse, buyFurniture, careAt, editHouse, feed, placeFromInventory, playWithToy, tickSave } from './logic/economy.ts';
import { playDone, startPlay, stepPlay, type PlayState } from './logic/toyplay.ts';
import { buildToy } from './three/toys.ts';
import { moveItem } from './logic/house.ts';
import { EQUIP_BY_ID, SIT_DROP, canUse, wantsOff } from './logic/playground.ts';
import { canEdit, careItems, updateItem } from './logic/house.ts';
import { NEED_INFO, stageOf, type CareWhere, type NeedKind, type PetState } from './logic/needs.ts';
import { SPECIES_BY_ID } from './logic/pets.ts';
import { loadSave, writeSave, type SaveData } from './logic/save.ts';
import { cameraRelative, orbit } from './logic/camera.ts';
import { movePlayer, resolve, type Colliders } from './logic/collision.ts';
import { Input } from './input.ts';
import { animateAvatar, buildAvatar, type AvatarPose, type AvatarRig } from './three/avatarModel.ts';
import { createInterior, type Interior } from './three/interior.ts';
import { FLOOR_H, floorOfY, groundHeight, onStairs, roomAt } from './logic/layout.ts';
import { blobShadow } from './three/kit.ts';
import { animatePet, buildPet, type PetPose, type PetRig } from './three/petModel.ts';
import { buildTown, type Town, type Zone } from './three/town.ts';
import { Thumbs } from './thumbs.ts';
import { toast } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';

export interface PetActor {
  uid: string;
  rig: PetRig;
  pos: THREE.Vector3;
  yaw: number;
  pose: PetPose;
  speed: number;
  wanderTarget: THREE.Vector3 | null;
  wanderAt: number;
  bubble: THREE.Sprite;
  bubbleKind: string;
  scale: number;
  care: { x: number; z: number; y?: number; pose: PetPose } | null;
  happyUntil: number;
  shadow: THREE.Mesh;
  /** A toy game in progress (fetch, chase, cuddle). */
  play?: PlayState;
  playToy?: string;
  stuck?: number;
  lastX?: number;
  lastZ?: number;
}

export interface PanelHooks {
  openBag(): void;
  openPets(): void;
  openAvatar(): void;
  openMap(): void;
  openBuild(): void;
  openShop(): void;
  openEggs(): void;
  openDoors(): void;
  openVetInfo(): void;
  feedMenu(uid: string): void;
  toyMenu(): void;
}

const GRAVITY = 32;
const WALK = 9;
const RIDE = 15;
const FLY = 18;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  town: Town;
  interior: Interior;
  thumbs: Thumbs;
  hud: Hud;
  input: Input;
  save: SaveData;
  mode: 'town' | 'house' = 'town';
  player = { pos: new THREE.Vector3(), vy: 0, yaw: 0, grounded: true, speed: 0 };
  cam = { yaw: 0, pitch: 0.38, dist: 15 };
  /** Camera distance actually used this frame (shorter than cam.dist while a building is in the way). */
  private camShown = 15;
  avatar!: AvatarRig;
  avatarHolder = (() => {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ'; // turn first, then lean (swing, slide)
    return g;
  })();
  avatarShadow = blobShadow(1.8);
  actors = new Map<string, PetActor>();
  holding: string | null = null;
  riding: string | null = null;
  flying = false;
  building = false;
  editingAvatar = false;
  selectedItem: string | null = null;
  panels!: PanelHooks;
  rng: () => number = Math.random;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private time = 0;
  private dirty = false;
  private lastSaveAt = 0;
  private lastTickAt = 0;
  private nearZone: Zone | { kind: 'exit'; label: string } | { kind: 'equip'; id: string; label: string } | { kind: 'equip-off'; label: string } | null = null;
  /** The playground piece you are sitting on (swing, slide, seesaw, merry-go-round), if any. */
  using: { id: string; since: number } | null = null;
  private bubbleTex = new Map<string, THREE.Texture>();
  private raycaster = new THREE.Raycaster();
  private dragItem: { uid: string; dx: number; dz: number } | null = null;
  private onChange: (() => void)[] = [];
  paused = false;

  constructor(private host: HTMLElement, ui: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.thumbs = new Thumbs(this.renderer);

    this.save = loadSave(localStorage);
    setSoundEnabled(this.save.sound);

    this.hemi = new THREE.HemisphereLight('#dff3ff', '#9ad07a', 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4dc', 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.town = buildTown();
    this.scene.add(this.town.group);
    this.interior = createInterior();
    this.interior.group.visible = false;
    this.scene.add(this.interior.group);
    this.town.setHomeStyle(activeHouse(this.save).style);

    this.scene.add(this.avatarHolder, this.avatarShadow);
    this.rebuildAvatar();

    this.hud = new Hud(ui, {
      bag: () => this.panels.openBag(),
      pets: () => this.panels.openPets(),
      avatar: () => this.panels.openAvatar(),
      map: () => this.panels.openMap(),
      build: () => this.panels.openBuild(),
      sound: () => this.toggleSound(),
      interact: () => this.interact(),
      hold: () => this.toggleHold(),
      ride: () => this.toggleRide(),
      fly: () => this.toggleFly(),
      feed: () => {
        const p = this.mainPet();
        if (p) this.panels.feedMenu(p.uid);
      },
      play: () => this.panels.toyMenu(),
    });
    this.hud.soundBtn.textContent = this.save.sound ? '🔊' : '🔇';
    this.input = new Input(this.renderer.domElement, this.hud.joyBase, this.hud.joyKnob, this.hud.jump);
    this.input.onTap = (t) => this.onTap(t.x, t.y);
    this.input.onDragStart = (t) => this.onDragStart(t.x, t.y);
    this.input.onDragMove = (t) => this.onDragMove(t.x, t.y);
    this.input.onDragEnd = () => (this.dragItem = null);
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyE' || e.code === 'Enter') && !this.paused && (e.target as HTMLElement)?.tagName !== 'INPUT') this.interact();
    });

    const s = this.town.spawn;
    this.player.pos.set(s.x, 0, s.z);
    this.player.yaw = s.yaw;
    this.cam.yaw = s.yaw + 0.5;
    this.syncPets();

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush();
    });
    window.addEventListener('pagehide', () => this.flush());
    this.resize();
    this.updateHud();
  }

  // ---------- state ----------
  commit(next: SaveData, opts: { pets?: boolean; house?: boolean; avatar?: boolean } = {}) {
    const prevBucks = this.save.bucks;
    const prevHouse = this.save.activeHouseId;
    this.save = next;
    this.dirty = true;
    if (opts.avatar) this.rebuildAvatar();
    if (opts.pets) this.syncPets();
    if (opts.house || prevHouse !== next.activeHouseId) {
      this.town.setHomeStyle(activeHouse(next).style);
      if (this.mode === 'house') {
        this.interior.build(activeHouse(next));
        this.clampPlayerToRoom();
      }
    } else if (this.mode === 'house') this.interior.syncItems(activeHouse(next));
    if (next.bucks !== prevBucks) this.hud.bumpBucks();
    this.updateHud();
    this.onChange.forEach((f) => f());
  }
  subscribe(f: () => void): () => void {
    this.onChange.push(f);
    return () => (this.onChange = this.onChange.filter((x) => x !== f));
  }
  flush() {
    writeSave(localStorage, this.save);
    this.dirty = false;
  }

  toggleSound() {
    this.commit({ ...this.save, sound: !this.save.sound });
    setSoundEnabled(this.save.sound);
    this.hud.soundBtn.textContent = this.save.sound ? '🔊' : '🔇';
  }

  updateHud() {
    this.hud.setBucks(this.save.bucks);
    const house = activeHouse(this.save);
    this.hud.setMode(this.mode, this.mode === 'house' ? HOUSE_BY_STYLE[house.style].name : 'Heddas by', canEdit(house, this.save.playerId));
    this.hud.setTasks(this.equippedPets(), (uid) => this.onTaskTap(uid));
    const p = this.mainPet();
    this.hud.setPetActions({
      any: !!p && !this.building && !this.editingAvatar,
      holding: !!this.holding,
      riding: !!this.riding,
      flying: this.flying,
      canRide: !!p && p.rideable && this.mode === 'town',
      canFly: !!p && p.flyable && this.mode === 'town',
      canPlay: !!p && !this.holding && !this.riding && !this.flying && !this.using && TOYS.some((t) => this.save.bag[t.id]),
      hungry: this.equippedPets().some((x) => x.need && (NEED_INFO[x.need.kind].where === 'mat' || NEED_INFO[x.need.kind].where === 'drikke')),
    });
  }

  equippedPets(): PetState[] {
    return this.save.equipped.map((u) => this.save.pets.find((p) => p.uid === u)).filter((p): p is PetState => !!p);
  }
  mainPet(): PetState | null {
    return this.equippedPets()[0] ?? null;
  }

  private onTaskTap(uid: string) {
    const pet = this.save.pets.find((p) => p.uid === uid);
    if (!pet?.need) return;
    const where = NEED_INFO[pet.need.kind].where;
    if (where === 'mat' || where === 'drikke') this.panels.feedMenu(uid);
    else if (where === 'dyrlege') this.panels.openMap();
    else if (where === 'lek') this.panels.openMap();
    else if (where === 'seng' || where === 'bad') {
      if (this.mode === 'town') this.panels.openMap();
      else toast(where === 'seng' ? 'Gå bort til en seng 🛏️' : 'Gå bort til badekaret eller dusjen 🛁');
    } else toast('Gå en tur ute i byen 🌳');
  }

  // ---------- avatar ----------
  rebuildAvatar() {
    this.avatarHolder.clear();
    this.avatar = buildAvatar(this.save.avatar);
    this.avatarHolder.add(this.avatar.root);
  }

  // ---------- pets ----------
  private needTexture(kind: string): THREE.Texture {
    let t = this.bubbleTex.get(kind);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const sick = kind === 'syk';
    ctx.fillStyle = sick ? '#ffdede' : '#ffffff';
    ctx.strokeStyle = sick ? '#ff4b4b' : '#c9b8d8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 56, 48, 0, Math.PI * 2);
    ctx.moveTo(52, 100);
    ctx.lineTo(64, 124);
    ctx.lineTo(76, 100);
    ctx.fill();
    ctx.stroke();
    ctx.font = '56px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'heart' ? '💖' : NEED_INFO[kind as NeedKind]?.emoji ?? '❔', 64, 60);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.bubbleTex.set(kind, t);
    return t;
  }

  /** Which pets are in the world: equipped ones always, plus resting pets in the house. */
  syncPets() {
    const want = new Set(this.save.equipped);
    if (this.mode === 'house') this.save.pets.filter((p) => !want.has(p.uid)).slice(0, 8).forEach((p) => want.add(p.uid));
    for (const [uid, a] of this.actors) {
      const pet = this.save.pets.find((p) => p.uid === uid);
      if (!want.has(uid) || !pet) {
        this.scene.remove(a.rig.root, a.bubble, a.shadow);
        this.actors.delete(uid);
      }
    }
    if (this.holding && !this.save.equipped.includes(this.holding)) this.holding = null;
    if (this.riding && !this.save.equipped.includes(this.riding)) {
      this.riding = null;
      this.flying = false;
    }
    let i = 0;
    for (const uid of want) {
      const pet = this.save.pets.find((p) => p.uid === uid)!;
      let a = this.actors.get(uid);
      if (!a) {
        const rig = buildPet(SPECIES_BY_ID[pet.speciesId]);
        const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.needTexture('heart'), depthTest: false }));
        bubble.renderOrder = 10;
        bubble.visible = false;
        const shadow = blobShadow(1.6);
        const ang = this.player.yaw + Math.PI + (i - 0.5) * 0.9;
        a = {
          uid,
          rig,
          pos: new THREE.Vector3(this.player.pos.x + Math.sin(ang) * 2.5, 0, this.player.pos.z + Math.cos(ang) * 2.5),
          yaw: this.player.yaw,
          pose: 'idle',
          speed: 0,
          wanderTarget: null,
          wanderAt: 0,
          bubble,
          bubbleKind: 'heart',
          scale: 1,
          care: null,
          happyUntil: 0,
          shadow,
        };
        if (this.mode === 'house' && !this.save.equipped.includes(uid)) a.pos.set((this.rng() - 0.5) * (this.interior.w - 3), 0, (this.rng() - 0.5) * (this.interior.d - 3));
        this.scene.add(rig.root, bubble, shadow);
        this.actors.set(uid, a);
      }
      a.scale = stageOf(pet.xp).scale * 1.5;
      i++;
    }
  }

  /** Pet stage scale; riding makes the pet big enough to sit on. */
  private actorScale(a: PetActor): number {
    return this.riding === a.uid ? Math.max(2.2, a.scale * 2) : this.holding === a.uid ? a.scale * 0.75 : a.scale;
  }

  toggleHold() {
    const p = this.mainPet();
    if (!p) return;
    if (this.holding) this.holding = null;
    else {
      this.riding = null;
      this.flying = false;
      this.holding = p.uid;
      sfx.pop();
    }
    this.updateHud();
  }
  toggleRide() {
    const p = this.mainPet();
    if (!p || !p.rideable) return;
    this.holding = null;
    if (this.riding) {
      this.riding = null;
      this.flying = false;
    } else {
      this.riding = p.uid;
      this.flying = false;
      sfx.whoosh();
    }
    this.updateHud();
  }
  toggleFly() {
    const p = this.mainPet();
    if (!p || !p.flyable) return;
    this.holding = null;
    if (this.flying) this.flying = false;
    else {
      this.riding = p.uid;
      this.flying = true;
      this.player.vy = 10;
      this.player.grounded = false;
      sfx.whoosh();
      toast('Hold ⬆ for å fly høyere!');
    }
    this.updateHud();
  }

  // ---------- places ----------
  enterHouse() {
    if (this.using) this.stopUse();
    this.cancelPlays();
    this.mode = 'house';
    this.holding = null;
    this.riding = null;
    this.flying = false;
    const house = activeHouse(this.save);
    this.interior.build(house);
    this.town.group.visible = false;
    this.interior.group.visible = true;
    this.player.pos.set(this.interior.door.x, 0, this.interior.door.z - 1.5);
    this.player.vy = 0;
    this.player.yaw = Math.PI;
    this.cam.yaw = 0;
    this.cam.pitch = 0.6;
    this.cam.dist = 14;
    this.scene.background = new THREE.Color('#ffe9f3');
    this.scene.fog = null;
    this.actors.forEach((a) => a.pos.set(this.player.pos.x + (this.rng() - 0.5) * 3, 0, this.player.pos.z - 2.5));
    this.syncPets();
    sfx.door();
    this.updateHud();
  }

  /** Walk out of the front door: you appear on the street in front of your house. */
  exitHouse() {
    this.cancelPlays();
    if (this.building) this.setBuilding(false);
    this.mode = 'town';
    this.interior.group.visible = false;
    this.town.group.visible = true;
    this.setSky();
    const p = this.town.entrances.home;
    this.player.pos.set(p.x, 0, p.z);
    this.player.vy = 0;
    this.player.yaw = p.yaw;
    this.cam.yaw = p.yaw + Math.PI;
    this.cam.pitch = 0.38;
    this.cam.dist = 15;
    this.actors.forEach((a, uid) => {
      const i = this.save.equipped.indexOf(uid);
      a.pos.set(p.x + Math.sin(p.yaw + Math.PI + i) * 2.5, 0, p.z + Math.cos(p.yaw + Math.PI + i) * 2.5);
    });
    sfx.door();
    this.syncPets();
    this.updateHud();
  }

  private setSky() {
    this.scene.background = new THREE.Color('#9fdcff');
    this.scene.fog = new THREE.Fog('#bfe8ff', 90, 230);
  }

  interact() {
    const z = this.nearZone;
    if (!z || this.paused) return;
    switch (z.kind) {
      case 'home':
        this.enterHouse();
        break;
      case 'exit':
        this.exitHouse();
        break;
      case 'shop':
        this.panels.openShop();
        break;
      case 'eggs':
        this.panels.openEggs();
        break;
      case 'doors':
        this.panels.openDoors();
        break;
      case 'vet':
        this.panels.openVetInfo();
        break;
      case 'play':
        toast('Lek med dyrene dine her! ⚽');
        break;
      case 'equip':
        this.startUse(z.id);
        break;
      case 'equip-off':
        this.stopUse();
        break;
    }
  }

  // ---------- toys ----------
  private toyMesh: THREE.Group | null = null;
  private toyMeshId = '';

  /** Is any animal playing with a toy right now? */
  playing(): boolean {
    return [...this.actors.values()].some((a) => !!a.play);
  }

  /**
   * Take a toy from the backpack and play with the animal closest to you (your follower first).
   * The animal runs after it with a visible game; happiness goes up straight away.
   */
  playWithToy(toyId: string): boolean {
    const toy = TOY_BY_ID[toyId];
    if (!toy || this.paused || this.editingAvatar || this.building) return false;
    if (this.riding || this.holding || this.flying || this.using) {
      toast('Sett dyret ned først 🐾', 'bad');
      return false;
    }
    if (!this.save.bag[toyId]) {
      toast('Du har ikke den leken. Kjøp den i Butikken 🛒', 'bad');
      return false;
    }
    const p = this.player.pos;
    let best: PetActor | null = null;
    let bestD = 9;
    for (const a of this.actors.values()) {
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - (this.save.equipped.includes(a.uid) ? 3 : 0);
      if (d < bestD && Math.abs(a.pos.y - p.y) < 3.5) {
        best = a;
        bestD = d;
      }
    }
    if (!best) {
      toast('Ingen dyr i nærheten å leke med 🐾', 'bad');
      return false;
    }
    if (best.play) {
      toast('Dyret leker allerede! 🎉');
      return false;
    }
    const pet = this.save.pets.find((x) => x.uid === best!.uid)!;
    if (pet.need?.kind === 'syk') {
      toast(`${pet.name} er syk og må til Dyrlegen først 🤒`, 'bad');
      return false;
    }
    const r = playWithToy(this.save, pet.uid, toyId, Date.now(), this.rng);
    if (r.reason) {
      sfx.nope();
      return false;
    }
    this.commit(r.save);
    const house = this.mode === 'house';
    best.play = startPlay(toy.play, { x: p.x, z: p.z }, this.player.yaw, house ? 3.2 : undefined);
    best.playToy = toyId;
    toast(`${pet.name} ${toy.verb}! 💖`, 'gold');
    if (r.done) toast(`${pet.name} kjeder seg ikke lenger! +${r.reward} bucks`, 'gold');
    sfx.pop();
    return true;
  }

  private cancelPlays() {
    for (const a of this.actors.values()) {
      a.play = undefined;
      a.playToy = undefined;
    }
    this.updateToyMesh();
  }

  /** Show the toy of the game in progress (one at a time is plenty). */
  private updateToyMesh() {
    const a = [...this.actors.values()].find((x) => x.play && x.play.toy.visible);
    if (!a || !a.play || !a.playToy) {
      if (this.toyMesh) this.toyMesh.visible = false;
      return;
    }
    if (!this.toyMesh || this.toyMeshId !== a.playToy) {
      if (this.toyMesh) this.scene.remove(this.toyMesh);
      this.toyMesh = buildToy(a.playToy);
      this.toyMeshId = a.playToy;
      this.scene.add(this.toyMesh);
    }
    const t = a.play.toy;
    const m = this.toyMesh;
    m.visible = true;
    const base = this.mode === 'house' ? this.groundAt(a.pos.x, a.pos.y, a.pos.z) : 0;
    if (this.playCarried.has(a.uid)) {
      m.position.set(a.pos.x + Math.sin(a.yaw) * 0.6 * this.actorScale(a), a.pos.y + 0.55 * this.actorScale(a), a.pos.z + Math.cos(a.yaw) * 0.6 * this.actorScale(a));
      m.rotation.set(0, a.yaw, 0);
    } else {
      m.position.set(t.x, base + t.y - 0.25 * 0, t.z);
      m.rotation.set(0, t.spin, 0);
    }
  }
  private playCarried = new Set<string>();

  // ---------- playground equipment ----------
  /** Climb on a swing / slide / seesaw / merry-go-round. Needs you to be close to it and not busy with an animal. */
  startUse(id: string): boolean {
    const def = EQUIP_BY_ID[id];
    const eq = this.town.equipment.find((e) => e.id === id);
    if (!def || !eq || this.mode !== 'town' || this.using) return false;
    if (!canUse({ riding: !!this.riding, holding: !!this.holding, flying: this.flying, paused: this.paused })) {
      toast('Sett dyret ned først 🐾', 'bad');
      return false;
    }
    if (Math.hypot(this.player.pos.x - eq.wx, this.player.pos.z - eq.wz) > eq.reach + 0.5) {
      toast(`Gå litt nærmere ${def.label} 👣`);
      return false;
    }
    this.using = { id, since: this.time };
    this.player.vy = 0;
    this.player.grounded = true;
    sfx.pop();
    this.updateHud();
    return true;
  }

  /** Step off: you stand on the free spot next to it. */
  stopUse() {
    const u = this.using;
    if (!u) return;
    const eq = this.town.equipment.find((e) => e.id === u.id)!;
    this.using = null;
    this.town.setEquipUse(null);
    this.player.pos.set(eq.exitX, 0, eq.exitZ);
    this.player.yaw = eq.exitYaw;
    this.player.vy = 0;
    this.player.grounded = true;
    this.collide();
    this.avatarHolder.rotation.set(0, this.player.yaw, 0);
    this.updateHud();
  }

  // ---------- building ----------
  setBuilding(on: boolean) {
    this.building = on;
    document.body.classList.toggle('building', on);
    this.selectedItem = null;
    this.interior.select(null);
    this.holding = null;
    if (on) {
      // an overview, but you stay in the room and can keep walking around while you furnish
      this.cam.pitch = Math.max(this.cam.pitch, 0.85);
      this.cam.dist = Math.max(this.cam.dist, 20);
    } else {
      this.cam.pitch = 0.6;
      this.cam.dist = 14;
    }
    this.updateHud();
  }

  selectItem(uid: string | null) {
    this.selectedItem = uid;
    this.interior.select(uid);
    this.onChange.forEach((f) => f());
  }

  private ndc(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  private pickItem(x: number, y: number): string | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const floor = this.playerFloor();
    const candidates = [...this.interior.items.values()].filter((g) => ((g.userData.floor as number) ?? 0) <= floor);
    const hits = this.raycaster.intersectObjects(candidates, true);
    return (hits[0]?.object.userData.uid as string) ?? null;
  }
  /** Where the pointer touches the floor plane of the given storey. */
  private floorPoint(x: number, y: number, floor = 0): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floor * FLOOR_H), p) ? p : null;
  }
  playerFloor(): number {
    return this.mode === 'house' ? floorOfY(this.player.pos.y) : 0;
  }
  /** A free-ish spot a couple of steps in front of the player, on the player's floor, for new furniture. */
  placeSpot(): { x: number; z: number; floor: number } {
    const p = this.player;
    const j = () => (this.rng() - 0.5) * 0.8;
    return { x: p.pos.x + Math.sin(p.yaw) * 2.8 + j(), z: p.pos.z + Math.cos(p.yaw) * 2.8 + j(), floor: this.playerFloor() };
  }
  private onTap(x: number, y: number) {
    if (this.building) {
      this.selectItem(this.pickItem(x, y));
      if (this.selectedItem) sfx.pop();
      return;
    }
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    // tap a swing, slide, seesaw or merry-go-round: climb on (tap again to get off)
    if (this.mode === 'town' && !this.paused) {
      const hit = this.raycaster.intersectObjects(this.town.equipTargets, true)[0];
      if (hit) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.equip) o = o.parent;
        if (o) {
          if (this.using) this.stopUse();
          else this.startUse(o.userData.equip as string);
          return;
        }
      }
    }
    // tap a pet: it does a happy hop
    for (const a of this.actors.values()) {
      if (this.raycaster.intersectObject(a.rig.root, true).length) {
        a.happyUntil = this.time + 1.2;
        sfx.wobble();
        break;
      }
    }
  }
  private onDragStart(x: number, y: number): boolean {
    if (!this.building) return false;
    const uid = this.pickItem(x, y);
    if (!uid) return false;
    const g = this.interior.items.get(uid)!;
    const p = this.floorPoint(x, y, (g.userData.floor as number) ?? 0);
    if (!p) return false;
    this.selectItem(uid);
    this.dragItem = { uid, dx: g.position.x - p.x, dz: g.position.z - p.z };
    return true;
  }
  private onDragMove(x: number, y: number) {
    if (!this.dragItem) return;
    const house = activeHouse(this.save);
    const it = house.items.find((i) => i.uid === this.dragItem!.uid);
    if (!it) return;
    const p = this.floorPoint(x, y, it.floor);
    if (!p) return;
    const nx = p.x + this.dragItem.dx;
    const nz = p.z + this.dragItem.dz;
    this.moveItemLive(it.uid, nx, nz);
  }
  moveItemLive(uid: string, x: number, z: number) {
    const save = this.save;
    const house = activeHouse(save);
    // swept, so furniture slides along walls and can never be dragged through them
    const h = moveItem(house, uid, x, z);
    if (h === house) return;
    this.commit({ ...save, houses: save.houses.map((x2) => (x2.id === h.id ? h : x2)) });
  }

  // ---------- loop ----------
  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.setSky();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.step(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Advance the game by dt seconds (also used by tests/screenshots). */
  step(dt: number) {
    this.time += dt;
    const t = this.time;
    const now = Date.now();
    const inp = this.input.poll();
    if (this.using && wantsOff(inp.move, inp.jumpPressed)) this.stopUse();
    const frozen = this.paused || this.editingAvatar || !!this.using;

    // needs tick
    if (now - this.lastTickAt > 1000) {
      this.lastTickAt = now;
      const before = this.save;
      const next = tickSave(this.save, now, this.rng);
      if (next !== before) {
        const newSick = next.pets.some((p) => p.need?.kind === 'syk' && before.pets.find((b) => b.uid === p.uid)?.need?.kind !== 'syk');
        this.commit(next);
        if (newSick) {
          toast('Å nei! Et dyr er sykt. Ta det til Dyrlegen! 🤒', 'bad');
          sfx.nope();
        } else sfx.pop();
      }
    }
    if (this.dirty && now - this.lastSaveAt > 2000) {
      this.lastSaveAt = now;
      this.flush();
    }

    // camera input
    const maxDist = this.building ? 30 : this.mode === 'house' ? 22 : 34;
    this.cam = orbit(this.cam, inp.camDX, inp.camDY, inp.zoom, maxDist);

    // movement
    const p = this.player;
    const prev = p.pos.clone();
    let mx = 0;
    let mz = 0;
    if (!frozen) {
      // forward is always away from the camera
      const m = cameraRelative(inp.move, this.cam.yaw);
      mx = m.x;
      mz = m.z;
    }
    const mlen = Math.hypot(mx, mz);
    const speed = this.flying ? FLY : this.riding ? RIDE : WALK;
    if (mlen > 0.05) {
      // move in small steps so nothing thin can be skipped, sliding along whatever we hit
      movePlayer(p.pos, mx * speed * dt, mz * speed * dt, this.playerRadius(), this.colliders(), this.mode === 'town' ? this.town.size / 2 - 2 : undefined);
      if (this.mode === 'house') this.clampPlayerToRoom();
      const targetYaw = Math.atan2(mx, mz);
      let d = targetYaw - p.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += d * Math.min(1, dt * 12);
    }
    p.speed = mlen;
    // jump / fly (or: sitting on a playground piece, which carries you)
    if (this.using) {
      const seat = this.town.seatWorld(this.using.id, this.time - this.using.since);
      p.pos.set(seat.x, seat.y, seat.z);
      p.yaw = seat.yaw;
      p.vy = 0;
      p.grounded = true;
    } else if (this.flying) {
      if (inp.jump && !frozen) p.vy = Math.min(p.vy + 40 * dt, 9);
      else p.vy = Math.max(p.vy - 14 * dt, -4);
      p.pos.y += p.vy * dt;
      if (p.pos.y > 34) {
        p.pos.y = 34;
        p.vy = 0;
      }
      if (p.pos.y <= 0) {
        p.pos.y = 0;
        p.vy = 0;
      }
    } else {
      if (inp.jumpPressed && p.grounded && !frozen) {
        p.vy = this.riding ? 13 : 11;
        p.grounded = false;
        sfx.pop();
      }
      p.vy -= GRAVITY * dt;
      p.pos.y += p.vy * dt;
      const ground = this.groundHere();
      // walking up/down the stairs keeps you on the ramp; a jump or a fall lands on it
      if (p.pos.y <= ground || (p.grounded && p.vy <= 0 && p.pos.y - ground < 1.5 && this.mode === 'house')) {
        p.pos.y = ground;
        p.vy = 0;
        p.grounded = true;
      }
    }
    if (!this.using) this.collide();
    const moved = this.using ? 0 : Math.hypot(p.pos.x - prev.x, p.pos.z - prev.z);

    // avatar
    const ride = this.riding ? this.actors.get(this.riding) : undefined;
    let pose: AvatarPose = 'idle';
    if (ride) pose = this.flying ? 'fly' : 'sit';
    else if (!p.grounded) pose = 'jump';
    else if (mlen > 0.05) pose = 'walk';
    const seat = this.using ? this.town.seatWorld(this.using.id, this.time - this.using.since) : null;
    if (seat) pose = seat.pose;
    if (this.editingAvatar) pose = 'wave';
    this.avatarHolder.position.copy(p.pos);
    if (ride) this.avatarHolder.position.y += ride.rig.seatY * this.actorScale(ride) - 0.95;
    this.avatarHolder.rotation.set(seat ? seat.tilt : 0, p.yaw, 0);
    if (seat && seat.tilt !== 0) {
      // lean about the hips, not the feet: shift the origin so the seat stays under the avatar
      const hip = SIT_DROP;
      this.avatarHolder.position.x -= Math.sin(p.yaw) * hip * Math.sin(seat.tilt);
      this.avatarHolder.position.z -= Math.cos(p.yaw) * hip * Math.sin(seat.tilt);
      this.avatarHolder.position.y += hip * (1 - Math.cos(seat.tilt));
    }
    animateAvatar(this.avatar, t, pose, seat ? 1 : mlen, !!this.holding);
    this.avatarShadow.position.set(p.pos.x, this.groundAt(p.pos.x, p.pos.y, p.pos.z) + 0.03, p.pos.z);
    this.avatarShadow.visible = !ride;

    // pets
    this.updatePets(dt, t, moved);
    this.updateToyMesh();

    // zones + care
    this.updateZones(dt, moved, now);

    // camera
    const target = new THREE.Vector3(p.pos.x, p.pos.y + (ride ? 3.5 : 2.4), p.pos.z);
    // on a swing or the merry-go-round the camera watches the whole piece, not the (moving) rider
    if (seat) target.set(seat.focus.x, seat.focus.y, seat.focus.z);
    // while furnishing, the panel covers the lower right: shift the picture up so you and the room stay in view
    const vw = this.renderer.domElement.clientWidth;
    const vh = this.renderer.domElement.clientHeight;
    if (this.building && vw > 0) this.camera.setViewOffset(vw, vh, 0, vh * 0.16, vw, vh);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    if (this.editingAvatar) {
      const fy = p.yaw;
      this.camera.position.set(p.pos.x + Math.sin(fy) * 6.5 + Math.cos(fy) * 1.6, p.pos.y + 2.4, p.pos.z + Math.cos(fy) * 6.5 - Math.sin(fy) * 1.6);
      this.camera.lookAt(p.pos.x + Math.cos(fy) * 1.4, p.pos.y + 1.5, p.pos.z - Math.sin(fy) * 1.4);
    } else {
      const cp = Math.cos(this.cam.pitch);
      let dist = this.cam.dist;
      if (this.mode === 'town' && !this.building) {
        // pulled in at once when a building is in the way, eased back out afterwards (no popping)
        const room = this.cameraRoom(target, cp);
        this.camShown = room < this.camShown ? room : this.camShown + (Math.min(room, this.cam.dist) - this.camShown) * Math.min(1, dt * 6);
        dist = Math.min(this.camShown, this.cam.dist);
      }
      this.camera.position.set(target.x + Math.sin(this.cam.yaw) * cp * dist, target.y + Math.sin(this.cam.pitch) * dist, target.z + Math.cos(this.cam.yaw) * cp * dist);
      if (this.camera.position.y < 0.6) this.camera.position.y = 0.6;
      this.camera.lookAt(target);
    }
    if (this.mode === 'house') {
      this.interior.updateWalls(this.camera.position, new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), this.playerFloor());
      this.interior.update(t);
      const room = roomAt(this.interior.layout, this.playerFloor(), p.pos.x, p.pos.z);
      this.hud.setWhere(`${HOUSE_BY_STYLE[activeHouse(this.save).style].name} · ${onStairs(this.interior.layout.stairs, p.pos.x, p.pos.z) ? 'Trapp' : room?.name ?? ''}${this.playerFloor() ? ' (oppe)' : ''}`);
    } else {
      this.town.setEquipUse(this.using ? { id: this.using.id, u: this.time - this.using.since } : null);
      this.town.update(t, p.pos.x, p.pos.z, this.camera.position.x, this.camera.position.z);
    }

    // sun follows the player for crisp shadows nearby
    this.sun.position.set(p.pos.x + 20, 45, p.pos.z + 14);
    this.sun.target.position.set(p.pos.x, 0, p.pos.z);
  }

  /** Ground under any point (for shadows). */
  private groundAt(x: number, y: number, z: number): number {
    return this.mode === 'house' ? groundHeight(this.interior.layout, x, z, floorOfY(y)) : 0;
  }
  /** Height of the walkable floor under the player (stairs are a ramp). */
  private groundHere(): number {
    if (this.mode !== 'house') return 0;
    return groundHeight(this.interior.layout, this.player.pos.x, this.player.pos.z, floorOfY(this.player.pos.y));
  }

  /** Player body size: smaller indoors so furniture doesn't feel like a maze. */
  private playerRadius(): number {
    if (this.mode === 'house') return this.riding ? 1.0 : 0.45;
    return this.riding ? 1.3 : 0.55;
  }
  private colliders(): Colliders {
    return this.mode === 'house' ? this.interior.collidersFor(this.playerFloor()) : this.town;
  }
  /** Settle the player after jumping/placing furniture: push out of anything solid. */
  private collide() {
    const pos = this.player.pos;
    if (this.mode === 'town') {
      const half = this.town.size / 2 - 2;
      pos.x = THREE.MathUtils.clamp(pos.x, -half, half);
      pos.z = THREE.MathUtils.clamp(pos.z, -half, half);
    }
    resolve(pos, this.playerRadius(), this.colliders());
    if (this.mode === 'house') this.clampPlayerToRoom();
  }

  /** Pull the camera in so it doesn't end up inside a building. */
  private cameraRoom(target: THREE.Vector3, cp: number): number {
    const dx = Math.sin(this.cam.yaw) * cp;
    const dz = Math.cos(this.cam.yaw) * cp;
    const dy = Math.sin(this.cam.pitch);
    const steps = 16;
    const inside = this.town.buildingAt(target.x, target.z);
    for (let i = 1; i <= steps; i++) {
      const d = (this.cam.dist * i) / steps;
      const x = target.x + dx * d;
      const z = target.z + dz * d;
      const y = target.y + dy * d;
      for (const b of this.town.rects) {
        if ((b.h ?? 99) < 4 || y > (b.h ?? 99)) continue; // only buildings and tall walls hide the player
        if (inside && Math.hypot(b.x - inside.x, b.z - inside.z) < inside.r) continue; // walls of the shop you are in are hidden instead
        const cos = Math.cos(b.rot);
        const sin = Math.sin(b.rot);
        const lx = (x - b.x) * cos - (z - b.z) * sin;
        const lz = (x - b.x) * sin + (z - b.z) * cos;
        if (Math.abs(lx) < b.hw + 0.6 && Math.abs(lz) < b.hd + 0.6) return Math.max(3, (this.cam.dist * (i - 1)) / steps);
      }
    }
    return this.cam.dist;
  }

  private clampPlayerToRoom() {
    const w = this.interior.w / 2 - 0.8;
    const d = this.interior.d / 2 - 0.8;
    this.player.pos.x = THREE.MathUtils.clamp(this.player.pos.x, -w, w);
    this.player.pos.z = THREE.MathUtils.clamp(this.player.pos.z, -d, d);
  }

  private updatePets(dt: number, t: number, _moved: number) {
    const p = this.player;
    let followIdx = 0;
    for (const a of this.actors.values()) {
      const pet = this.save.pets.find((x) => x.uid === a.uid);
      if (!pet) continue;
      const equipped = this.save.equipped.includes(a.uid);
      const s = this.actorScale(a);
      a.rig.root.scale.setScalar(s);
      let pose: PetPose = 'idle';
      if (this.riding === a.uid) {
        a.pos.copy(p.pos);
        a.yaw = p.yaw;
        pose = this.flying ? (p.pos.y > 0.2 ? 'fly' : 'idle') : p.speed > 0.05 ? 'walk' : 'idle';
        a.speed = p.speed;
      } else if (this.holding === a.uid) {
        const fy = p.yaw;
        a.pos.set(p.pos.x + Math.sin(fy) * 0.9, p.pos.y + 0.8, p.pos.z + Math.cos(fy) * 0.9);
        a.yaw = p.yaw;
        pose = 'held';
      } else {
        let target = new THREE.Vector3(a.pos.x, 0, a.pos.z);
        let stopDist = 0.3;
        const inHouse = this.mode === 'house';
        const lay = this.interior.layout;
        const petFloor = inHouse ? floorOfY(a.pos.y) : 0;
        let playPose: PetPose | null = null;
        if (a.play) {
          // a toy game: the script says where to run and what to do
          const st = stepPlay(a.play, dt, { x: a.pos.x, z: a.pos.z }, { x: p.pos.x, z: p.pos.z });
          if (st.carried) this.playCarried.add(a.uid);
          else this.playCarried.delete(a.uid);
          target = st.target ? new THREE.Vector3(st.target.x, 0, st.target.z) : new THREE.Vector3(a.pos.x, 0, a.pos.z);
          stopDist = Math.max(0.3, st.stopDist);
          playPose = st.pose === 'walk' ? 'idle' : st.pose;
          if (playDone(a.play)) {
            a.play = undefined;
            a.playToy = undefined;
            this.playCarried.delete(a.uid);
          }
        }
        if (a.play) {
          // (handled above)
        } else if (a.care) {
          target = new THREE.Vector3(a.care.x, 0, a.care.z);
          stopDist = 0.5;
        } else if (equipped) {
          const ang = p.yaw + Math.PI + (followIdx === 0 ? -0.5 : 0.5);
          const off = 2.6 + followIdx * 0.6;
          target = new THREE.Vector3(p.pos.x + Math.sin(ang) * off, 0, p.pos.z + Math.cos(ang) * off);
          stopDist = 0.6;
          followIdx++;
          if (inHouse && petFloor !== this.playerFloor()) {
            // on another floor: walk to the foot of the stairs, then up (or down) them
            const s = lay.stairs;
            const lane = (s.x0 + s.x1) / 2;
            const downstairs = petFloor === 0;
            const nearBottom = Math.abs(a.pos.z - s.zBottom) < 2.5 && Math.abs(a.pos.x - lane) < 3;
            const onRamp = onStairs(s, a.pos.x, a.pos.z) || nearBottom;
            target = downstairs ? (onRamp ? new THREE.Vector3(lane, 0, s.zTop - 1) : new THREE.Vector3(lane, 0, s.zBottom + 1.2)) : onRamp ? new THREE.Vector3(lane, 0, s.zBottom + 1.5) : new THREE.Vector3(lane, 0, s.zTop - 0.6);
            if (onStairs(s, a.pos.x, a.pos.z)) target = new THREE.Vector3(lane, 0, downstairs ? s.zTop - 1 : s.zBottom + 1.5);
            stopDist = 0.3;
          }
        } else {
          // resting pets wander around the house
          if (!a.wanderTarget || t > a.wanderAt) {
            a.wanderTarget = new THREE.Vector3((this.rng() - 0.5) * (this.interior.w - 3), 0, (this.rng() - 0.5) * (this.interior.d - 3));
            a.wanderAt = t + 4 + this.rng() * 6;
            if (inHouse && petFloor === 0 && onStairs(lay.stairs, a.wanderTarget.x, a.wanderTarget.z)) a.wanderTarget.z = lay.stairs.zBottom + 2;
          }
          target = a.wanderTarget;
        }
        const dx = target.x - a.pos.x;
        const dz = target.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const flyingPet = pet.flyable && equipped && this.flying;
        // a pet that has been stuck against a wall for a moment is lifted to the player (fine for a toy world)
        if (inHouse && equipped && !a.care) {
          a.stuck = d > stopDist + 0.5 && Math.hypot(a.pos.x - (a.lastX ?? a.pos.x), a.pos.z - (a.lastZ ?? a.pos.z)) < dt * 0.4 ? (a.stuck ?? 0) + dt : 0;
        }
        a.lastX = a.pos.x;
        a.lastZ = a.pos.z;
        if ((d > 25 && equipped) || ((a.stuck ?? 0) > 2.5 && equipped)) {
          if (inHouse) {
            a.pos.set(p.pos.x - Math.sin(p.yaw) * 1.6, p.pos.y, p.pos.z - Math.cos(p.yaw) * 1.6);
            resolve(a.pos, 0.5, this.interior.collidersFor(this.playerFloor()));
            a.stuck = 0;
          } else a.pos.set(target.x, 0, target.z);
        } else if (d > stopDist) {
          const sp = Math.min(d * (a.play ? 5 : 3), a.play ? WALK * 1.2 : equipped ? (this.riding ? RIDE : WALK) * 1.15 : 3);
          a.pos.x += (dx / d) * sp * dt;
          a.pos.z += (dz / d) * sp * dt;
          a.yaw = Math.atan2(dx, dz);
          a.speed = sp / WALK;
          pose = 'walk';
        } else {
          a.speed = 0;
          if (a.care) {
            pose = a.care.pose;
            a.yaw += Math.sin(t) * 0.002;
          }
        }
        if (inHouse) resolve(a.pos, 0.5, this.interior.collidersFor(floorOfY(a.pos.y)));
        const near = a.care && Math.hypot(a.care.x - a.pos.x, a.care.z - a.pos.z) < 1.2;
        let targetY = near ? (a.care!.y ?? 0) : equipped && p.pos.y > 1 && !inHouse ? Math.max(0, p.pos.y - 0.5) : 0;
        if (inHouse && !near) targetY = groundHeight(lay, a.pos.x, a.pos.z, floorOfY(a.pos.y));
        if (inHouse && !near && onStairs(lay.stairs, a.pos.x, a.pos.z)) a.pos.y = targetY;
        else a.pos.y += (targetY - a.pos.y) * Math.min(1, dt * 4);
        if (playPose && pose !== 'walk') pose = playPose;
        if (a.pos.y > 1 && (flyingPet || pet.flyable) && !near) pose = 'fly';
        if (pet.need?.kind === 'syk' && pose === 'idle') pose = 'sick';
      }
      if (t < a.happyUntil && pose !== 'held') pose = 'happy';
      a.pose = pose;
      a.rig.root.position.copy(a.pos);
      a.rig.root.rotation.y = a.yaw;
      animatePet(a.rig, t + a.uid.length, pose, a.speed);
      a.shadow.position.set(a.pos.x, this.groundAt(a.pos.x, a.pos.y, a.pos.z) + 0.025, a.pos.z);
      a.shadow.scale.setScalar(s);
      a.shadow.visible = this.riding !== a.uid && this.holding !== a.uid;
      // need bubble
      const kind = equipped && pet.need ? pet.need.kind : null;
      a.bubble.visible = !!kind && this.riding !== a.uid;
      if (kind) {
        if (a.bubbleKind !== kind) {
          (a.bubble.material as THREE.SpriteMaterial).map = this.needTexture(kind);
          (a.bubble.material as THREE.SpriteMaterial).needsUpdate = true;
          a.bubbleKind = kind;
        }
        const top = a.rig.topY * s;
        a.bubble.position.set(a.pos.x, a.pos.y + top + 0.9 + Math.sin(t * 3) * 0.1, a.pos.z);
        a.bubble.scale.setScalar(1.5);
      }
    }
  }

  private updateZones(dt: number, moved: number, now: number) {
    const p = this.player.pos;
    let near: Game['nearZone'] = null;
    let inVet = false;
    let inPlay = false;
    if (this.mode === 'town') {
      let best = Infinity;
      for (const z of this.town.zones) {
        const d = Math.hypot(p.x - z.x, p.z - z.z);
        if (z.kind === 'vet' && d < z.r + 1.5) inVet = true;
        if (z.kind === 'play' && d < z.r) inPlay = true;
        if (d < z.r && d < best && z.kind !== 'play') {
          best = d;
          near = z;
        }
      }
      // playground pieces: "Bruk huska", or "Gå av" while you sit on one
      if (this.using) near = { kind: 'equip-off', label: 'Gå av ✋' };
      else if (inPlay && canUse({ riding: !!this.riding, holding: !!this.holding, flying: this.flying, paused: this.paused })) {
        let bestK = 1;
        for (const e of this.town.equipment) {
          const k = Math.hypot(p.x - e.wx, p.z - e.wz) / e.reach;
          if (k <= bestK) {
            bestK = k;
            near = { kind: 'equip', id: e.id, label: `Bruk ${e.label} 🎠` };
          }
        }
      }
    } else {
      const d = Math.hypot(p.x - this.interior.door.x, p.z - this.interior.door.z);
      if (d < 2 && this.playerFloor() === 0) near = { kind: 'exit', label: 'Gå ut 🚪' };
    }
    if (this.building || this.editingAvatar || this.paused) near = null;
    this.nearZone = near;
    this.hud.setPrompt(near ? near.label : null);

    // care for equipped pets
    const house = this.mode === 'house' ? activeHouse(this.save) : null;
    let save = this.save;
    let changed = false;
    for (const pet of this.equippedPets()) {
      const a = this.actors.get(pet.uid);
      if (!a) continue;
      a.care = null;
      if (!pet.need) continue;
      const where: CareWhere = NEED_INFO[pet.need.kind].where;
      let amount = 0;
      if (where === 'dyrlege' && inVet) {
        amount = dt;
        // the sick animal lies down in the hospital bed closest to you
        const beds = [...this.town.vetBeds].sort((b1, b2) => Math.hypot(b1.x - p.x, b1.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z));
        const bed = beds[0];
        a.care = { x: bed.x, z: bed.z, y: bed.y, pose: 'sleep' };
      } else if (where === 'lek' && inPlay) {
        amount = dt;
        a.care = { x: p.x + Math.sin(this.time * 2) * 2, z: p.z + Math.cos(this.time * 2) * 2, pose: 'happy' };
      } else if (where === 'tur' && this.mode === 'town') amount = moved;
      else if (house && (where === 'seng' || where === 'bad' || where === 'lek')) {
        for (const it of careItems(house, where)) {
          const def = FURN_BY_ID[it.itemId];
          if (it.floor === this.playerFloor() && Math.hypot(p.x - it.x, p.z - it.z) < def.size * it.scale * 0.7 + 2.2) {
            amount = dt;
            const lift = def.model === 'petbed' ? 0.25 : where === 'seng' ? 0.85 : where === 'bad' && (def.model === 'bathtub' || def.model === 'hottub') ? 0.7 : 0;
            a.care = { x: it.x, z: it.z, y: lift * it.scale + it.floor * FLOOR_H, pose: where === 'seng' ? 'sleep' : 'happy' };
            break;
          }
        }
      }
      if (this.holding === pet.uid || this.riding === pet.uid) a.care = null;
      if (amount > 0) {
        const r = careAt(save, pet.uid, where, amount, now, this.rng);
        if (r.save !== save) {
          save = r.save;
          changed = true;
        }
        if (r.done) this.celebrate(pet, r.reward, r.grewUp, save);
      }
    }
    if (changed) this.commit(save);
  }

  celebrate(pet: PetState, reward: number, grewUp: boolean, save: SaveData) {
    const a = this.actors.get(pet.uid);
    if (a) {
      a.happyUntil = this.time + 2;
      a.care = null;
    }
    sfx.coin();
    toast(`${pet.name} er fornøyd! +${reward} bucks`, 'gold');
    if (grewUp) {
      const after = save.pets.find((x) => x.uid === pet.uid);
      if (after) {
        setTimeout(() => {
          sfx.grow();
          toast(`🎉 ${after.name} er nå ${stageOf(after.xp).name}!`, 'gold');
        }, 600);
      }
      this.syncPets();
    }
  }

  /** Fill the room with a nice set of furniture (used for demo screenshots). */
  debugFurnish() {
    let s: SaveData = { ...this.save, bucks: Math.max(this.save.bucks, 3000) };
    // a cosy ground floor (living room in the middle, bedroom and bathroom in the back) and a kids' room upstairs
    const plan: [string, number, number, number, number][] = [
      ['seng', -7.2, -6.3, 0, 0], ['sofa', 1.5, -1.2, 0, 0], ['salongbord', 1.5, 1.0, 0, 0], ['lenestol', 3.6, 1.4, -Math.PI / 2, 0],
      ['bokhylle', -9.6, 1.2, Math.PI / 2, 0], ['gulvlampe', -0.2, -1.6, 0, 0], ['maleri', 2, -8.7, 0, 0],
      ['klokke', -6.5, -8.7, 0, 0], ['akvarium', 8.5, 2.2, -Math.PI / 2, 0], ['regnbueteppe', -4.5, 3.0, 0, 0],
      ['bamse', -6.2, 3.4, 0.5, 0], ['ball', -2.8, 4.0, 0, 0], ['kaktus', 9, -0.6, 0, 0], ['hjertepute', -1.8, 2.0, 0.3, 0],
      ['seng', -7.2, -6.3, 0, 1], ['lavalampe', 7, -6, 0, 1], ['ballonger', -8.5, 4.6, 0, 1], ['regnbueteppe', 6, -2.5, 0, 1], ['bamse', 5.4, 0.5, 0.4, 1],
    ];
    for (const [id, x, z, rot, floor] of plan) {
      const b = buyFurniture(s, id);
      if (!b.ok) continue;
      const r = placeFromInventory(b.save, id, x, z, floor);
      if (!r.ok) continue;
      s = r.save;
      const h = activeHouse(s);
      const uid = h.items[h.items.length - 1].uid;
      if (rot) s = editHouse(s, (hh) => updateItem(hh, uid, { rot }));
    }
    this.commit(s);
  }

  feedPet(uid: string, foodId: string): boolean {
    const r = feed(this.save, uid, foodId, Date.now(), this.rng);
    if (!r.done) {
      if (r.reason === 'wrong') toast('Dyret vil ikke ha det nå', 'bad');
      else if (r.reason === 'empty') toast('Du har ikke mer av det – kjøp i Butikken', 'bad');
      sfx.nope();
      return false;
    }
    const pet = this.save.pets.find((p) => p.uid === uid)!;
    this.commit(r.save);
    this.celebrate(pet, r.reward, r.grewUp, r.save);
    return true;
  }
}
