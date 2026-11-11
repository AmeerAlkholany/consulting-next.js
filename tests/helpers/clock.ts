export class TestClock {
  private current: Date;

  constructor(initial: Date | string = new Date()) {
    this.current = typeof initial === "string" ? new Date(initial) : new Date(initial);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advanceMinutes(hours * 60);
  }

  advanceDays(days: number): void {
    this.advanceHours(days * 24);
  }

  set(time: Date | string): void {
    this.current = typeof time === "string" ? new Date(time) : new Date(time);
  }
}

