# MEM-04: $ 缓存函数设计

**版本:** v2.0
**状态:** 生效
**决策来源:** D-11、D-12、D-13、D-14、D-15（10-CONTEXT.md）
**依赖:** ICacheable（src/shared/interfaces/）、SPEC-03（依赖方向：shared/ 无向依赖）

---

## 1. 总体原则（D-12、D-13）

**按返回类型分方法，TTL 过期后同步重算，无后台刷新。**

$ 函数（`src/shared/cache/`）是跨域共享工具，任何模块均可使用（SPEC-03 shared/ 免依赖规则，D-15）。
所有方法以 ICacheable 对象的 cacheKey 和属性 key 构成复合键，在 Heap 全局变量中缓存带 TTL 的计算结果。

### 1.1 Phase 10 范围边界

**Phase 10 定义以下 5 项内容：**

1. `ICacheable` 接口（`src/shared/interfaces/ICacheable.ts`）
2. `$` 函数 API 签名（`src/shared/cache/cache.ts`）
3. `DEFAULT_TTL` 常量（`as const`，`src/shared/cache/cache.ts`）
4. `_cache` 全局变量声明（`src/shared/types/global.d.ts`）
5. `CacheEntry<T>` 类型定义（`src/shared/cache/cache.ts`）

**Phase 10 不包含：** $ 函数的完整业务实现（实现在后续编码阶段）。

---

## 2. ICacheable 接口（D-11）

```typescript
// src/shared/interfaces/ICacheable.ts

/**
 * 可缓存对象接口：所有需要使用 $ 缓存函数的类必须实现此接口（D-11）。
 * cacheKey 在实例生命周期内保持不变，用作缓存的命名空间前缀。
 *
 * 命名约定：格式 "ClassName:instanceId"（如 "Garrison:W1N1"、"TaskForce:mining-E15N52"）。
 * cacheKey 在实例生命周期内保持不变，建议格式 ClassName:instanceId（如 Garrison:W1N1）。
 */
export interface ICacheable {
  /** 全局唯一的缓存键前缀，建议格式：ClassName:instanceId（D-11）*/
  readonly cacheKey: string;
}
```

**命名约定：** 格式 `ClassName:instanceId`（如 `Garrison:W1N1`、`TaskForce:mining-E15N52`）。

**实现成本：** 所有 HighCommand 子模块本来就有唯一标识（Garrison.name、TaskForce.ref），实现成本近乎为零。

**barrel 导出路径：** `src/shared/interfaces/index.ts`

```typescript
// src/shared/interfaces/index.ts（Phase 10 扩展后）
export type { ICacheable } from "./ICacheable";  // MEM-04 新增
```

---

## 3. $ 函数 API（D-12）

### 3.1 分方法设计理由

| 设计方案 | 类型推断 | 调用方负担 | 本系统采用 |
|---------|---------|-----------|-----------|
| 单一泛型函数 `$<T>(...)` | 需调用方手动指定 `<T>` | 高（易遗漏泛型参数） | 否 |
| 按返回类型分方法（D-12） | TypeScript 自动推断 | 低（方法名即类型约束） | **是** |

D-12 选择按返回类型分方法：每个方法的返回类型在编译期确定，无需调用方手动指定泛型，减少类型错误风险。

### 3.2 完整 API 签名

```typescript
// src/shared/cache/cache.ts

export const $ = {
  /**
   * 缓存 number 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   */
  number(saver: ICacheable, key: string, callback: () => number, ttl?: number): number,

  /**
   * 缓存 object 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   */
  object<T extends object>(saver: ICacheable, key: string, callback: () => T, ttl?: number): T,

  /**
   * 缓存 array 类型计算结果。
   * 复合键格式：saver.cacheKey + ":" + key。
   * TTL 过期后同步执行 callback 重算并更新缓存（D-13）。
   */
  array<T>(saver: ICacheable, key: string, callback: () => T[], ttl?: number): T[],

  /**
   * 缓存 CostMatrix 类型计算结果。
   * 默认 TTL 为 200 tick（路径缓存通常比普通数据更稳定，参考 §8.5）。
   */
  costMatrix(saver: ICacheable, key: string, callback: () => CostMatrix, ttl?: number): CostMatrix,

  /**
   * 手动清空 L1 Heap 缓存（D-14）。
   * 用于调试或强制重建场景；正常运行不应调用此方法。
   */
  invalidateAll(): void
};
```

### 3.3 DEFAULT_TTL 常量

```typescript
// src/shared/cache/cache.ts

export const DEFAULT_TTL = {
  /** number 类型默认 TTL（tick）*/
  number: 50,
  /** object 类型默认 TTL（tick）*/
  object: 50,
  /** array 类型默认 TTL（tick）*/
  array: 50,
  /** CostMatrix 类型默认 TTL（tick）— 参考 §8.5 路径缓存 TTL=200 */
  costMatrix: 200
} as const;
```

### 3.4 复合键格式

复合键由 `saver.cacheKey` 和 `key` 拼接而成：

```
compositeKey = saver.cacheKey + ":" + key
```

示例：
- `saver.cacheKey = "Garrison:W1N1"`，`key = "hostileCount"` → `"Garrison:W1N1:hostileCount"`
- `saver.cacheKey = "TaskForce:mining-E15N52"`，`key = "path"` → `"TaskForce:mining-E15N52:path"`

---

## 4. CacheEntry 数据结构与 _cache 全局变量

### 4.1 CacheEntry\<T\> 接口

```typescript
// src/shared/cache/cache.ts

/**
 * 缓存条目：存储带 TTL 的计算结果。
 * expiration 为 Game.time 的绝对值，到期时同步重算（D-13）。
 */
export interface CacheEntry<T> {
  /** 缓存的计算结果 */
  value: T;
  /** 过期时刻（Game.time 绝对值）；Game.time >= expiration 时重算 */
  expiration: number;
}
```

### 4.2 _cache 全局变量声明

```typescript
// src/shared/types/global.d.ts

declare global {
  /**
   * $ 函数的 L1 Heap 缓存存储。global reset 后自然消失（D-14）。
   * 键格式：saver.cacheKey + ":" + key
   */
  var _cache: Record<string, { value: unknown; expiration: number }> | undefined;
}
```

### 4.3 TTL 过期检测

TTL 过期检测使用 `Game.time` 绝对值比较：

```typescript
// 过期检测：Game.time >= entry.expiration 时重算（D-13 同步重算）
if (entry !== undefined && Game.time < entry.expiration) {
  return entry.value;  // 未过期，直接返回缓存值
}
// 过期或不存在：执行 callback 重算
const result = callback();
cache[compositeKey] = { value: result, expiration: Game.time + ttl };
return result;
```

**global reset 行为：** `_cache` 随 global reset 自然消失（D-14）。Screeps 引擎在 global reset 时清空所有全局变量，`_cache` 无需手动清理。

---

## 5. refresh 机制（D-13）

### 5.1 同步重算流程

```
访问 $.number(saver, key, callback, ttl)
  ↓
compositeKey = saver.cacheKey + ":" + key
  ↓
检查 _cache[compositeKey]
  ├── 存在且 Game.time < entry.expiration → 返回 entry.value（缓存命中）
  └── 不存在或 Game.time >= entry.expiration → 执行 callback()
        ↓
      result = callback()
        ↓
      _cache[compositeKey] = { value: result, expiration: Game.time + ttl }
        ↓
      返回 result
```

### 5.2 为何不用 stale-while-revalidate

stale-while-revalidate 策略在 TTL 过期后先返回旧值，同时在后台异步刷新。**Screeps 单线程同步执行模型不支持后台异步操作**，因此 stale-while-revalidate 在此环境下无法实现（D-13）。

同步重算的优势：
- 实现简单，无状态机复杂度
- 调用方始终获得最新计算结果
- 无需处理"旧值可能过时"的边界情况

---

## 6. $.invalidateAll()（D-14）

```typescript
/**
 * 手动清空 L1 Heap 缓存（D-14）。
 * 用于调试或强制重建场景；正常运行不应调用此方法。
 * global reset 时 _cache 自然消失，无需手动调用。
 */
invalidateAll(): void {
  global._cache = {};
}
```

**用途：**
- 调试：强制下一次访问重算所有缓存值
- 强制重建：某些全局状态变化后需要立即刷新所有缓存

**注意：** 正常运行不应调用此方法。`global._cache = {}` 将旧对象引用置为不可达，等待 GC 回收。

---

## 7. Phase 10 范围对照表

| 能力 | Phase 10（本文档定义） | 后续编码阶段（实现） |
|------|---------------------|-----------------|
| ICacheable 接口 | 完整定义 | — |
| $ API 签名（5 个方法） | 完整定义 | — |
| DEFAULT_TTL 常量 | 完整定义 | — |
| _cache 全局变量声明 | 完整定义 | — |
| CacheEntry\<T\> 类型 | 完整定义 | — |
| $ 函数完整实现逻辑 | 骨架（占位） | 实现阶段 |
| 单元测试 | — | 实现阶段 |

---

## 8. 禁止模式

### 禁止 1：TTL = 1（D-13）

TTL=1 等同于每 tick 都重算，失去缓存意义，且增加代码复杂度。

```typescript
// ❌ 禁止：TTL=1（等同于不缓存，失去意义）
$.number(saver, "count", () => computeExpensiveCount(), 1);

// ✅ 正确：使用合理 TTL（至少 10 tick）
$.number(saver, "count", () => computeExpensiveCount(), DEFAULT_TTL.number);
```

### 禁止 2：硬编码 cacheKey（Pitfall #3）

非实例唯一的 cacheKey 导致同类所有实例共享同一缓存命名空间，产生缓存污染。

```typescript
// ❌ 禁止：硬编码 cacheKey（所有 Garrison 实例共享同一 key，缓存污染）
class Garrison {
  readonly cacheKey = "garrison";  // ❌ 所有实例共享，W1N1 和 W2N2 的缓存互相覆盖
}

// ✅ 正确：从实例唯一标识派生 cacheKey
class Garrison {
  readonly cacheKey: string;
  constructor(public readonly name: string) {
    this.cacheKey = `Garrison:${name}`;  // ✅ 每个 Garrison 实例唯一（如 "Garrison:W1N1"）
  }
}
```

### 禁止 3：在 $ 函数内部异步重算（D-13）

Screeps 单线程同步执行模型不支持 async/await，$ 函数的 callback 必须是同步函数。

```typescript
// ❌ 禁止：异步 callback（Screeps 单线程环境无 async 需求，D-13）
$.object(saver, "data", async () => {
  const result = await fetchData();  // ❌ Screeps 不支持异步操作
  return result;
});

// ✅ 正确：同步 callback
$.object(saver, "data", () => {
  return computeDataSynchronously();  // ✅ 同步计算，符合 Screeps 单线程模型
});
```

### 禁止 4：直接访问 global._cache

`global._cache` 是 $ 函数的内部实现细节，业务代码不得直接操作。

```typescript
// ❌ 禁止：直接访问内部缓存存储
if (global._cache && global._cache["Garrison:W1N1:hostileCount"]) {
  return global._cache["Garrison:W1N1:hostileCount"].value as number;  // ❌ 绕过 $ 函数 API
}

// ✅ 正确：通过 $ 函数 API 使用缓存
return $.number(garrison, "hostileCount", () => countHostiles(garrison.room));  // ✅ 通过 API 访问
```

---

## 9. 关联规范

| 规范/文档 | 关联内容 |
|---------|---------|
| **MEM-01** | MemoryManager.load() 检测 global reset（_memParsed 变量），与 _cache 自然消失机制并行 |
| **MEM-02** | MemProxy 操作 L2/L3 层，$ 函数操作 L1 Heap 层，两者独立不交叉 |
| **KERN-03** | lifecycle.ts 生命周期阶段（$ 函数在任意阶段均可调用，无生命周期约束） |
| **SPEC-02** | as const 模式（DEFAULT_TTL）、中文 JSDoc 规范 |
| **SPEC-03** | 依赖方向规则（shared/ 无向依赖，任何模块均可 import $ 函数） |
| **SPEC-04** | 接口契约规范（ICacheable 设计遵循此规范） |

---

*文档创建：2026-05-16 | Phase 10-Memory 与缓存层设计*
