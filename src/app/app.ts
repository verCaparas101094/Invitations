import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

type IntroPhase = 'playing' | 'white' | 'reveal' | 'done';

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
  private observer?: IntersectionObserver;
  private sections: HTMLElement[] = [];
  private sectionAnimationsStarted = false;
  private readonly introTimers: Array<ReturnType<typeof setTimeout>> = [];
  private audioContext?: AudioContext;
  private musicTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.sections = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.animate-section')
    );

  }

  playIntro(): void {
    const video = this.introVideo?.nativeElement;
    if (!video || this.introStarted()) {
      return;
    }

    video.muted = true;
    this.introStarted.set(true);
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
    const AudioContextClass = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      this.musicOn = false;
      return;
    }

    this.audioContext ??= new AudioContextClass();
    await this.audioContext.resume();
    if (!this.musicOn) {
      this.stopBaptismMusic();
      return;
    }
    this.playBaptismChimes();
    this.musicTimer = setInterval(() => this.playBaptismChimes(), 7600);
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
  }
}
