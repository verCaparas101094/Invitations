import { AfterViewInit, Component, ElementRef, OnDestroy, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

type IntroPhase = 'playing' | 'white' | 'reveal' | 'done';
type CountdownValue = { days: string; hours: string; minutes: string; seconds: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  musicOn = false;
  submitted = false;
  readonly introStarted = signal(false);
  readonly introPhase = signal<IntroPhase>('playing');
  readonly countdown = signal<CountdownValue>({ days: '00', hours: '00', minutes: '00', seconds: '00' });
  private observer?: IntersectionObserver;
  private sections: HTMLElement[] = [];
  private sectionAnimationsStarted = false;
  private readonly introTimers: Array<ReturnType<typeof setTimeout>> = [];
  private backgroundMusic?: HTMLAudioElement;
  private countdownTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.sections = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.animate-section')
    );

    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);

  }

  private updateCountdown(): void {
    const target = new Date('2027-02-14T10:00:00+08:00').getTime();
    const remaining = Math.max(0, target - Date.now());
    const day = 86_400_000;
    const hour = 3_600_000;
    const minute = 60_000;

    this.countdown.set({
      days: String(Math.floor(remaining / day)).padStart(2, '0'),
      hours: String(Math.floor((remaining % day) / hour)).padStart(2, '0'),
      minutes: String(Math.floor((remaining % hour) / minute)).padStart(2, '0'),
      seconds: String(Math.floor((remaining % minute) / 1000)).padStart(2, '0')
    });
  }

  playIntro(): void {
    if (this.introStarted()) {
      return;
    }

    this.introStarted.set(true);
    this.prepareBackgroundMusic();
    this.introTimers.push(setTimeout(() => this.finishIntro(), 2250));
  }

  finishIntro(): void {
    if (this.introPhase() !== 'playing') {
      return;
    }

    this.introPhase.set('white');
    this.introTimers.push(
      setTimeout(() => {
        this.introPhase.set('reveal');
        this.startMusicAfterOpening();
        this.startSectionAnimations();
      }, 650),
      setTimeout(() => {
        this.introPhase.set('done');
      }, 1550)
    );
  }

  skipIntro(): void {
    if (this.introPhase() === 'done') {
      return;
    }

    this.introPhase.set('reveal');
    if (this.introStarted()) {
      this.startMusicAfterOpening();
    }
    this.startSectionAnimations();
    this.introTimers.push(setTimeout(() => this.introPhase.set('done'), 700));
  }

  private startSectionAnimations(): void {
    if (this.sectionAnimationsStarted) {
      return;
    }

    this.sectionAnimationsStarted = true;

    if (!('IntersectionObserver' in window)) {
      this.sections.forEach((section) => section.classList.add('is-visible'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    this.sections.forEach((section) => this.observer?.observe(section));
  }

  toggleMusic(): void {
    this.musicOn = !this.musicOn;

    if (this.musicOn) {
      this.playBackgroundMusic();
    } else {
      this.backgroundMusic?.pause();
    }
  }

  private prepareBackgroundMusic(): void {
    if (!this.backgroundMusic) {
      this.backgroundMusic = new Audio('assets/bgmusic.mp3');
      this.backgroundMusic.loop = true;
      this.backgroundMusic.preload = 'auto';
      this.backgroundMusic.volume = 0.55;
    }

    this.backgroundMusic.muted = true;
    void this.backgroundMusic.play().catch(() => undefined);
  }

  private startMusicAfterOpening(): void {
    if (this.musicOn) {
      return;
    }

    this.musicOn = true;
    this.playBackgroundMusic(true);
  }

  private playBackgroundMusic(restart = false): void {
    if (!this.backgroundMusic) {
      this.prepareBackgroundMusic();
    }

    const audio = this.backgroundMusic;
    if (!audio) {
      this.musicOn = false;
      return;
    }

    if (restart) {
      audio.currentTime = 0;
    }
    audio.muted = false;
    void audio.play().catch(() => {
      this.musicOn = false;
    });
  }

  submitRsvp(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.submitted = true;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.introTimers.forEach((timer) => clearTimeout(timer));
    this.backgroundMusic?.pause();
    this.backgroundMusic = undefined;
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }
}
