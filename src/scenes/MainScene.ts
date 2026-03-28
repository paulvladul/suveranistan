import Phaser from 'phaser';
import { GIFT_LABELS, GiftKind, SFX, TEX } from './PreloadScene';

const CHICKEN_HP = 2;
const STARTING_LIVES = 3;
/** 5 valuri cu flotă, apoi valul 6 = boss; după boss crește sectorul și reîncepi de la valul 1. */
const NORMAL_WAVE_COUNT = 5;
const BOSS_WAVE_NUMBER = 6;
const BOSS_BASE_HP = 48;
/** HP boss: crește puternic cu sectorul (liniar + pătratic + ușor cubic). */
const BOSS_HP_PER_STAGE = 40;
const BOSS_HP_STAGE_SQR = 3.2;
const BOSS_HP_STAGE_CUBE = 0.22;
/** Tranziție între valuri: fade in + afișare „Runda …” + fade out (ms pe fază). */
const ROUND_CARD_FADE_IN_MS = 280;
const ROUND_CARD_HOLD_MS = 920;
const ROUND_CARD_FADE_OUT_MS = 400;
/** Înainte de boss: sunet + mesaj pe ecran. */
const BOSS_APPROACH_DURATION_MS = 6000;
/** După boss învins: sectorend.mp3, apoi începe noul sector. */
const SECTOR_END_AFTER_BOSS_MS = 7000;
const BASE_MOVE_SPEED = 320;
const START_BULLET_COUNT = 1;
const MAX_BULLET_COUNT = 8;
const INVULN_MS = 2200;
const GIFT_DRIFT_SPEED = 52;
const GIFT_SPAWN_MIN_INTERVAL = 9000;
const GIFT_SPAWN_MAX_INTERVAL = 18000;
const CLEAR_RADIUS = 52;
/** Rază explozie jet apă; sortare după distanță, max. victime. */
const WATER_SPLASH_RADIUS = 260;
const WATER_SPLASH_MAX_KILLS = 8;
const WATER_BOMB_DURATION_MS = 300;
const MAX_WATER_CHARGES = 9;
/** Dimensiune afișare navă în lume (indiferent de rezoluția PNG-ului din `public/images/ship.png`). */
const SHIP_DISPLAY_WIDTH = 68;
const SHIP_DISPLAY_HEIGHT = 82;
/** Chenar maxim pentru banană PNG; scalare uniformă, fără deformare. */
const ENEMY_BULLET_MAX_DISPLAY_W = 72;
const ENEMY_BULLET_MAX_DISPLAY_H = 34;
/** Inamic „tare”: 3 HP, trage proiectile blugi; tot pui vizual, din sectorul 2. */
const TOUGH_ENEMY_HP = 3;
const TOUGH_ENEMY_FIRST_SECTOR = 2;
const TOUGH_ENEMY_SPAWN_CHANCE = 0.38;
const TOUGH_ENEMY_SCALE = 1.12;
/** Tentă rece / „platoșă”; rămâne același sprite ca puii obișnuiți. */
const TOUGH_ENEMY_TINT = 0xa8b8d0;
/** Când centrul proiectilului blugi ajunge aproape de baza canvasului, explodează. */
const JEANS_EXPLODE_BOTTOM_MARGIN = 78;
/** Raza exploziei = factor × max(lățime, înălțime) a proiectilului pe ecran. */
const JEANS_EXPLOSION_RADIUS_FACTOR = 2;
/** Primul boss: PNG scalat uniform; hitbox = exact displayWidth × displayHeight. */
const NICUSOR_BOSS_MAX_DISPLAY_W = 200;
const NICUSOR_BOSS_MAX_DISPLAY_H = 260;
/** Poziție inițială: centru orizontal, atâta px de la baza canvasului (ca la primul frame). */
const PLAYER_SPAWN_OFFSET_FROM_BOTTOM = 56;
/** După Reia din pauză: nava rămâne înghețată până miști mouse-ul cu atâția px față de poziția la resume. */
const POST_PAUSE_POINTER_DEADZONE_PX = 100;
export class MainScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;

  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private gifts!: Phaser.Physics.Arcade.Group;

  private moveSpeed = BASE_MOVE_SPEED;
  private fleetSpeed = 55;
  private fleetDir = 1;
  private nextFire = 0;
  private fireDelay = 220;
  private enemyProjectileSpeed = 135;
  private nextEnemyShotAt = 1800;
  private nextGiftAt = 5000;
  private matchEnded = false;

  /** Val curent: 1–5 flotă, 6 = boss. După boss → sector++ și revine la 1. */
  private waveNumber = 1;
  /** Sector / set de 5 valuri + boss; crește după fiecare boss învins. */
  private stageNumber = 1;
  private waveChickenHp = CHICKEN_HP;
  private waveGridRows = 3;
  private waveGridCols = 8;
  private enemyShotMinMs = 700;
  private enemyShotMaxMs = 1700;
  private waveBreakInProgress = false;

  private lives = STARTING_LIVES;
  private bulletCount = START_BULLET_COUNT;
  /** Încărcături jet apă (cadou Apă); consum la click dreapta în joc. */
  private waterCharges = 0;
  private invulnerableUntil = 0;
  private playerBlink?: Phaser.Time.TimerEvent;
  /** Front coborâtor pentru click dreapta = un singur jet per apăsare. */
  private prevRightButtonDown = false;
  private prevLeftButtonDown = false;

  private hud!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private startMenuLayer!: Phaser.GameObjects.Container;
  private pauseMenuLayer!: Phaser.GameObjects.Container;
  private gameOverLayer!: Phaser.GameObjects.Container;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossBarText!: Phaser.GameObjects.Text;
  private bossBarInnerWidth = 0;
  /** Overlay „Runda / Boss” între valuri; distrus după animație. */
  private roundAnnouncementLayer?: Phaser.GameObjects.Container;
  private bossApproachLayer?: Phaser.GameObjects.Container;
  private bossApproachSound?: Phaser.Sound.BaseSound;
  private sectorEndAfterBossSound?: Phaser.Sound.BaseSound;
  /** După apăsarea Start — altfel jocul e înghețat. */
  private gameplayActive = false;
  /** Meniu ESC: joc înghețat, „Reia jocul” pe canvas. */
  private escMenuOpen = false;
  /**
   * Doar după spawn la rundă nouă: relativ până la primul click stânga în canvas (evită saltul la cursor).
   * În rest, nava urmărește 1:1 cursorul cât timp e în canvas.
   */
  private shipAwaitingAlignClickAfterRound = false;
  /** >0: după pauză, nava înghețată până depărtezi mouse-ul de punctul de referință. */
  private postPausePointerDeadzonePx = 0;
  private postPausePointerRefX = 0;
  private postPausePointerRefY = 0;
  private shipControlBaseX = 0;
  private shipControlBaseY = 0;
  private shipControlPointerAnchorX = 0;
  private shipControlPointerAnchorY = 0;
  /**
   * TEST: primul cadou spawant cu succes e mereu Apă (+1 jet).
   * Pune `false` când nu mai testezi.
   */
  private forceWaterFirstGiftForTest = true;
  /** Blochează meniul contextual la click dreapta în rundă (armă specială). */
  private readonly boundCanvasContextMenu = (ev: MouseEvent): void => {
    if (this.matchEnded || !this.gameplayActive || this.escMenuOpen) return;
    ev.preventDefault();
  };

  /** ESC pentru pauză: capture pe `window` ca să fie mereu prins. */
  private readonly boundEscKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    if (this.matchEnded) return;
    if (this.escMenuOpen) {
      ev.preventDefault();
      this.closePauseMenu();
      return;
    }
    if (!this.gameplayActive) return;
    ev.preventDefault();
    this.openPauseMenu();
  };

  constructor() {
    super({ key: 'MainScene' });
  }

  shutdown(): void {
    this.sectorEndAfterBossSound?.stop();
    this.sectorEndAfterBossSound?.destroy();
    this.sectorEndAfterBossSound = undefined;
    this.bossApproachSound?.stop();
    this.bossApproachSound?.destroy();
    this.bossApproachSound = undefined;
    this.bossApproachLayer?.destroy(true);
    this.bossApproachLayer = undefined;
    this.roundAnnouncementLayer?.destroy(true);
    this.roundAnnouncementLayer = undefined;
    this.physics.world.off('worldbounds', this.handleWorldBounds, this);
    window.removeEventListener('keydown', this.boundEscKeyDown, true);
    this.game.canvas.removeEventListener('contextmenu', this.boundCanvasContextMenu);
    this.game.canvas.style.cursor = '';
  }

  create(): void {
    this.matchEnded = false;
    this.gameplayActive = false;
    this.escMenuOpen = false;
    this.waterCharges = 0;
    this.prevRightButtonDown = false;
    this.forceWaterFirstGiftForTest = true;
    this.fleetDir = 1;
    this.nextFire = 0;
    const t0 = this.time.now;
    this.nextEnemyShotAt = t0 + 1800;
    this.nextGiftAt = t0 + 5000;

    this.lives = STARTING_LIVES;
    this.bulletCount = START_BULLET_COUNT;
    this.moveSpeed = BASE_MOVE_SPEED;
    this.invulnerableUntil = 0;

    this.hud = this.add
      .text(this.scale.width / 2, 28, '', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '16px',
        color: '#8ae8ff',
      })
      .setOrigin(0.5);

    this.statsText = this.add
      .text(14, 14, '', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#b8e0f0',
      })
      .setOrigin(0, 0);

    this.hintText = this.add
      .text(this.scale.width / 2, this.scale.height - 20, '', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '13px',
        color: '#9ddcff',
      })
      .setOrigin(0.5, 1);

    this.updateStatsDisplay();
    this.statsText.setVisible(false);
    this.hintText.setVisible(false);

    this.createStarfield();

    this.player = this.physics.add.image(
      this.scale.width / 2,
      this.scale.height - PLAYER_SPAWN_OFFSET_FROM_BOTTOM,
      TEX.SHIP,
    );
    this.player.setCollideWorldBounds(true);
    this.player.setDisplaySize(SHIP_DISPLAY_WIDTH, SHIP_DISPLAY_HEIGHT);
    this.player.refreshBody();

    const pInit = this.input.activePointer;
    this.shipControlBaseX = this.player.x;
    this.shipControlBaseY = this.player.y;
    this.shipControlPointerAnchorX = pInit.x;
    this.shipControlPointerAnchorY = pInit.y;

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEX.BULLET,
      maxSize: 72,
      runChildUpdate: false,
    });

    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEX.ENEMY_BULLET,
      maxSize: 64,
      runChildUpdate: false,
    });

    this.gifts = this.physics.add.group({
      runChildUpdate: false,
    });

    this.enemies = this.physics.add.group();

    this.waveNumber = 1;
    this.stageNumber = 1;
    this.waveBreakInProgress = false;
    this.applyWaveDifficulty();
    this.createBossHealthBar();
    this.spawnCurrentWaveFormation();

    window.addEventListener('keydown', this.boundEscKeyDown, true);
    this.game.canvas.addEventListener('contextmenu', this.boundCanvasContextMenu);

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      (_bullet, _enemy) => {
        this.onBulletHitEnemy(_bullet as Phaser.Physics.Arcade.Image, _enemy as Phaser.Physics.Arcade.Image);
      },
    );

    this.physics.add.overlap(this.player, this.enemies, (_p, en) => {
      if (!this.gameplayActive || this.escMenuOpen) return;
      if (this.time.now < this.invulnerableUntil) return;
      const enemy = en as Phaser.Physics.Arcade.Image;
      if (!enemy.active) return;
      this.playerHit();
    });

    this.physics.add.overlap(this.player, this.enemyBullets, (_p, eb) => {
      if (!this.gameplayActive || this.escMenuOpen) return;
      const b = eb as Phaser.Physics.Arcade.Image;
      if (!b.active) return;
      if (b.getData('isJeansBomb')) return;
      this.playProjectileHitSound();
      if (this.time.now < this.invulnerableUntil) {
        this.enemyBullets.killAndHide(b);
        (b.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        return;
      }
      this.enemyBullets.killAndHide(b);
      (b.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.playerHit();
    });

    this.physics.add.overlap(this.player, this.gifts, (_p, g) => {
      if (!this.gameplayActive || this.escMenuOpen) return;
      const gift = g as Phaser.GameObjects.Container;
      if (!gift.active) return;
      const kind = gift.getData('kind') as GiftKind | undefined;
      if (!kind) return;
      this.removeGift(gift);
      this.applyGift(kind);
    });

    this.physics.add.overlap(this.bullets, this.enemyBullets, (pb, eb) => {
      const playerB = pb as Phaser.Physics.Arcade.Image;
      const enemyB = eb as Phaser.Physics.Arcade.Image;
      if (!playerB.active || !enemyB.active) return;
      this.bullets.killAndHide(playerB);
      this.enemyBullets.killAndHide(enemyB);
      (playerB.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      (enemyB.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    });

    this.physics.world.off('worldbounds', this.handleWorldBounds, this);
    this.physics.world.on('worldbounds', this.handleWorldBounds, this);

    this.createStartMenuLayer();
    this.createPauseMenuLayer();
    this.createGameOverLayer();

    this.updateGameplayHint();
    this.physics.pause();
  }

  private createStartMenuLayer(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const layer = this.add.container(0, 0);
    layer.setDepth(200);

    const dim = this.add
      .rectangle(w / 2, h / 2, w, h, 0x050810, 0.88)
      .setInteractive({ useHandCursor: false });
    const title = this.add
      .text(w / 2, h * 0.34, 'Suveranistan', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '32px',
        color: '#8ae8ff',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(w / 2, h * 0.52, 200, 52, 0x1e4a6e, 1)
      .setStrokeStyle(2, 0x6ecfff)
      .setInteractive({ useHandCursor: true });
    const btnLabel = this.add
      .text(w / 2, h * 0.52, 'Start', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '24px',
        color: '#f4fcff',
      })
      .setOrigin(0.5);
    const doStart = (): void => this.onPressStart();
    btn.on('pointerover', () => btn.setFillStyle(0x2a5f8f));
    btn.on('pointerout', () => btn.setFillStyle(0x1e4a6e));
    btn.on('pointerdown', doStart);
    btnLabel.setInteractive({ useHandCursor: true });
    btnLabel.on('pointerdown', doStart);

    const tip = this.add
      .text(w / 2, h * 0.66, 'Ține mouse-ul peste zona de joc pentru a controla nava.', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '14px',
        color: 'rgba(180, 220, 255, 0.85)',
      })
      .setOrigin(0.5);

    layer.add([dim, title, btn, btnLabel, tip]);
    this.startMenuLayer = layer;
  }

  private createPauseMenuLayer(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const layer = this.add.container(0, 0);
    layer.setDepth(201);
    layer.setVisible(false);

    const dim = this.add
      .rectangle(w / 2, h / 2, w, h, 0x02060c, 0.82)
      .setInteractive({ useHandCursor: false });
    const title = this.add
      .text(w / 2, h * 0.36, 'Pauză', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '28px',
        color: '#8ae8ff',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(w / 2, h * 0.52, 220, 52, 0x1e5a4a, 1)
      .setStrokeStyle(2, 0x7bed9f)
      .setInteractive({ useHandCursor: true });
    const btnLabel = this.add
      .text(w / 2, h * 0.52, 'Reia jocul', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '22px',
        color: '#f4fff8',
      })
      .setOrigin(0.5);
    const doResume = (): void => this.closePauseMenu();
    btn.on('pointerover', () => btn.setFillStyle(0x2a7a62));
    btn.on('pointerout', () => btn.setFillStyle(0x1e5a4a));
    btn.on('pointerdown', doResume);
    btnLabel.setInteractive({ useHandCursor: true });
    btnLabel.on('pointerdown', doResume);

    layer.add([dim, title, btn, btnLabel]);
    this.pauseMenuLayer = layer;
  }

  private createGameOverLayer(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const layer = this.add.container(0, 0);
    layer.setDepth(202);
    layer.setVisible(false);

    const dim = this.add
      .rectangle(w / 2, h / 2, w, h, 0x040810, 0.9)
      .setInteractive({ useHandCursor: false });
    const title = this.add
      .text(w / 2, h * 0.38, '', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '26px',
        color: '#8ae8ff',
        align: 'center',
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(w / 2, h * 0.56, 240, 52, 0x1e4a6e, 1)
      .setStrokeStyle(2, 0x6ecfff)
      .setInteractive({ useHandCursor: true });
    const btnLabel = this.add
      .text(w / 2, h * 0.56, 'Joacă din nou', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '22px',
        color: '#f4fcff',
      })
      .setOrigin(0.5);
    const doRestart = (): void => {
      this.scene.restart();
    };
    btn.on('pointerover', () => btn.setFillStyle(0x2a5f8f));
    btn.on('pointerout', () => btn.setFillStyle(0x1e4a6e));
    btn.on('pointerdown', doRestart);
    btnLabel.setInteractive({ useHandCursor: true });
    btnLabel.on('pointerdown', doRestart);

    layer.add([dim, title, btn, btnLabel]);
    layer.setData('titleText', title);
    this.gameOverLayer = layer;
  }

  private getBossMaxHpForStage(): number {
    const s = this.stageNumber;
    return (
      BOSS_BASE_HP +
      s * BOSS_HP_PER_STAGE +
      Math.floor(s * s * BOSS_HP_STAGE_SQR) +
      Math.floor(s * s * s * BOSS_HP_STAGE_CUBE)
    );
  }

  private createBossHealthBar(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 18;
    const barH = 22;
    const y = h - barH / 2 - 8;
    const barW = w - margin * 2;
    const innerW = barW - 6;
    this.bossBarInnerWidth = innerW;

    this.bossBarBg = this.add
      .rectangle(w / 2, y, barW, barH, 0x120808, 0.92)
      .setStrokeStyle(2, 0x5c1010)
      .setDepth(155)
      .setVisible(false);

    this.bossBarFill = this.add
      .rectangle(margin + 3, y, innerW, barH - 6, 0xc62828, 1)
      .setOrigin(0, 0.5)
      .setDepth(156)
      .setVisible(false);

    this.bossBarText = this.add
      .text(w / 2, y, '', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '13px',
        color: '#ffcdd2',
        stroke: '#300000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(157)
      .setVisible(false);
  }

  private hideBossHealthBar(): void {
    this.bossBarBg.setVisible(false);
    this.bossBarFill.setVisible(false);
    this.bossBarText.setVisible(false);
    if (this.hintText && this.gameplayActive && !this.matchEnded) {
      this.hintText.setY(this.scale.height - 20);
    }
  }

  private showBossHealthBar(maxHp: number, currentHp: number): void {
    this.bossBarBg.setVisible(true);
    this.bossBarFill.setVisible(true);
    this.bossBarText.setVisible(true);
    if (this.hintText) this.hintText.setY(this.scale.height - 46);
    this.updateBossHealthBarUI(currentHp, maxHp);
  }

  private updateBossHealthBarUI(currentHp: number, maxHp: number): void {
    if (!this.bossBarFill.visible) return;
    const pct = maxHp > 0 ? Phaser.Math.Clamp(Math.round((100 * currentHp) / maxHp), 0, 100) : 0;
    this.bossBarFill.width = this.bossBarInnerWidth * (pct / 100);
    this.bossBarText.setText(`BOSS · ${pct}%`);
  }

  private findActiveBoss(): Phaser.Physics.Arcade.Image | null {
    for (const c of this.enemies.getChildren()) {
      const e = c as Phaser.Physics.Arcade.Image;
      if (e.active && e.getData('isBoss')) return e;
    }
    return null;
  }

  private onPressStart(): void {
    if (this.gameplayActive || this.matchEnded) return;
    this.gameplayActive = true;
    this.statsText.setVisible(true);
    this.hintText.setVisible(true);
    const t0 = this.time.now;
    this.nextEnemyShotAt = t0 + 1800;
    this.nextGiftAt = t0 + 5000;
    this.physics.resume();
    this.startMenuLayer.setVisible(false);
    this.resetPlayerShipToSpawnAndReanchorPointer();
    this.refreshWaveBanner();
    this.updateGameplayHint();
  }

  private openPauseMenu(): void {
    if (this.waveBreakInProgress) return;
    if (!this.gameplayActive || this.matchEnded || this.escMenuOpen) return;
    this.escMenuOpen = true;
    this.pauseMenuLayer.setVisible(true);
    this.physics.pause();
    this.hideBossHealthBar();
    this.updateGameplayHint();
  }

  private closePauseMenu(): void {
    if (!this.escMenuOpen) return;
    this.escMenuOpen = false;
    this.pauseMenuLayer.setVisible(false);
    if (!this.matchEnded) {
      this.physics.resume();
      this.beginPostPauseShipFreezeDeadzone();
      if (this.waveNumber === BOSS_WAVE_NUMBER) {
        const boss = this.findActiveBoss();
        if (boss) {
          const cur = boss.getData('hp') as number;
          const maxHp = boss.getData('bossMaxHp') as number;
          if (typeof maxHp === 'number' && maxHp > 0) {
            this.showBossHealthBar(maxHp, Math.max(0, cur));
          }
        }
      }
    }
    this.updateGameplayHint();
  }

  /** După Reia: nava stă pe loc până muți mouse-ul (nu sare la poziția butonului). */
  private beginPostPauseShipFreezeDeadzone(): void {
    const p = this.input.activePointer;
    this.postPausePointerRefX = p.x;
    this.postPausePointerRefY = p.y;
    this.postPausePointerDeadzonePx = POST_PAUSE_POINTER_DEADZONE_PX;
  }

  /**
   * Rundă nouă: nava la spawn; control relativ + click stânga pentru aliniere, apoi 1:1 cu cursorul în canvas.
   */
  private resetPlayerShipToSpawnAndReanchorPointer(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const halfW = this.player.displayWidth * 0.5;
    const halfH = this.player.displayHeight * 0.5;
    const spawnX = Phaser.Math.Clamp(w / 2, halfW, w - halfW);
    const spawnY = Phaser.Math.Clamp(h - PLAYER_SPAWN_OFFSET_FROM_BOTTOM, halfH, h - halfH);
    this.player.setPosition(spawnX, spawnY);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    const p = this.input.activePointer;
    this.postPausePointerDeadzonePx = 0;
    this.shipAwaitingAlignClickAfterRound = true;
    this.shipControlBaseX = spawnX;
    this.shipControlBaseY = spawnY;
    this.shipControlPointerAnchorX = p.x;
    this.shipControlPointerAnchorY = p.y;
  }

  private updateGameplayHint(): void {
    if (this.matchEnded) {
      this.hintText.setText('');
      return;
    }
    if (!this.gameplayActive) {
      this.hintText.setText('');
      return;
    }
    if (this.escMenuOpen) {
      this.hintText.setText('');
      return;
    }
    this.hintText.setText(
      'Nava urmează cursorul în zona de joc · După rundă nouă: click stânga ca să aliniezi · Stânga: foc · Dreapta: jet apă · ESC: pauză',
    );
  }

  private handleWorldBounds(body: Phaser.Physics.Arcade.Body): void {
    const go = body.gameObject;
    if (this.gifts.contains(go as Phaser.GameObjects.GameObject)) {
      this.removeGift(go as Phaser.GameObjects.Container);
      body.stop();
      return;
    }
    const img = go as Phaser.Physics.Arcade.Image;
    const key = img.texture?.key;
    if (key === TEX.BULLET) {
      this.bullets.killAndHide(img);
      body.stop();
    } else if (key === TEX.ENEMY_BULLET || key === TEX.BLUGI) {
      this.enemyBullets.killAndHide(img);
      body.stop();
    }
  }

  private updateStatsDisplay(): void {
    const parts = [
      `Vieți: ${this.lives}`,
      `Viteză: ${Math.round(this.moveSpeed)}`,
      `Nivel Armă: ${this.bulletCount}`,
      `Jet apă: ${this.waterCharges}`,
    ];
    this.statsText.setText(parts.join('  ·  '));
  }

  private removeGift(gift: Phaser.GameObjects.Container): void {
    const b = gift.body as Phaser.Physics.Arcade.Body | null;
    b?.setVelocity(0, 0);
    this.gifts.remove(gift, true, true);
  }

  private applyGift(kind: GiftKind): void {
    if (kind === 'food') {
      this.lives += 1;
    } else if (kind === 'water') {
      this.waterCharges = Math.min(MAX_WATER_CHARGES, this.waterCharges + 1);
    } else if (kind === 'energy') {
      this.bulletCount = Math.min(MAX_BULLET_COUNT, this.bulletCount + 1);
    }
    this.updateStatsDisplay();
  }

  /** ~48% mâncare, ~48% energie, ~4% apă (mult mai rar). */
  private pickRandomGiftKind(): GiftKind {
    const r = Phaser.Math.FloatBetween(0, 1);
    if (r < 0.48) return 'food';
    if (r < 0.96) return 'energy';
    return 'water';
  }

  /** Pornește jetul de la navă. `false` dacă nu sunt inamici (nu consuma încărcare în apelant). */
  private launchWaterBombAttack(): boolean {
    const active = this.enemies
      .getChildren()
      .filter((e) => (e as Phaser.Physics.Arcade.Image).active) as Phaser.Physics.Arcade.Image[];
    if (active.length === 0) return false;

    let cx = 0;
    let cy = 0;
    for (const e of active) {
      cx += e.x;
      cy += e.y;
    }
    cx /= active.length;
    cy /= active.length;

    const startX = this.player.x;
    const startY = this.player.y - 26;
    const angle = Phaser.Math.Angle.Between(startX, startY, cx, cy);
    const dCenter = Phaser.Math.Distance.Between(startX, startY, cx, cy);
    const travel = Math.min(Math.max(dCenter * 0.92, 180), 540);
    const endX = startX + Math.cos(angle) * travel;
    const endY = startY + Math.sin(angle) * travel;

    const bomb = this.add.circle(startX, startY, 11, 0x2563eb, 0.92);
    bomb.setStrokeStyle(2, 0x93c5fd);
    bomb.setDepth(55);

    this.tweens.add({
      targets: bomb,
      x: endX,
      y: endY,
      duration: WATER_BOMB_DURATION_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.playWaterSplashVfx(endX, endY);
        this.instantKillEnemiesInWaterSplash(endX, endY);
        bomb.destroy();
      },
    });
    return true;
  }

  /** Explozie scurtă la distrugerea unui inamic (pui / boss). */
  private playEnemyDestroyedVfx(x: number, y: number, enemyScale: number, isBoss: boolean): void {
    const depth = 62;
    const dur = isBoss ? 400 : 240;

    const puff = this.add.image(x, y, TEX.CHICKEN);
    puff.setDepth(depth);
    puff.setScale(enemyScale);
    puff.clearTint();
    puff.setAlpha(0.92);
    this.tweens.add({
      targets: puff,
      scaleX: enemyScale * (isBoss ? 2.1 : 1.5),
      scaleY: enemyScale * (isBoss ? 2.1 : 1.5),
      alpha: 0,
      angle: puff.angle + Phaser.Math.Between(-120, 120),
      duration: dur,
      ease: 'Cubic.easeOut',
      onComplete: () => puff.destroy(),
    });

    const ring = this.add.circle(x, y, isBoss ? 36 : 16, 0xff9933, 0.5);
    ring.setDepth(depth - 1);
    ring.setStrokeStyle(2, 0xffeecc, 0.85);
    this.tweens.add({
      targets: ring,
      scaleX: isBoss ? 12 : 6.5,
      scaleY: isBoss ? 12 : 6.5,
      alpha: 0,
      duration: dur + 100,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    const n = isBoss ? 20 : 11;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Phaser.Math.FloatBetween(-0.15, 0.15);
      const dist = Phaser.Math.Between(isBoss ? 70 : 35, isBoss ? 150 : 85);
      const colors = [0xffcc66, 0xff7733, 0xffeeaa, 0xffffff, 0xffaa44];
      const c = this.add.circle(
        x + Math.cos(ang) * 10,
        y + Math.sin(ang) * 10,
        Phaser.Math.Between(3, 7),
        Phaser.Math.RND.pick(colors),
        0.88,
      );
      c.setDepth(depth);
      this.tweens.add({
        targets: c,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: dur + Phaser.Math.Between(-40, 60),
        ease: 'Cubic.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }

  private playWaterSplashVfx(x: number, y: number): void {
    const ring = this.add.circle(x, y, 22, 0x38bdf8, 0.45);
    ring.setDepth(54);
    ring.setStrokeStyle(2, 0xe0f2fe, 0.8);
    this.tweens.add({
      targets: ring,
      scaleX: 11,
      scaleY: 11,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Omoară din prima până la `WATER_SPLASH_MAX_KILLS` inamici în rază, cei mai aproape de epicentru. */
  private instantKillEnemiesInWaterSplash(explosionX: number, explosionY: number): void {
    if (this.matchEnded || !this.gameplayActive) return;

    const inRadius = this.enemies
      .getChildren()
      .filter((e) => (e as Phaser.Physics.Arcade.Image).active)
      .map((e) => e as Phaser.Physics.Arcade.Image)
      .map((e) => ({
        e,
        d: Phaser.Math.Distance.Between(explosionX, explosionY, e.x, e.y),
      }))
      .filter((x) => x.d <= WATER_SPLASH_RADIUS)
      .sort((a, b) => a.d - b.d)
      .slice(0, WATER_SPLASH_MAX_KILLS);

    for (const { e } of inRadius) {
      this.playEnemyDestroyedVfx(
        e.x,
        e.y,
        Math.max(0.65, e.displayWidth / 48),
        Boolean(e.getData('isBoss')),
      );
      this.enemies.remove(e, true, true);
    }

    if (this.enemies.countActive(true) === 0) {
      this.onAllWaveEnemiesDefeated();
    }
  }

  private playerHit(): void {
    if (this.matchEnded) return;
    this.lives -= 1;
    this.updateStatsDisplay();
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    this.invulnerableUntil = this.time.now + INVULN_MS;
    this.flashPlayerInvulnerable();
  }

  private flashPlayerInvulnerable(): void {
    this.playerBlink?.remove(false);
    let on = true;
    this.playerBlink = this.time.addEvent({
      delay: 110,
      repeat: Math.floor(INVULN_MS / 110),
      callback: () => {
        on = !on;
        this.player.setAlpha(on ? 1 : 0.35);
      },
      callbackScope: this,
    });
    this.time.delayedCall(INVULN_MS, () => {
      this.player.setAlpha(1);
      this.playerBlink?.remove(false);
      this.playerBlink = undefined;
    });
  }

  private createStarfield(): void {
    const g = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.12, 0.55));
      g.fillCircle(x, y, Phaser.Math.Between(1, 2));
    }
  }

  private getEnemyFleetBottom(): number {
    let maxY = 0;
    for (const e of this.enemies.getChildren()) {
      const im = e as Phaser.Physics.Arcade.Image;
      if (im.active) maxY = Math.max(maxY, im.y);
    }
    return maxY;
  }

  private isClearOfEnemies(x: number, y: number): boolean {
    for (const e of this.enemies.getChildren()) {
      const im = e as Phaser.Physics.Arcade.Image;
      if (!im.active) continue;
      if (Phaser.Math.Distance.Between(x, y, im.x, im.y) < CLEAR_RADIUS) return false;
    }
    return true;
  }

  private trySpawnGift(time: number): void {
    if (this.matchEnded || !this.gameplayActive || this.escMenuOpen) return;
    if (time < this.nextGiftAt) return;

    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 40;
    const fleetBottom = this.getEnemyFleetBottom();
    const minY = Math.min(fleetBottom + 55, h * 0.72);
    const maxY = h - 90;
    if (minY >= maxY) {
      this.nextGiftAt = time + 3000;
      return;
    }

    const kind: GiftKind = this.forceWaterFirstGiftForTest ? 'water' : this.pickRandomGiftKind();

    for (let attempt = 0; attempt < 18; attempt++) {
      const x = Phaser.Math.Between(margin, w - margin);
      const y = Phaser.Math.Between(minY, maxY);
      if (!this.isClearOfEnemies(x, y)) continue;

      this.spawnTextGift(x, y, kind);
      if (this.forceWaterFirstGiftForTest) {
        this.forceWaterFirstGiftForTest = false;
      }
      break;
    }

    this.nextGiftAt = time + Phaser.Math.Between(GIFT_SPAWN_MIN_INTERVAL, GIFT_SPAWN_MAX_INTERVAL);
  }

  /** Cadou doar cu text; poți înlocui mai târziu cu imagini în același container. */
  private spawnTextGift(x: number, y: number, kind: GiftKind): void {
    const container = this.add.container(x, y);
    const txt = this.add
      .text(0, 0, GIFT_LABELS[kind], {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '15px',
        color: '#f4fcff',
        backgroundColor: 'rgba(22, 36, 58, 0.94)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
    container.add(txt);
    container.setData('kind', kind);

    this.physics.add.existing(container, false);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setVelocity(0, GIFT_DRIFT_SPEED);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;
    const bw = txt.width + 6;
    const bh = txt.height + 4;
    body.setSize(bw, bh);
    body.setOffset(-bw / 2, -bh / 2);

    this.gifts.add(container);
  }

  private spawnEnemyGrid(): void {
    const cols = this.waveGridCols;
    const rows = this.waveGridRows;
    const gapX = this.scale.width / (cols + 2);
    const originX = gapX * 1.25;
    const originY = 88;
    const gapY = rows > 4 ? 50 : 56;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = originX + c * gapX;
        const y = originY + r * gapY;
        const rollTough =
          this.stageNumber >= TOUGH_ENEMY_FIRST_SECTOR &&
          Phaser.Math.FloatBetween(0, 1) < TOUGH_ENEMY_SPAWN_CHANCE;
        const hp = rollTough ? TOUGH_ENEMY_HP : this.waveChickenHp;
        const e = this.physics.add.image(x, y, TEX.CHICKEN);
        if (rollTough) {
          e.setScale(TOUGH_ENEMY_SCALE);
          e.setTint(TOUGH_ENEMY_TINT);
          e.setData('shootsJeans', true);
        } else {
          e.clearTint();
          e.setData('shootsJeans', false);
        }
        e.setData('hp', hp);
        e.setData('isBoss', false);
        const b = e.body as Phaser.Physics.Arcade.Body;
        b.setImmovable(true);
        b.setAllowGravity(false);
        e.refreshBody();
        this.enemies.add(e);
      }
    }
  }

  private onBulletHitEnemy(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!this.gameplayActive || this.escMenuOpen) return;
    if (!bullet.active || !enemy.active) return;

    this.bullets.killAndHide(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    let hp = enemy.getData('hp') as number;
    hp -= 1;
    enemy.setData('hp', hp);

    const isBoss = enemy.getData('isBoss') as boolean;
    const maxBossHp = enemy.getData('bossMaxHp') as number;
    if (isBoss && typeof maxBossHp === 'number' && maxBossHp > 0) {
      this.updateBossHealthBarUI(Math.max(0, hp), maxBossHp);
    }

    if (hp <= 0) {
      this.playEnemyDestroyedVfx(
        enemy.x,
        enemy.y,
        Math.max(0.65, enemy.displayWidth / 48),
        Boolean(isBoss),
      );
      this.enemies.remove(enemy, true, true);
    } else {
      enemy.setTint(0xffaa66);
    }

    if (this.enemies.countActive(true) === 0) {
      this.onAllWaveEnemiesDefeated();
    }
  }

  /**
   * Progresie valuri: `scene.restart()` = joc nou (val 1, sector 1, inventar reset).
   * Între valuri NU resetăm: vieți, `bulletCount`, `waterCharges` — doar curățăm proiectile/cadourile de pe ecran și respawnăm inamici.
   */
  private difficultyTier(): number {
    const s = this.stageNumber - 1;
    const w = this.waveNumber;
    if (w === BOSS_WAVE_NUMBER) return s * 6 + 7;
    return s * 6 + (w - 1);
  }

  private applyWaveDifficulty(): void {
    const tier = this.difficultyTier();
    this.fleetSpeed = 50 + tier * 4;
    this.enemyProjectileSpeed = 118 + tier * 11;
    this.waveChickenHp = CHICKEN_HP + Math.min(5, Math.floor(tier / 3));
    this.waveGridRows = Math.min(3 + Math.floor(tier / 3), 6);
    this.waveGridCols = 8;
    this.enemyShotMinMs = Math.max(280, 700 - tier * 48);
    this.enemyShotMaxMs = Math.max(this.enemyShotMinMs + 140, 1680 - tier * 75);
  }

  private clearWaveBattleEntities(): void {
    this.bullets.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.gifts.clear(true, true);
    this.enemies.clear(true, true);
  }

  private refreshWaveBanner(): void {
    if (!this.gameplayActive || this.matchEnded) return;
    if (this.waveNumber === BOSS_WAVE_NUMBER) {
      this.hud.setText(`BOSS · sector ${this.stageNumber}`);
    } else {
      this.hud.setText(`Val ${this.waveNumber}/${NORMAL_WAVE_COUNT} · sector ${this.stageNumber}`);
    }
  }

  private armWaveTimers(t: number): void {
    this.nextEnemyShotAt = t + Phaser.Math.Between(500, 1100);
    this.nextGiftAt = t + Phaser.Math.Between(3500, 6500);
  }

  private onAllWaveEnemiesDefeated(): void {
    if (this.matchEnded || !this.gameplayActive || this.waveBreakInProgress) return;
    this.waveBreakInProgress = true;
    this.hideBossHealthBar();

    const beatBoss = this.waveNumber === BOSS_WAVE_NUMBER;
    if (beatBoss) {
      this.stageNumber += 1;
      this.waveNumber = 1;
      this.hud.setText(`Boss învins! Sector ${this.stageNumber}`);
    } else {
      this.waveNumber += 1;
      if (this.waveNumber === BOSS_WAVE_NUMBER) {
        this.hud.setText('Vine BOSS-ul!');
      } else {
        this.hud.setText(`Val ${this.waveNumber}/${NORMAL_WAVE_COUNT}…`);
      }
    }

    this.clearWaveBattleEntities();
    this.applyWaveDifficulty();

    this.physics.pause();

    const finishWaveBreak = (): void => {
      this.waveBreakInProgress = false;
      if (this.matchEnded || !this.gameplayActive) return;
      this.spawnCurrentWaveFormation();
      this.armWaveTimers(this.time.now);
      this.physics.resume();
      this.resetPlayerShipToSpawnAndReanchorPointer();
      this.refreshWaveBanner();
    };

    if (beatBoss) {
      this.playSectorEndAfterBossThen(finishWaveBreak);
    } else if (this.waveNumber === BOSS_WAVE_NUMBER) {
      this.playBossApproachAlertThen(finishWaveBreak);
    } else {
      this.playRoundAnnouncementThen(finishWaveBreak);
    }
  }

  /** După învins bossul: sectorend 7 s (fără card „Runda”), apoi val 1 noul sector. */
  private playSectorEndAfterBossThen(done: () => void): void {
    this.roundAnnouncementLayer?.destroy(true);
    this.roundAnnouncementLayer = undefined;

    this.sectorEndAfterBossSound?.stop();
    this.sectorEndAfterBossSound?.destroy();

    if (this.cache.audio.exists(SFX.SECTOR_END)) {
      this.sectorEndAfterBossSound = this.sound.add(SFX.SECTOR_END, { volume: 0.9 });
      this.sectorEndAfterBossSound.play({ loop: false });
    }

    this.time.delayedCall(SECTOR_END_AFTER_BOSS_MS, () => {
      if (!this.sys.isActive()) return;
      if (this.sectorEndAfterBossSound) {
        this.sectorEndAfterBossSound.stop();
        this.sectorEndAfterBossSound.destroy();
        this.sectorEndAfterBossSound = undefined;
      }
      done();
    });
  }

  /** 6 s: roalert în buclă + mesaj; apoi spawn boss (fără cardul „Runda …”). */
  private playBossApproachAlertThen(done: () => void): void {
    this.roundAnnouncementLayer?.destroy(true);
    this.roundAnnouncementLayer = undefined;
    this.bossApproachLayer?.destroy(true);
    this.bossApproachSound?.stop();
    this.bossApproachSound?.destroy();
    this.bossApproachSound = undefined;

    const w = this.scale.width;
    const h = this.scale.height;
    const layer = this.add.container(0, 0);
    layer.setDepth(179);
    this.bossApproachLayer = layer;

    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x1a0512, 0.85);
    dim.setInteractive({ useHandCursor: false });
    const msg = this.add
      .text(w / 2, h * 0.48, 'Se apropie dujmanu', {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '36px',
        color: '#ff8a8a',
        stroke: '#240008',
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    layer.add([dim, msg]);

    if (this.cache.audio.exists(SFX.BOSS_ALERT)) {
      this.bossApproachSound = this.sound.add(SFX.BOSS_ALERT, { volume: 0.92 });
      this.bossApproachSound.play({ loop: true });
    }

    this.time.delayedCall(BOSS_APPROACH_DURATION_MS, () => {
      if (!this.sys.isActive()) return;
      if (this.bossApproachSound) {
        this.bossApproachSound.stop();
        this.bossApproachSound.destroy();
        this.bossApproachSound = undefined;
      }
      if (this.bossApproachLayer) {
        this.bossApproachLayer.destroy(true);
        this.bossApproachLayer = undefined;
      }
      done();
    });
  }

  private getRoundAnnouncementCopy(): { main: string; sub: string } {
    if (this.waveNumber === BOSS_WAVE_NUMBER) {
      return { main: 'BOSS', sub: `Sector ${this.stageNumber}` };
    }
    return {
      main: `Runda ${this.waveNumber}`,
      sub: `Sector ${this.stageNumber}  ·  Val ${this.waveNumber} din ${NORMAL_WAVE_COUNT}`,
    };
  }

  /**
   * Ecran semi-transparent + titlu; fade in → pauză → fade out, apoi callback (spawn val).
   * Durata totală = fade in + hold + fade out (vezi constantele ROUND_CARD_*).
   */
  private playRoundAnnouncementThen(done: () => void): void {
    this.roundAnnouncementLayer?.destroy(true);
    this.roundAnnouncementLayer = undefined;

    const w = this.scale.width;
    const h = this.scale.height;
    const layer = this.add.container(0, 0);
    layer.setDepth(179);
    this.roundAnnouncementLayer = layer;

    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x030810, 0);
    dim.setInteractive({ useHandCursor: false });

    const { main, sub } = this.getRoundAnnouncementCopy();

    const title = this.add
      .text(w / 2, h * 0.44, main, {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '44px',
        color: '#e8f6ff',
        stroke: '#020810',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    title.setAlpha(0);
    title.setScale(0.86);

    const subtitle = this.add
      .text(w / 2, h * 0.52, sub, {
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '18px',
        color: 'rgba(150, 205, 255, 0.95)',
      })
      .setOrigin(0.5);
    subtitle.setAlpha(0);

    layer.add([dim, title, subtitle]);

    const fi = ROUND_CARD_FADE_IN_MS;
    const hold = ROUND_CARD_HOLD_MS;
    const fo = ROUND_CARD_FADE_OUT_MS;

    this.tweens.add({
      targets: dim,
      alpha: 0.82,
      duration: fi,
      ease: 'Cubic.easeOut',
    });

    this.tweens.add({
      targets: title,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: fi,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: fi,
      delay: 70,
      ease: 'Quad.easeOut',
    });

    this.time.delayedCall(fi + hold, () => {
      if (!this.sys.isActive()) return;
      if (!this.roundAnnouncementLayer || !layer.active) {
        done();
        return;
      }
      this.tweens.add({
        targets: [dim, title, subtitle],
        alpha: 0,
        duration: fo,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (!this.sys.isActive()) return;
          layer.destroy(true);
          if (this.roundAnnouncementLayer === layer) this.roundAnnouncementLayer = undefined;
          done();
        },
      });
    });
  }

  private spawnCurrentWaveFormation(): void {
    if (this.waveNumber === BOSS_WAVE_NUMBER) {
      this.spawnBoss();
    } else {
      this.hideBossHealthBar();
      this.spawnEnemyGrid();
    }
  }

  private spawnBoss(): void {
    const w = this.scale.width;
    const firstBoss = this.stageNumber === 1;
    const useNicusor = firstBoss && this.textures.exists(TEX.NICUSOR);
    const tex = useNicusor ? TEX.NICUSOR : TEX.CHICKEN;

    const e = this.physics.add.image(w / 2, 130, tex);
    e.clearTint();

    if (useNicusor) {
      this.applyTextureFitBox(e, NICUSOR_BOSS_MAX_DISPLAY_W, NICUSOR_BOSS_MAX_DISPLAY_H, true);
    } else {
      e.setScale(2.55 + Math.min(0.95, this.stageNumber * 0.11));
      e.refreshBody();
    }

    const hp = this.getBossMaxHpForStage();
    e.setData('hp', hp);
    e.setData('bossMaxHp', hp);
    e.setData('isBoss', true);

    const b = e.body as Phaser.Physics.Arcade.Body;
    b.setImmovable(true);
    b.setAllowGravity(false);

    this.enemies.add(e);
    if (this.gameplayActive) {
      this.showBossHealthBar(hp, hp);
    }
  }

  private gameOver(): void {
    if (this.matchEnded) return;
    if (this.cache.audio.exists(SFX.DEAD)) {
      this.sound.play(SFX.DEAD, { volume: 0.9 });
    }
    this.hideBossHealthBar();
    this.matchEnded = true;
    this.playerBlink?.remove(false);
    this.player.setAlpha(1);
    this.escMenuOpen = false;
    this.pauseMenuLayer.setVisible(false);
    this.hintText.setText('');
    this.physics.pause();
    this.hud.setText('');
    this.hud.setStyle({ color: '#8ae8ff' });

    const title = this.gameOverLayer.getData('titleText') as Phaser.GameObjects.Text;
    title.setText('Ai rămas fără vieți');
    title.setStyle({ color: '#ff7675' });
    this.gameOverLayer.setVisible(true);
  }

  private spawnOneBullet(fromX: number, fromY: number): boolean {
    const b = this.bullets.get(fromX, fromY, TEX.BULLET) as Phaser.Physics.Arcade.Image | null;
    if (!b) return false;
    b.setActive(true).setVisible(true).clearTint();
    b.setPosition(fromX, fromY);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(b.x, b.y);
    body.setVelocity(0, -520);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;
    return true;
  }

  private fireBullet(time: number): void {
    if (time < this.nextFire) return;

    const y = this.player.y - 28;
    const n = this.bulletCount;
    const spacing = n <= 1 ? 0 : 15;
    let any = false;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spacing;
      if (this.spawnOneBullet(this.player.x + off, y)) any = true;
    }
    if (!any) return;

    this.nextFire = time + this.fireDelay;
  }

  private tryEnemyShot(time: number): void {
    if (this.matchEnded || !this.gameplayActive || this.escMenuOpen) return;
    if (time < this.nextEnemyShotAt) return;

    const active = this.enemies
      .getChildren()
      .filter((e) => (e as Phaser.Physics.Arcade.Image).active) as Phaser.Physics.Arcade.Image[];
    if (active.length === 0) return;

    const enemy = Phaser.Utils.Array.GetRandom(active);
    this.fireEnemyBulletFrom(enemy);
    this.nextEnemyShotAt = time + Phaser.Math.Between(this.enemyShotMinMs, this.enemyShotMaxMs);
  }

  private applyTextureFitBox(
    img: Phaser.Physics.Arcade.Image,
    maxW: number,
    maxH: number,
    refreshPhysicsBody: boolean,
  ): void {
    const nw = img.frame.width;
    const nh = img.frame.height;
    if (nw < 1 || nh < 1) return;
    const s = Math.min(maxW / nw, maxH / nh);
    const dw = Math.max(1, Math.round(nw * s));
    const dh = Math.max(1, Math.round(nh * s));
    img.setDisplaySize(dw, dh);
    if (refreshPhysicsBody) img.refreshBody();
  }

  /** Aceeași cutie ca bananele: blugi ca proiectil au aceeași scară vizuală. */
  private applyEnemyBulletDisplaySizePreservingAspect(b: Phaser.Physics.Arcade.Image): void {
    this.applyTextureFitBox(b, ENEMY_BULLET_MAX_DISPLAY_W, ENEMY_BULLET_MAX_DISPLAY_H, true);
  }

  private playJeansExplosionVfx(cx: number, cy: number, radius: number): void {
    const depth = 58;
    const baseR = Math.max(10, radius * 0.22);
    const ring = this.add.circle(cx, cy, baseR, 0x3d6ea8, 0.48);
    ring.setDepth(depth);
    ring.setStrokeStyle(3, 0xb8d4f8, 0.92);
    const scaleTo = radius / baseR;
    this.tweens.add({
      targets: ring,
      scaleX: scaleTo,
      scaleY: scaleTo,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    const ring2 = this.add.circle(cx, cy, baseR * 0.55, 0x1e3a5f, 0.35);
    ring2.setDepth(depth - 1);
    ring2.setStrokeStyle(2, 0x6b9bd4, 0.7);
    this.tweens.add({
      targets: ring2,
      scaleX: scaleTo * 1.15,
      scaleY: scaleTo * 1.15,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => ring2.destroy(),
    });

    const n = 14;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Phaser.Math.FloatBetween(-0.12, 0.12);
      const d = Phaser.Math.Between(Math.floor(radius * 0.35), Math.floor(radius * 0.95));
      const c = this.add.circle(cx, cy, Phaser.Math.Between(2, 5), Phaser.Math.RND.pick([0x4a6fa5, 0x2e4a72, 0x8fb8e8]), 0.85);
      c.setDepth(depth);
      this.tweens.add({
        targets: c,
        x: cx + Math.cos(ang) * d,
        y: cy + Math.sin(ang) * d,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 280,
        ease: 'Cubic.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }

  private triggerJeansBombExplosion(cx: number, cy: number, radius: number): void {
    if (this.matchEnded || !this.gameplayActive) return;
    this.playJeansExplosionVfx(cx, cy, radius);
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);
    if (d <= radius) {
      this.playProjectileHitSound();
      if (this.time.now >= this.invulnerableUntil) {
        this.playerHit();
      }
    }
  }

  private playProjectileHitSound(): void {
    if (this.cache.audio.exists(SFX.HIT)) {
      this.sound.play(SFX.HIT, { volume: 0.85 });
    }
  }

  private updateJeansBombs(): void {
    if (this.matchEnded || !this.gameplayActive || this.escMenuOpen || this.waveBreakInProgress) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const triggerY = h - JEANS_EXPLODE_BOTTOM_MARGIN;
    for (const c of this.enemyBullets.getChildren()) {
      const b = c as Phaser.Physics.Arcade.Image;
      if (!b.active || !b.getData('isJeansBomb')) continue;
      const body = b.body as Phaser.Physics.Arcade.Body;
      if (b.y >= triggerY) {
        const r = b.getData('explodeRadius') as number;
        const rad = typeof r === 'number' && r > 0 ? r : JEANS_EXPLOSION_RADIUS_FACTOR * 40;
        this.triggerJeansBombExplosion(b.x, b.y, rad);
        this.enemyBullets.killAndHide(b);
        body.setVelocity(0, 0);
        continue;
      }
      if (b.x < -70 || b.x > w + 70 || b.y > h + 50) {
        this.enemyBullets.killAndHide(b);
        body.setVelocity(0, 0);
      }
    }
  }

  private fireEnemyBulletFrom(enemy: Phaser.Physics.Arcade.Image): void {
    const isBoss = Boolean(enemy.getData('isBoss'));
    const shootsJeans = !isBoss && Boolean(enemy.getData('shootsJeans'));
    const bulletKey = shootsJeans ? TEX.BLUGI : TEX.ENEMY_BULLET;
    const offY = isBoss ? enemy.displayHeight * 0.42 : 26;
    const b = this.enemyBullets.get(enemy.x, enemy.y + offY, bulletKey) as Phaser.Physics.Arcade.Image | null;
    if (!b) return;

    b.setActive(true).setVisible(true).clearTint();
    b.setPosition(enemy.x, enemy.y + offY);
    this.applyEnemyBulletDisplaySizePreservingAspect(b);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(b.x, b.y);

    if (shootsJeans) {
      b.setData('isJeansBomb', true);
      b.setData(
        'explodeRadius',
        JEANS_EXPLOSION_RADIUS_FACTOR * Math.max(b.displayWidth, b.displayHeight),
      );
      body.setCollideWorldBounds(false);
      body.onWorldBounds = false;
    } else {
      b.setData('isJeansBomb', false);
      body.setCollideWorldBounds(true);
      body.onWorldBounds = true;
    }

    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.enemyProjectileSpeed;
    const vx = (dx / len) * sp;
    const vy = (dy / len) * sp;
    body.setVelocity(vx, vy);
    b.setRotation(Math.atan2(vy, vx));
  }

  private updateFleetMovement(): void {
    if (!this.gameplayActive || this.escMenuOpen || this.matchEnded) return;
    const list = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    const active = list.filter((e) => e.active);
    if (active.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    for (const e of active) {
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }

    const pad = 36;
    const w = this.scale.width;
    if (this.fleetDir > 0 && maxX > w - pad) {
      this.fleetDir = -1;
    } else if (this.fleetDir < 0 && minX < pad) {
      this.fleetDir = 1;
    }

    const vx = this.fleetDir * this.fleetSpeed;
    for (const e of active) {
      (e.body as Phaser.Physics.Arcade.Body).setVelocityX(vx);
    }
  }

  update(time: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    const canPlay =
      this.gameplayActive && !this.escMenuOpen && !this.matchEnded && !this.waveBreakInProgress;
    /** Ascunde cursorul deasupra canvasului în rundă. Fără pointer lock, mouse-ul nu e închis în canvas — doar invizibil deasupra lui. */
    this.game.canvas.style.cursor = canPlay ? 'none' : '';

    if (canPlay) {
      const p = this.input.activePointer;
      const w = this.scale.width;
      const h = this.scale.height;
      const halfW = this.player.displayWidth * 0.5;
      const halfH = this.player.displayHeight * 0.5;

      const pointerInCanvas = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;

      let postPauseFrozen = false;
      if (this.postPausePointerDeadzonePx > 0) {
        const d = Phaser.Math.Distance.Between(
          p.x,
          p.y,
          this.postPausePointerRefX,
          this.postPausePointerRefY,
        );
        if (d >= this.postPausePointerDeadzonePx) {
          this.postPausePointerDeadzonePx = 0;
        } else {
          postPauseFrozen = true;
        }
      }

      const leftDown = p.leftButtonDown();
      if (this.shipAwaitingAlignClickAfterRound && pointerInCanvas && leftDown && !this.prevLeftButtonDown) {
        this.shipAwaitingAlignClickAfterRound = false;
      }

      const canMoveShip = pointerInCanvas && !postPauseFrozen;
      const weaponsAllowed = canMoveShip && !this.shipAwaitingAlignClickAfterRound;

      if (canMoveShip) {
        if (this.shipAwaitingAlignClickAfterRound) {
          const rawX = this.shipControlBaseX + (p.x - this.shipControlPointerAnchorX);
          const rawY = this.shipControlBaseY + (p.y - this.shipControlPointerAnchorY);
          const px = Phaser.Math.Clamp(rawX, halfW, w - halfW);
          const py = Phaser.Math.Clamp(rawY, halfH, h - halfH);
          this.player.setPosition(px, py);
        } else {
          const px = Phaser.Math.Clamp(p.x, halfW, w - halfW);
          const py = Phaser.Math.Clamp(p.y, halfH, h - halfH);
          this.player.setPosition(px, py);
        }
      }

      const rightDown = p.rightButtonDown();
      if (weaponsAllowed && rightDown && !this.prevRightButtonDown) {
        if (this.waterCharges > 0 && this.launchWaterBombAttack()) {
          this.waterCharges -= 1;
          this.updateStatsDisplay();
        }
      }
      this.prevRightButtonDown = rightDown;

      if (leftDown && weaponsAllowed) {
        this.fireBullet(time);
      }
      this.prevLeftButtonDown = leftDown;
    } else {
      this.prevRightButtonDown = false;
      this.prevLeftButtonDown = false;
    }

    this.updateFleetMovement();
    this.updateJeansBombs();
    this.tryEnemyShot(time);
    this.trySpawnGift(time);
  }
}