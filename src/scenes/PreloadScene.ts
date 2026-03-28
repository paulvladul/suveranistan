import Phaser from 'phaser';

export const TEX = {
  SHIP: 'tex_ship',
  CHICKEN: 'tex_chicken',
  BULLET: 'tex_bullet',
  ENEMY_BULLET: 'tex_enemy_bullet',
  /** Doar proiectil (inamicii tari trag blugi; sprite-ul lor rămâne puiul). */
  BLUGI: 'tex_blugi',
  /** Primul boss (sector 1). */
  NICUSOR: 'tex_nicusor',
} as const;

export const SFX = {
  DEAD: 'sfx_dead',
  HIT: 'sfx_hit',
  BOSS_ALERT: 'sfx_roalert',
  SECTOR_END: 'sfx_sectorend',
} as const;

export type GiftKind = 'food' | 'water' | 'energy';

export const GIFT_LABELS: Record<GiftKind, string> = {
  food: 'Hrana',
  water: 'Apă (+1 jet)',
  energy: 'Energie',
};

/**
 * Nava: `images/ship.png`. Banană / blugi / primul boss: `banana`, `blugi`, `nicusor`.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.load.image(TEX.SHIP, 'images/ship.png');
    this.load.image(TEX.ENEMY_BULLET, 'images/banana.png');
    this.load.image(TEX.BLUGI, 'images/blugi.png');
    this.load.image(TEX.NICUSOR, 'images/nicusor.png');
    this.load.audio(SFX.DEAD, 'audio/dead.mp3');
    this.load.audio(SFX.HIT, 'audio/hit.mp3');
    this.load.audio(SFX.BOSS_ALERT, 'audio/roalert.mp3');
    this.load.audio(SFX.SECTOR_END, 'audio/sectorend.mp3');
  }

  create(): void {
    if (!this.textures.exists(TEX.SHIP)) {
      this.makeShipTexture();
    }
    this.makeChickenTexture();
    this.makeBulletTexture();
    if (!this.textures.exists(TEX.ENEMY_BULLET)) {
      this.makeBananaProjectileTexture();
    }
    this.scene.start('MainScene');
  }

  private makeShipTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x4ade80, 1);
    g.fillTriangle(16, 4, 4, 30, 28, 30);
    g.generateTexture(TEX.SHIP, 32, 34);
    g.destroy();
  }

  private makeChickenTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xfff59a, 1);
    g.fillEllipse(22, 22, 36, 32);
    g.fillStyle(0xff6b6b, 1);
    g.fillTriangle(36, 18, 44, 22, 36, 28);
    g.fillStyle(0x333333, 1);
    g.fillCircle(14, 20, 4);
    g.fillCircle(26, 20, 4);
    g.generateTexture(TEX.CHICKEN, 48, 44);
    g.destroy();
  }

  private makeBulletTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffeb3b, 1);
    g.fillRoundedRect(0, 0, 8, 18, 3);
    g.generateTexture(TEX.BULLET, 8, 18);
    g.destroy();
  }

  /** Fallback dacă `images/banana.png` lipsește — aceeași orientare (spre dreapta) ca în MainScene. */
  private makeBananaProjectileTexture(): void {
    const w = 72;
    const h = 22;
    const g = this.add.graphics();

    const p0 = { x: 5, y: 11 };
    const p1 = { x: 34, y: 2 };
    const p2 = { x: 66, y: 10 };

    const bezier = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      };
    };
    const tangent = (t: number) => {
      const u = 1 - t;
      const tx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      const ty = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      const len = Math.hypot(tx, ty) || 1;
      return { x: tx / len, y: ty / len };
    };

    const steps = 28;
    const thick = 4.2;
    const upper: { x: number; y: number }[] = [];
    const lower: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = bezier(t);
      const tn = tangent(t);
      const nx = -tn.y;
      const ny = tn.x;
      upper.push({ x: c.x + nx * thick, y: c.y + ny * thick });
      lower.push({ x: c.x - nx * thick, y: c.y - ny * thick });
    }

    const outline = [...upper, ...lower.slice().reverse()];

    g.fillStyle(0xe8c040, 1);
    g.beginPath();
    g.moveTo(outline[0].x, outline[0].y);
    for (let k = 1; k < outline.length; k++) {
      g.lineTo(outline[k].x, outline[k].y);
    }
    g.closePath();
    g.fillPath();

    g.lineStyle(2, 0xc9a020, 0.85);
    g.beginPath();
    g.moveTo(upper[0].x, upper[0].y);
    for (let k = 1; k < upper.length; k++) {
      g.lineTo(upper[k].x, upper[k].y);
    }
    g.strokePath();

    g.fillStyle(0xfff3c0, 0.55);
    const hi = bezier(0.38);
    const htn = tangent(0.38);
    const hnx = -htn.y;
    const hny = htn.x;
    g.fillEllipse(hi.x + hnx * 1.2, hi.y + hny * 1.2, 14, 4);

    g.fillStyle(0x4a3525, 1);
    g.fillEllipse(p0.x - 0.5, p0.y, 5, 5.5);

    g.fillStyle(0x3d2818, 1);
    g.fillEllipse(p2.x + 1, p2.y, 3.5, 3.5);

    g.generateTexture(TEX.ENEMY_BULLET, w, h);
    g.destroy();
  }
}
