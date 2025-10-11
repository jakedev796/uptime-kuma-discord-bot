export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  public info(message: string): void {
    console.log(this.formatMessage('INFO', message));
  }

  public warn(message: string): void {
    console.warn(this.formatMessage('WARN', message));
  }

  public error(message: string): void {
    console.error(this.formatMessage('ERROR', message));
  }

  public debug(message: string): void {
    console.debug(this.formatMessage('DEBUG', message));
  }
}

