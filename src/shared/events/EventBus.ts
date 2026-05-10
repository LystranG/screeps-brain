// Tick 内同步事件总线：Build 阶段注册处理器，Run 阶段同步分发，无跨 tick 持久化。
export type EventHandler<T> = (payload: T) => void;

/**
 * Tick 作用域同步事件总线。
 * 事件处理器在 Build 阶段注册，在 Run 阶段同步调用，无 async/Promise/setTimeout。
 * HighCommand 单例持有此总线并注入到需要的模块。
 */
export class EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  /**
   * 注册事件处理器（Build 阶段调用，跨 tick 持久化）。
   * @param event - 事件名称
   * @param handler - 同步处理函数
   */
  public on<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(event, list);
  }

  /**
   * 同步分发事件（Run 阶段调用）。
   * @param event - 事件名称
   * @param payload - 事件载荷
   */
  public emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) {
      handler(payload);
    }
  }

  /**
   * 注销事件处理器。
   * @param event - 事件名称
   * @param handler - 要注销的处理函数
   */
  public off<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) ?? [];
    const index = list.indexOf(handler as EventHandler<unknown>);

    if (index !== -1) {
      list.splice(index, 1);
      this.handlers.set(event, list);
    }
  }

  /**
   * 清除事件处理器。
   * @param event - 事件名称（不传则清除所有事件的处理器）
   */
  public clear(event?: string): void {
    if (event === undefined) {
      this.handlers.clear();
    } else {
      this.handlers.delete(event);
    }
  }
}
