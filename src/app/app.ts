import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
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
  @ViewChild('introVideo') private introVideo?: ElementRef<HTMLVideoElement>;

  musicOn = false;
  submitted = false;
  readonly introStarted = signal(false);
  readonly introPhase = signal<IntroPhase>('playing');
  readonly countdown = signal<CountdownValue>({ days: '00', hours: '00', minutes: '00', seconds: '00' });
  private observer?: IntersectionObserver;
  private sections: HTMLElement[] = [];
  private sectionAnimationsStarted = false;
  private readonly introTimers: Array<ReturnType<typeof setTimeout>> = [];
  private audioContext?: AudioContext;
  private musicTimer?: ReturnType<typeof setInterval>;
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
    const video = this.introVideo?.nativeElement;
    if (!video || this.introStarted()) {
      return;
    }

    video.muted = true;
    this.introStarted.set(true);
    void this.prepareBaptismAudio();
    void video.play()
      .then(() => this.scheduleIntroFallback(video))
      .catch(() => {
        this.introStarted.set(false);
      });
  }

  trackIntroProgress(event: Event): void {
    const video = event.currentTarget as HTMLVideoElement;
    if (
      this.introPhase() === 'playing' &&
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.duration - video.currentTime <= 0.35
    ) {
      this.finishIntro();
    }
  }

  private scheduleIntroFallback(video: HTMLVideoElement): void {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const remainingMilliseconds = Math.max(0, video.duration - video.currentTime) * 1000;
    this.introTimers.push(setTimeout(() => this.finishIntro(), remainingMilliseconds + 900));
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
            this.observer?.unobserve(entry.target);
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
      void this.startBaptismMusic();
    } else {
      this.stopBaptismMusic();
    }
  }

  private async startBaptismMusic(): Promise<void> {
    await this.prepareBaptismAudio();
    if (!this.musicOn || !this.audioContext) {
      return;
    }

    this.playBaptismChimes();
    this.musicTimer = setInterval(() => this.playBaptismChimes(), 7600);
  }

  private async prepareBaptismAudio(): Promise<void> {
    const AudioContextClass = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      this.musicOn = false;
      return;
    }

    this.audioContext ??= new AudioContextClass();
    await this.audioContext.resume();
  }

  private startMusicAfterOpening(): void {
    if (this.musicOn) {
      return;
    }

    this.musicOn = true;
    void this.startBaptismMusic();
  }

  private playBaptismChimes(): void {
    const context = this.audioContext;
    if (!context || context.state === 'closed') {
      return;
    }

    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 1046.5];
    const startAt = context.currentTime + 0.05;

    melody.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + index * 0.72;
      const noteEnd = noteStart + 1.8;

      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.035, noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    });
  }

  private stopBaptismMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
    this.audioContext = undefined;
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
    this.stopBaptismMusic();
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }
}
