import { getPlugins, ReportType } from '../plugins';

/**
 * 插件上报
 */
export function report(type: ReportType, message: string, data?: any) {
  const plugins = getPlugins() || [];
  if (plugins.length === 0) return;

  for (const plugin of plugins) {
    try {
      if (plugin.reporter) {
        plugin.reporter(type, message, data);
      }
    } catch (e) {
      console.error('Error executing spine-player plugin:', e);
    }
  }
}

/**
 * 日志打印工具函数
 */

// 样式配置
const styles = {
  warning: 'background-color: #ff8c00; color: white; padding: 2px 6px; border-radius: 3px;',
  info: 'background-color: #808080; color: white; padding: 2px 6px; border-radius: 3px;',
  success: 'background-color: #28a745; color: white; padding: 2px 6px; border-radius: 3px;',
  error: 'background-color: #dc3545; color: white; padding: 2px 6px; border-radius: 3px;'
};

/**
 * 警告信息打印
 * @param message 消息内容
 * @param data 可选的数据
 */
export function warning(message: string, data?: any): void {
  report('warning', message, data);
  console.log(`%c[WARNING] ${message}`, styles.warning, data || '');
}

/**
 * 信息打印
 * @param message 消息内容
 * @param data 可选的数据
 */
export function info(message: string, data?: any): void {
  console.log(`%c[INFO] ${message}`, styles.info, data || '');
}

/**
 * 成功信息打印
 * @param message 消息内容
 * @param data 可选的数据
 */
export function success(message: string, data?: any): void {
  console.log(`%c[SUCCESS] ${message}`, styles.success, data || '');
}

/**
 * 错误信息打印
 * @param message 消息内容
 * @param data 可选的数据
 */
export function error(message: string, data?: any): void {
  report('error', message, data);
  console.error(`%c[ERROR] ${message}`, styles.error);
  if (data !== undefined) {
    console.error(data);
  }
}

export default {
  warning,
  info,
  success,
  error
};
