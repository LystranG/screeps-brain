import { LogLevel } from "constants/runtime";

export type LogLevelName = LogLevel;

export interface LoggerConfig {
  logLevel?: LogLevelName;
  enabledNamespaces?: { [namespace: string]: boolean | undefined };
  namespaceSampling?: { [namespace: string]: number | undefined };
}

const LOG_LEVEL_PRIORITY: { [level in LogLevelName]: number } = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

/**
 * Screeps 控制台 logger：只在边界处读取配置，避免普通模块直接依赖 Memory。
 */
export class Logger {
  private readonly config: LoggerConfig;
  private readonly tickProvider: () => number;

  public constructor(config: LoggerConfig = {}, tickProvider: () => number) {
    this.config = config;
    this.tickProvider = tickProvider;
  }

  public debug(namespace: string, message: string): void {
    this.log("debug", namespace, message);
  }

  public info(namespace: string, message: string): void {
    this.log("info", namespace, message);
  }

  public warn(namespace: string, message: string): void {
    this.log("warn", namespace, message);
  }

  public error(namespace: string, message: string): void {
    this.log("error", namespace, message);
  }

  private log(level: LogLevelName, namespace: string, message: string): void {
    if (!this.shouldLog(level, namespace)) {
      return;
    }

    console.log(`[${level}] ${namespace}: ${message}`);
  }

  private shouldLog(level: LogLevelName, namespace: string): boolean {
    if (!this.levelPermits(level) || this.config.enabledNamespaces?.[namespace] === false) {
      return false;
    }

    if (level === "warn" || level === "error") {
      return true;
    }

    return this.samplingPermits(namespace);
  }

  private levelPermits(level: LogLevelName): boolean {
    const configuredLevel = this.normalizedLogLevel();

    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
  }

  private normalizedLogLevel(): LogLevelName {
    const configuredLevel = this.config.logLevel;

    if (configuredLevel && LOG_LEVEL_PRIORITY[configuredLevel] !== undefined) {
      return configuredLevel;
    }

    return "info";
  }

  private samplingPermits(namespace: string): boolean {
    const sampleRate = this.config.namespaceSampling?.[namespace];

    if (sampleRate === undefined || !Number.isFinite(sampleRate) || sampleRate <= 1) {
      return true;
    }

    return this.tickProvider() % Math.floor(sampleRate) === 0;
  }
}
