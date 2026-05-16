# MEM-01: MemoryManager 与 Kernel 集成

> **状态：** v2.0 权威文档 | **日期：** 2026-05-16
> **关联决策：** D-01、D-02、D-03、D-04（10-CONTEXT.md）
> **依赖：** KERN-03（lifecycle 扩展基于此）、SPEC-03（runtime/ 依赖方向规则）
> **阶段范围：** Phase 10 完整设计接口与逻辑；实现阶段接入 Kernel lifecycle

---

## 1. 总体原则（D-01、D-03）

**MemoryManager 是 Kernel 的独立运行时基础设施阶段，在 highCommandTick 之前完成 Memory 准备（load + clean），不属于 HighCommand 业务层（D-01）。**

### 1.1 职责分离（D-03）

两个方法职责严格分离：

- **load()：** 只做 MemHack — 复用上 tick 已解析的 Memory 对象引用，跳过 JSON.parse。检测 global reset 并在必要时回退到正常解析路径。
- **clean()：** 只做死亡实体清理 — 遍历 Memory.creeps 和 Memory.flags，删除已不存在的实体条目。

### 1.2 Phase 10 范围边界

**Phase 10 定义以下 4 项内容：**

1. `IMemoryManager` 接口（`src/runtime/memory/index.ts`）
2. `MemoryManager` 类骨架（`src/runtime/memory/MemoryManager.ts`）
3. `lifecycle.ts` 扩展方案（memoryLoad、memoryClean、memoryFlush 三个新阶段）
4. MemHack 逻辑伪代码与 clean() 清理范围规则

**以下内容不在 Phase 10 范围内：**

- MemoryManager 与 Kernel 的实际接入（lifecycle run 函数调用 memoryManager 实例）
- `src/memory/schema.ts` 的实际迁移操作
- 性能基准测试

### 1.3 无 format() 阶段（D-04）

**明确设计决策：不需要 format() 收尾阶段。** Memory 体积管理由各模块自行负责（如 Stats 自己截断历史数据）。MemoryManager 只做 load + clean，不做写回格式化。

> ⚠️ **Screeps 环境注意：** `RawMemory._parsed` 是引擎内部实现细节，非官方 API。不同引擎版本（官方服务器 vs 私服）行为可能不同。设计依赖此行为需在目标引擎版本验证。[ASSUMED]

---

## 2. lifecycle.ts 扩展（D-01）

### 2.1 LifecycleStageName 联合类型

```typescript
export type LifecycleStageName =
  | "refreshServices"
  | "detectEnvironmentBootstrap"
  | "memoryLoad"    // MEM-01 新增：MemHack 阶段
  | "memoryClean"   // MEM-01 新增：清理阶段
  | "highCommandTick"
  | "memoryFlush";  // MEM-02/03 新增：tick 末写回
```

### 2.2 KERNEL_STAGE_ORDER 静态数组

```typescript
export const KERNEL_STAGE_ORDER: LifecycleStageName[] = [
  "refreshServices",
  "detectEnvironmentBootstrap",
  "memoryLoad",
  "memoryClean",
  "highCommandTick",
  "memoryFlush"
];
```

### 2.3 阶段执行顺序

```
refreshServices → detectEnvironmentBootstrap → memoryLoad → memoryClean → highCommandTick → memoryFlush
```

| 阶段 | 职责 | 来源 |
|------|------|------|
| refreshServices | 创建 logger/profiler/环境服务 | Phase 9 KERN-03 |
| detectEnvironmentBootstrap | 检测 sim/world/private 环境 | Phase 9 KERN-03 |
| memoryLoad | MemHack：复用 Heap 引用或重新解析 | Phase 10 MEM-01 |
| memoryClean | 清理死亡实体 Memory 残留 | Phase 10 MEM-01 |
| highCommandTick | HighCommand 完整 tick（build/refresh + init/run） | Phase 9 KERN-03 |
| memoryFlush | tick 末写回脏 segment，设置下 tick 激活列表 | Phase 10 MEM-02/03 |

### 2.4 与 KERN-03 lifecycle 的兼容关系

Phase 10 在 Phase 9 已定义的生命周期中插入新阶段。Phase 9 定义了 `refreshServices` → `detectEnvironmentBootstrap` → `highCommandTick` 的基本框架。Phase 10 在 `detectEnvironmentBootstrap` 和 `highCommandTick` 之间插入 `memoryLoad` + `memoryClean`，在 `highCommandTick` 之后追加 `memoryFlush`。

KERNEL_STAGE_ORDER 改为静态显式数组（不再使用 `.map(stage => stage.name)` 派生），确保阶段顺序在编译时可见。

---

## 3. IMemoryManager 接口

```typescript
// src/runtime/memory/index.ts
export interface IMemoryManager {
  /** MemHack 阶段：检测 global reset，复用 Heap 引用或重新解析 RawMemory。*/
  load(): void;
  /** 清理阶段：遍历 Memory.creeps 和 Memory.flags，删除已死亡实体的残留条目。*/
  clean(): void;
}
```

**目录位置（D-02）：** `src/runtime/memory/`，与 Kernel 同层。MemoryManager 是运行时基础设施，不属于 shared/ 或 domain/ 层。

---

## 4. MemHack 实现逻辑（D-03）

### 4.1 原理

引擎每 tick 开始时执行 `Memory = JSON.parse(RawMemory.get())`，将结果缓存在 `RawMemory._parsed`。MemHack 的做法是：在 Heap 中保留上 tick 的 `Memory` 对象引用，在下一 tick 开始时直接将 `global.Memory` 替换为持久化的 Heap 引用，跳过 JSON.parse。

### 4.2 _memParsed 全局变量声明

```typescript
// src/shared/types/global.d.ts
declare global {
  /**
   * MemHack：Heap 中保留上 tick 的已解析 Memory 对象引用。
   * global reset 后此引用变为 undefined，MemoryManager.load() 据此检测 reset。
   */
  var _memParsed: Record<string, unknown> | undefined;
}
```

### 4.3 load() 方法实现

```typescript
// src/runtime/memory/MemoryManager.ts
public load(): void {
  if (global._memParsed !== undefined) {
    // 正常 tick：直接将引擎的 Memory 全局变量替换为 Heap 引用
    (global as unknown as Record<string, unknown>).Memory = global._memParsed;
  } else {
    // global reset：重新从 RawMemory 解析，并保存引用到 Heap
    global._memParsed = Memory as unknown as Record<string, unknown>;
  }
}
```

### 4.4 global reset 检测

- **条件：** `global._memParsed !== undefined` 为正常 tick；`undefined` 为 global reset
- **global reset 触发场景：** 代码部署、引擎重启、手动 `global.reset()` 调用
- **回退行为：** 访问 `Memory` getter 触发引擎 lazy parse，然后保存引用到 Heap

### 4.5 CPU 节省估算

- **小型 Memory（< 50KB）：** 节省约 0.5 CPU/tick
- **中型 Memory（50-200KB）：** 节省约 1-1.5 CPU/tick
- **大型 Memory（> 200KB）：** 节省约 2+ CPU/tick

> ⚠️ **Screeps 环境注意：** `RawMemory._parsed` 是引擎内部实现细节。在官方服务器上此行为已被社区广泛验证，但私服引擎版本可能不同。[ASSUMED]

---

## 5. clean() 清理规则（D-03）

### 5.1 清理范围精确定义

```typescript
public clean(): void {
  // 清理已死亡 Creep 的 Memory 残留
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }
  // 清理已移除 Flag 的 Memory 残留
  for (const name in Memory.flags) {
    if (!Game.flags[name]) {
      delete Memory.flags[name];
    }
  }
}
```

### 5.2 明确排除项

以下 Memory 键**不由** MemoryManager.clean() 管理：

| Memory 键 | 管理者 | 理由 |
|-----------|--------|------|
| Memory.garrison.* | Garrison 模块 | 业务配置，生命周期由模块自行管理 |
| Memory.stats.* | Stats 模块 | 历史数据截断由 Stats 自行负责 |
| Memory.segmenter.* | Segmenter | 分配表元数据，Segmenter 自行维护 |

### 5.3 执行时机

Kernel 的 `memoryClean` 阶段（memoryLoad 之后、highCommandTick 之前）。此时 Memory 已通过 MemHack 准备就绪，可以安全遍历。

---

## 6. schema.ts 迁移（D-02）

### 6.1 迁移路径

- **当前路径：** `src/memory/schema.ts`
- **迁移目标：** `src/runtime/memory/schema.ts`

### 6.2 迁移注意事项

- 更新所有 import 路径（已知引用文件：`src/main.ts`、`src/runtime/Kernel.ts`）
- 删除原 `src/memory/` 目录（不保留转发 barrel）
- 确保 tsconfig.json paths 映射更新（如有 `memory/*` 别名）

**标注：** 迁移在代码实现阶段执行，Phase 10 只做路径规划。

---

## 7. Phase 10 范围对照表

| 能力 | Phase 10（本文档定义） | 实现阶段 |
|------|----------------------|----------|
| IMemoryManager 接口 | ✓ 完整定义 | — |
| MemoryManager 类骨架 | ✓ load() + clean() 完整逻辑 | 接入 lifecycle |
| lifecycle.ts 扩展 | ✓ 三个新阶段已添加 | — |
| MemHack 逻辑 | ✓ 完整实现 | 性能验证 |
| clean() 清理规则 | ✓ 精确定义 | — |
| schema.ts 迁移 | ✓ 路径规划 | 实际迁移 |
| Kernel 实际接入 | — | lifecycle run 函数调用 |
| 性能基准测试 | — | 实现后验证 |

---

## 8. 禁止模式

### 禁止 1：在 MemoryManager.load() 之外对 global.Memory 整体赋值

❌ **错误：**
```typescript
// 在 highCommandTick 中直接覆盖 Memory
(global as any).Memory = JSON.parse(RawMemory.get());
```

✅ **正确：**
```typescript
// 只在 MemoryManager.load() 中操作 Memory 全局引用
// 业务代码通过 Memory.xxx 正常读写，不操作全局引用
const data = Memory.garrison["W1N1"];
```

### 禁止 2：调用 format() 收尾

❌ **错误：**
```typescript
// 在 tick 末尾调用 format 整理 Memory
memoryManager.format(); // D-04 明确不需要此方法
```

✅ **正确：**
```typescript
// 各模块自行管理自己的 Memory 体积
class Stats {
  private truncateHistory(): void {
    // Stats 自己截断历史数据
  }
}
```

### 禁止 3：在 highCommandTick 中直接访问 Memory 而不经过 load() 阶段保证

❌ **错误：**
```typescript
// 跳过 memoryLoad 阶段直接使用 Memory（timing 问题）
class Kernel {
  run() {
    // 没有先执行 memoryLoad 就访问 Memory
    const config = Memory.config;
    this.highCommandTick();
  }
}
```

✅ **正确：**
```typescript
// 通过 lifecycle 阶段顺序保证 Memory 已就绪
// memoryLoad → memoryClean → highCommandTick
// highCommandTick 中访问 Memory 时，MemHack 已完成
```

---

## 9. 关联规范表

| 规范 | 关联内容 | 影响 |
|------|---------|------|
| KERN-03 lifecycle | memoryLoad/memoryClean/memoryFlush 插入 lifecycle 阶段列表 | 阶段顺序依赖 |
| MEM-02 MemProxy | memoryFlush 阶段调用 MemProxy.flush() 写回脏 segment | flush 时机约束 |
| MEM-03 Segmenter | memoryFlush 阶段调用 Segmenter.flush() 设置激活列表 | flush 时机约束 |
| SPEC-02 代码风格 | 中文 JSDoc、as const 模式 | 代码规范 |
| SPEC-03 依赖方向 | MemoryManager 在 runtime/ 层，不依赖 domain/ | 依赖规则 |

---

*文档创建：2026-05-16 | Phase 10-Memory 与缓存层设计*
