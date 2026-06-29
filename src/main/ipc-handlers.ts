/**
 * IPC 处理器入口(向后兼容代理)
 *
 * 实际实现已按领域拆分到 ./ipc/ 目录:
 *   - index.ts            聚合入口 + openDashboard + cycleNextSkin
 *   - skin-handlers.ts    皮肤相关 handler
 *   - app-handlers.ts     应用设置相关 handler
 *   - pet-handlers.ts     宠物窗口相关 handler
 *   - nurture-handlers.ts 养成系统相关 handler
 *   - sound-handlers.ts   音效相关 handler
 *   - credential-handlers.ts 凭据管理相关 handler
 *   - plugin-handlers.ts  插件管理相关 handler
 *   - monitor-handlers.ts 监控相关 handler
 *
 * 这里仅做重新导出,保持旧的 import 路径 './ipc-handlers' 可用,
 * 避免 bootstrap.ts 等外部引用方需要同步修改。
 */
export { setupIPC, openDashboard, cycleNextSkin } from './ipc/index'
