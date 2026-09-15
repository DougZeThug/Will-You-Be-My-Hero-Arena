import * as Phaser from 'phaser';
import { ArenaSession } from './ArenaSession';
import type { LiveOptions } from './LiveTypes';
import { LiveBootScene, LiveArenaScene } from '../scenes/LiveArenaScene';
import { KeyboardDevice } from '../input/KeyboardDevice';
import { GamepadDevice } from '../input/GamepadDevice';
import { AudioManager } from '../audio/AudioManager';
import { spineBackend } from '../characters/SpineCharacterRig';
export class LiveArenaGame {
  readonly session: ArenaSession;
  readonly game: Phaser.Game;
  private audio = new AudioManager();
  private cleanup: () => void;
  constructor(parent: HTMLElement, options: LiveOptions) {
    this.session = new ArenaSession(options.config);
    parent.tabIndex = 0;
    parent.setAttribute(
      'aria-label',
      'Playable arena. Focus here for keyboard controls.',
    );
    options.config.players.forEach((p) => {
      if (p.device === 'keyboard' || p.device === 'keyboard2')
        this.session.assign(
          p.id,
          new KeyboardDevice(
            p.device,
            p.bindings,
            p.device === 'keyboard2' ? 1 : 0,
            parent,
          ),
        );
      if (p.device.startsWith('gamepad:'))
        this.session.assign(
          p.id,
          new GamepadDevice(Number(p.device.split(':')[1]), p.bindings),
        );
    });
    const audioOff = this.session.onCue((cue) => this.audio.cue(cue));
    this.audio.setEnabled(options.sound);
    const blur = () =>
        this.session.pause(true, 'Paused while the window was inactive.'),
      visibility = () => {
        if (document.hidden) blur();
      };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    this.cleanup = () => {
      audioOff();
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
    const spine = spineBackend();
    this.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: 1280,
      height: 720,
      backgroundColor: '#121913',
      antialias: true,
      audio: { noAudio: true },
      render: { antialias: true },
      fps: { target: 60 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      plugins: spine ? { scene: [spine.scenePlugin] } : undefined,
      scene: [
        new LiveBootScene(this.session, options),
        new LiveArenaScene(this.session, {
          ...options,
          onReady: () => {
            parent.focus({ preventScroll: true });
            options.onReady();
          },
        }),
      ],
    });
  }
  sound(enabled: boolean) {
    this.audio.setEnabled(enabled);
  }
  destroy() {
    this.cleanup();
    this.game.destroy(true);
    this.session.destroy();
    this.audio.destroy();
  }
}
