import { installConsoleCommands } from "commands/installer";

/**
 * 安装控制台命令入口；命令模块内部负责版本复用和树构建细节。
 */
export function runCommandInstallStage(): void {
  installConsoleCommands();
}
