const dataSettings = {
  settingsDataImportsExports: { en: 'Import & Export', zh: '导入与导出' },
  settingsDataSettings: { en: 'App Settings', zh: '应用设置' },
  settingsDataHistory: { en: 'Chats', zh: '对话' },
  settingsDataScenarios: { en: 'Scenarios', zh: '场景' },
  settingsSystemTools: { en: 'Diagnostics & App', zh: '诊断与应用' },
  settingsDangerZone: { en: 'Destructive Actions', zh: '高风险操作' },
  settingsReset: { en: 'Reset Settings Only', zh: '仅重置设置' },
  settingsResetConfirm: {
    en: 'Are you sure you want to reset all settings to their default values? This does not affect chat history. Your current changes will be lost.',
    zh: '您确定要将所有设置重置为默认值吗？这不会影响您的聊天记录。您当前的更改将丢失。',
  },
  settingsClearHistory: { en: 'Delete Chats and Groups', zh: '删除对话与分组' },
  settingsClearHistoryConfirm: {
    en: 'Are you sure you want to delete all chat history and groups? This action cannot be undone.',
    zh: '您确定要删除所有聊天记录和分组吗？此操作无法撤销。',
  },
  settingsClearCache: { en: 'Delete All App Data', zh: '删除全部应用数据' },
  settingsClearCacheConfirm: {
    en: 'Are you sure you want to clear all application data?\n\nThis will remove:\n- Saved settings\n- Chat history\n- Preloaded scenarios\n\nThis action cannot be undone.',
    zh: '您确定要清除所有应用数据吗？\n\n这将删除：\n- 已保存的设置\n- 聊天记录\n- 预加载的场景\n\n此操作无法撤销。',
  },
  settingsInstallApp: { en: 'Install App', zh: '安装应用' },
  settingsInstallAppAria: { en: 'Install Progressive Web App', zh: '安装渐进式网络应用' },
  settingsInstallAppUnavailableTitle: {
    en: 'App is already installed or not supported by your browser.',
    zh: '应用已安装或浏览器不支持安装。',
  },
  settingsInstallAppManualTitle: {
    en: 'Use your browser menu to install this app.',
    zh: '请使用浏览器菜单将此应用安装到设备。',
  },
  settingsImportHistory: { en: 'Import History', zh: '导入历史' },
  settingsImportHistoryConfirm: {
    en: 'The imported chat history will be merged with your current data. Duplicate sessions (by ID) will be skipped to preserve your existing chats. Do you want to proceed?',
    zh: '导入的聊天记录将与当前数据合并。为保留现有数据，重复的会话（基于 ID）将被跳过。是否继续？',
  },
  settingsImportHistorySuccess: { en: 'History merged successfully!', zh: '历史记录合并成功！' },
  settingsImportSuccess: { en: 'Settings imported successfully!', zh: '设置导入成功！' },
  settingsImportError: {
    en: 'Failed to import settings. The file might be corrupted or in the wrong format.',
    zh: '导入设置失败。文件可能已损坏或格式不正确。',
  },
  settingsImportErrorWithMessage: { en: 'Import failed: {message}', zh: '导入失败：{message}' },
  settingsImportInvalidFileFormat: {
    en: 'Invalid file format. Expected {expectedType}, found {foundType}.',
    zh: '文件格式无效。应为 {expectedType}，实际为 {foundType}。',
  },
  settingsImportHistoryInvalidData: {
    en: 'History data is missing or not an array.',
    zh: '历史数据缺失或不是数组。',
  },
  settingsImportScenariosInvalidData: {
    en: 'Scenarios data is missing or not an array.',
    zh: '场景数据缺失或不是数组。',
  },
  settingsViewLogs: { en: 'View Logs', zh: '查看日志' },
  settingsViewLogsAndUsage: { en: 'Open Logs & Usage', zh: '打开日志与用量' },
  settingsEnableLogging: { en: 'Enable Logging', zh: '启用日志记录' },
  settingsEnableLoggingDescription: {
    en: 'Persist system logs to local storage for troubleshooting. Off by default.',
    zh: '将系统日志持久化到本地存储，用于排查问题。默认关闭。',
  },
  logViewerLoggingDisabledHint: {
    en: 'Logging is off. Enable it in Settings → Data & App to record new logs.',
    zh: '日志记录当前已关闭。前往 设置 → 数据与应用 开启后才会记录新日志。',
  },
  settingsLocalAppData: { en: 'Current Local App Data', zh: '当前本地应用数据' },
  settingsLocalAppDataLoading: { en: 'Calculating local storage usage…', zh: '正在计算本地存储占用…' },
  settingsLocalAppDataError: {
    en: 'Unable to estimate local storage usage right now.',
    zh: '暂时无法估算本地存储占用。',
  },
  settingsClearLogs: { en: 'Clear Logs', zh: '清空日志' },
  settingsClearLogsConfirm: {
    en: 'Are you sure you want to clear all system logs?',
    zh: '您确定要清空所有系统日志吗？',
  },
};
export default dataSettings;
