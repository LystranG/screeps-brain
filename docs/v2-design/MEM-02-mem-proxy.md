# MEM-02: MemProxy 透明访问层设计

**版本:** v2.0
**状态:** 生效
**决策来源:** D-05、D-06、D-07（10-CONTEXT.md）
**依赖:** MEM-03（Segmenter，底层 L3 读写实现者）、SPEC-03（依赖方向规则）、SPEC-04（接口契约模式 2）

---

## 1. 总体原则（D-07）

**显式 get/set API，调用方明确知道自己在使用缓存层（D-07）。**

MemProxy 不使用 ES6 Proxy 属性拦截，避免隐式语义和 CPU 开销（D-07）。
调用方通过显式方法调用（get/set）与缓存层交互，TypeScript 类型系统保证类型安全。

### 1.1 适用范围（D-06）

MemProxy 只包装**大型数据结构**，普通小数据直接用 Memory：

| 数据类型 | 访问方式 | 理由 |
|---------|---------|------|
| IntelDB 房间情报（每房间 ~10KB） | MemProxy | 大型跨 tick 数据，需 L3 segment 存储 |
| RoomPlan 矩阵（建筑规划，~50KB） | MemProxy | 大型矩阵，超出 L2 Memory 合理体积 |
| 大型寻路图（PathFinder CostMatrix） | MemProxy | 计算代价高，需跨 tick 持久化 |
| Garrison 配置（小型 JSON 对象） | 直接 Memory | 小数据，无需 segment 管理开销 |
| 任务队列（SpawnRequest[]） | 直接 Memory | 小数据，每 tick 重建，无需 MemProxy |

### 1.2 Phase 10 范围边界

**Phase 10 定义以下五项内容：**

1. `IMemProxy<T>` 接口（`src/runtime/memory/index.ts`）
2. `MemProxy<T>` 类骨架（`src/runtime/memory/MemProxy.ts`）
3. `wrap()` 工厂方法签名（segmentId 绑定 + defaults 工厂函数 + ISegmenter 注入）
4. 脏标记机制（dirty flag）和 flush 时机约束
5. 下游消费者清单（Phase 11 IntelDB、Phase 16 BasePlanner）

**以下内容不在 Phase 10 范围内，留给后续实现阶段：**

- `MemProxy.get()` 的完整实现（含 L2 fallback 逻辑）
- `MemProxy.set()` 的 pendingValue 持有逻辑
- `MemProxy.flush()` 的实际 `ISegmenter.set()` 调用
- 与 Kernel memoryFlush 阶段的实际集成

---

## 2. 设计方案对比（D-07）

MemProxy 选择显式 get/set 方法 API，而非 ES6 Proxy 属性拦截：

| 维度 | 显式 get/set（本系统）| ES6 Proxy 拦截 |
|------|----------------------|----------------|
| CPU 开销 | 零（直接方法调用） | 每次属性访问触发 trap |
| 语义透明度 | 调用方明确知道自己在用缓存层 | 隐式，调用方可能忘记检查 Pending |
| 类型安全 | TypeScript 可完整推断 | Proxy 类型定义复杂，泛型支持有限 |
| Pending 检查 | 编译期强制（返回类型 `T \| Pending`） | 运行时才发现遗漏检查 |
| 调试可见性 | 调用栈清晰，方法名明确 | trap 调用栈难以追踪 |

**结论：** 显式 API 在 Screeps 的 CPU 敏感环境中是唯一合理选择（D-07）。

---

## 3. IMemProxy\<T\> 接口

`IMemProxy<T>` 定义在 `src/runtime/memory/index.ts`（barrel export），供下游消费者（IntelDB、BasePlanner）通过接口依赖，不直接依赖 `MemProxy` 实现类（SPEC-04 接口契约模式 2）：

```typescript
// src/runtime/memory/index.ts（barrel export）

/**
 * MemProxy 接口：包装大型 Memory 数据结构，提供 L2/L3 透明读写（D-05、D-06）。
 * 调用方无需知道数据存在哪一层（L2 Memory 或 L3 Segment）。
 * 实现类：MemProxy（src/runtime/memory/MemProxy.ts，MEM-02）。
 * @template T - 被包装的数据类型，必须为对象类型
 */
export interface IMemProxy<T extends object> {
  /**
   * 读取数据。segment 未激活时返回 Pending{ready:false}。
   * 调用方必须用 isPending() 检查返回值后再使用（D-09 语义传递）。
   * 调用方模式：`const result = proxy.get(); if (isPending(result)) return;`
   * @returns 数据对象，或 Pending 标记（segment 未激活时）
   */
  get(): T | Pending;

  /**
   * 写入数据。只标记脏位，数据在 flush() 时写回 segment（D-07 tick 末统一写回）。
   * 不立即写回，避免 tick 中途频繁 I/O。
   * @param value - 要写入的数据对象
   */
  set(value: T): void;

  /**
   * tick 末写回所有脏 segment。只能由 Kernel 的 memoryFlush 阶段调用，业务代码严禁调用。
   * 在 tick 中途调用会导致数据不一致（Pitfall #4 防护）。
   */
  flush(): void;
}
```

### 3.1 调用方使用模式（isPending 检查）

调用方必须在使用 `get()` 返回值前检查 Pending 状态：

```typescript
// 正确的调用方模式（D-09 语义传递）
const intelProxy: IMemProxy<IntelRoomData> = MemProxy.wrap(segmentId, defaultIntelRoomData, segmenter);

// 每 tick 读取时：
const result = intelProxy.get();
if (isPending(result)) {
  // segment 未激活，本 tick 跳过处理
  // Segmenter 已将 segmentId 加入下 tick 激活列表（D-09）
  return;
}
// result 类型已收窄为 IntelRoomData，可安全使用
const threatLevel = result.threatLevel;
```

---

## 4. MemProxy\<T\> 类设计

`MemProxy<T>` 实现 `IMemProxy<T>`，定义在 `src/runtime/memory/MemProxy.ts`：

```typescript
// src/runtime/memory/MemProxy.ts（骨架，完整实现在后续阶段）

export class MemProxy<T extends object> implements IMemProxy<T> {
  private readonly segmentId: number;
  private readonly defaults: () => T;
  private readonly segmenter: ISegmenter;  // 构造函数注入（SPEC-04）
  private dirty = false;                   // 脏标记（D-07 tick 末统一写回）

  private constructor(segmentId: number, defaults: () => T, segmenter: ISegmenter) { ... }

  /**
   * 工厂方法：创建绑定到指定 segment 的 MemProxy 实例。
   * @param segmentId - 数据所在 segment id（由 Segmenter.allocate() 分配）
   * @param defaults - 数据不存在时的默认值工厂函数
   * @param segmenter - ISegmenter 实例（由调用方注入）
   */
  public static wrap<T extends object>(segmentId: number, defaults: () => T, segmenter: ISegmenter): MemProxy<T> { ... }

  public get(): T | Pending { ... }   // 委托 ISegmenter.get()，透明传递 Pending
  public set(value: T): void { ... }  // dirty = true，暂存 value
  public flush(): void { ... }        // 若 dirty：ISegmenter.set() 写回，dirty = false
}
```

### 4.1 ISegmenter 依赖注入方式

MemProxy 通过构造函数注入 `ISegmenter`（符合 SPEC-04 接口契约规范）：

- **不使用全局单例**：避免隐式依赖，便于测试（可注入 mock ISegmenter）
- **wrap() 工厂方法**：调用方通过 `wrap()` 传入 segmenter，而非直接调用 `new MemProxy()`
- **私有构造函数**：强制通过 `wrap()` 创建实例，保证 segmenter 始终被注入

### 4.2 脏标记机制

| 操作 | dirty 状态变化 | 说明 |
|------|--------------|------|
| 初始化 | `false` | 新创建的 MemProxy 无待写入数据 |
| `set(value)` | `false → true` | 标记有待写入数据，不立即写回 |
| `flush()` 写回后 | `true → false` | 数据已写入 segment，标记清除 |
| `flush()` 无脏数据 | `false`（不变） | 无操作，避免不必要的 segment 写入 |

---

## 5. 脏标记写回机制（Claude's Discretion：tick 末统一 flush）

### 5.1 flush() 调用时机

`flush()` 只能在 Kernel 的 `memoryFlush` 阶段调用（`highCommandTick` 之后）：

```
[highCommandTick 阶段]
  业务代码调用 proxy.get() / proxy.set()
  → set() 只标记 dirty=true，不写回

[memoryFlush 阶段]（Kernel 统一调用）
  proxy.flush()
  → 若 dirty：ISegmenter.set(segmentId, value) 写回 segment
  → dirty = false
  ISegmenter.flush()
  → 将所有脏 segment 序列化写回 RawMemory.segments
  → 计算下 tick 激活列表，调用 RawMemory.setActiveSegments()
```

### 5.2 为什么不在 tick 中途调用 flush()（Pitfall #4）

在 `highCommandTick` 中途调用 `flush()` 会导致：

1. **数据不一致**：flush 后同一 tick 内的后续 `set()` 调用不会被写回（dirty 已重置）
2. **多次 setActiveSegments 调用**：Segmenter 的激活列表计算依赖 tick 末的完整访问记录，中途调用会产生不完整的激活列表
3. **CPU 浪费**：多次 `JSON.stringify` 同一 segment 数据

### 5.3 写回流程（实现阶段）

```
dirty segment → JSON.stringify(value) → ISegmenter.set(segmentId, value) → dirty = false
```

---

## 6. Page Fault 传递语义（D-09）

MemProxy 透明传递 Segmenter 的 Page Fault 语义：

```
调用方
  │ proxy.get()
  ▼
MemProxy.get()
  │ this.segmenter.get<T>(this.segmentId)
  ▼
ISegmenter.get(segmentId)
  ├─ segment 已激活 → 返回解析后的 T 对象
  │                    更新 lastAccessed = Game.time
  └─ segment 未激活 → 返回 Pending{ready:false, segmentId}
                       将 segmentId 加入下 tick 激活列表（D-09）
  ▼
MemProxy.get() 直接返回 T | Pending 给调用方
  ▼
调用方检查：if (isPending(result)) return;
```

**关键约束：** MemProxy 不缓存 Pending 状态，每次 `get()` 都委托给 Segmenter。这确保 segment 激活后，下一 tick 的 `get()` 能正确返回数据。

---

## 7. 下游消费者（D-05）

Phase 10 完整设计 MemProxy，为以下下游消费者提供直接可用的接口：

### Phase 11 IntelDB

```typescript
// Phase 11 IntelDB 使用示例（伪代码）
class IntelDB {
  private readonly roomProxies: Map<string, IMemProxy<IntelRoomData>> = new Map();

  public initRoom(roomName: string, segmentId: number, segmenter: ISegmenter): void {
    const proxy = MemProxy.wrap<IntelRoomData>(
      segmentId,
      () => defaultIntelRoomData(roomName),  // defaults 工厂函数
      segmenter
    );
    this.roomProxies.set(roomName, proxy);
  }

  public getRoomData(roomName: string): IntelRoomData | Pending | undefined {
    const proxy = this.roomProxies.get(roomName);
    if (!proxy) return undefined;
    return proxy.get();  // 透明返回 T | Pending
  }
}
```

**使用模式：** 每个房间一个 `MemProxy<IntelRoomData>` 实例，绑定到 Segmenter 分配的 segment id。

### Phase 16 BasePlanner

```typescript
// Phase 16 BasePlanner 使用示例（伪代码）
class BasePlanner {
  private readonly planProxy: IMemProxy<RoomPlanMatrix>;

  public constructor(segmentId: number, segmenter: ISegmenter) {
    this.planProxy = MemProxy.wrap<RoomPlanMatrix>(
      segmentId,
      () => createEmptyRoomPlanMatrix(),
      segmenter
    );
  }

  public getPlan(): RoomPlanMatrix | Pending {
    return this.planProxy.get();
  }
}
```

**使用模式：** 每个房间一个 `MemProxy<RoomPlanMatrix>` 实例，包装建筑规划矩阵（~50KB）。

---

## 8. Phase 10 范围对照表

| 能力 | Phase 10（本文档定义） | 后续实现阶段 |
|------|---------------------|------------|
| `IMemProxy<T>` 接口 | 完整定义 | — |
| `MemProxy<T>` 类骨架 | 骨架（方法签名 + JSDoc） | 完整实现 |
| `wrap()` 工厂方法签名 | 完整定义 | — |
| 脏标记机制（dirty flag） | 完整描述 | — |
| flush 时机约束 | 精确定义 | — |
| 下游消费者清单 | 完整列出 | — |
| `get()` 完整实现（L2 fallback） | — | 实现阶段 |
| `set()` pendingValue 持有逻辑 | — | 实现阶段 |
| `flush()` 实际 ISegmenter.set() 调用 | — | 实现阶段 |
| 与 Kernel memoryFlush 阶段集成 | — | 实现阶段 |

---

## 9. 禁止模式

### 禁止 1：使用 ES6 Proxy 拦截器（D-07）

```typescript
// ❌ 禁止：ES6 Proxy 属性拦截（D-07 明确禁止）
const proxy = new Proxy(Memory.intelDB, {
  get(target, key) {
    // 隐式语义：调用方不知道自己在用缓存层
    // 每次属性访问触发 trap，CPU 开销不可控
    return target[key as keyof typeof target];
  }
});
const data = proxy.threatLevel;  // 调用方可能忘记检查 Pending

// ✅ 正确：显式 get/set 方法（D-07）
const memProxy = MemProxy.wrap<IntelRoomData>(segmentId, defaultIntelRoomData, segmenter);
const result = memProxy.get();
if (isPending(result)) return;  // 调用方主动检查 Pending
const data = result.threatLevel;  // 类型安全，明确知道在用缓存层
```

### 禁止 2：在 tick 中途调用 flush()（Pitfall #4）

```typescript
// ❌ 禁止：在 highCommandTick 中途调用 flush()
class IntelDB {
  public updateRoom(roomName: string, data: IntelRoomData): void {
    this.proxy.set(data);
    this.proxy.flush();  // ❌ 中途 flush：后续 set() 不会被写回，数据丢失
  }
}

// ✅ 正确：只在 Kernel memoryFlush 阶段调用 flush()
// Kernel.ts（memoryFlush 阶段）
private memoryFlush(): void {
  for (const proxy of this.registeredProxies) {
    proxy.flush();  // ✅ tick 末统一写回
  }
  this.segmenter.flush();  // ✅ 写回 RawMemory.segments
}
```

### 禁止 3：用 MemProxy 包装小数据（D-06）

```typescript
// ❌ 禁止：用 MemProxy 包装小型配置对象（D-06 明确不适用）
interface GarrisonConfig { spawnPriority: number; maxCreeps: number; }
const configProxy = MemProxy.wrap<GarrisonConfig>(segmentId, defaultConfig, segmenter);
// 问题：GarrisonConfig 只有几十字节，segment 管理开销远大于收益

// ✅ 正确：小数据直接用 Memory（D-06）
Memory.garrison[roomName].config = { spawnPriority: 1, maxCreeps: 5 };
```

### 禁止 4：get() 返回值未检查 Pending 直接使用（D-09 调用方职责）

```typescript
// ❌ 禁止：不检查 Pending 直接使用返回值
const result = proxy.get();
const threatLevel = (result as IntelRoomData).threatLevel;  // ❌ 若 result 是 Pending，运行时报错

// ✅ 正确：先用 isPending() 检查，再使用数据
const result = proxy.get();
if (isPending(result)) {
  // segment 未激活，本 tick 跳过
  return;
}
// TypeScript 类型收窄：result 已确认为 IntelRoomData
const threatLevel = result.threatLevel;  // ✅ 类型安全
```

---

## 10. 关联规范

| 规范/文档 | 关联内容 |
|---------|---------|
| **MEM-03** | Segmenter 实现 ISegmenter 接口；MemProxy 通过 ISegmenter 实现 L3 读写；Page Fault 语义（D-09）由 Segmenter 定义 |
| **MEM-01** | memoryFlush 阶段（Kernel lifecycle）是 flush() 的唯一合法调用时机 |
| **SPEC-02** | 中文 JSDoc 规范（D-11）；显式访问修饰符（D-14）；`import type` 优先规则 |
| **SPEC-03** | 依赖方向规则：MemProxy 属于 `src/runtime/memory/`，只供 Kernel 层和 runtime 层调用；下游消费者（IntelDB、BasePlanner）通过 IMemProxy 接口依赖，不直接 import MemProxy 类 |
| **SPEC-04** | 接口契约模式 2（共享接口 + 依赖反转）：IMemProxy<T> 的设计遵循此模式；ISegmenter 构造函数注入 |

---

*文档创建：2026-05-16 | Phase 10-Memory 与缓存层设计*
