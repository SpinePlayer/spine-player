export type ReportType = 'warning' | 'error';
export interface IPlugin {
  reporter?: (type: ReportType, message: string, data?: any) => void;
}

const plugins: IPlugin[] = [];

export function getPlugins(): readonly IPlugin[] {
  return plugins;
}

export function use(plugin: IPlugin) {
  plugins.push(plugin);
}

export function clear(plugin: IPlugin) {
  const index = plugins.indexOf(plugin);
  if (index !== -1) {
    plugins.splice(index, 1);
  }
}

export function clearAll() {
  plugins.length = 0;
}
