# 🚀 GitHub 自动构建 - 3 分钟快速开始

## 步骤 1：创建 GitHub 仓库（1分钟）

1. 打开 https://github.com/new
2. Repository name: `kimi-remote-control`
3. 选择 **Public**（免费无限构建）
4. 不要勾选任何初始化选项
5. 点击 **Create repository**

## 步骤 2：上传代码（1分钟）

```bash
# 在项目文件夹中打开终端
cd kimi-remote-control-v2

# 初始化 git
git init

# 添加文件
git add .

# 提交
git commit -m "Initial commit"

# 关联 GitHub（替换 YOUR_USERNAME 为你的用户名）
git remote add origin https://github.com/YOUR_USERNAME/kimi-remote-control.git

# 推送代码
git branch -M main
git push -u origin main
```

## 步骤 3：触发构建（自动，等待5分钟）

推送完成后，GitHub 会自动开始构建：

1. 打开仓库页面
2. 点击 **Actions** 标签
3. 看到 **Build Android APK** 正在运行（黄色）
4. 等待 5-10 分钟，变成绿色 ✓

## 步骤 4：下载 APK（1分钟）

构建完成后：

1. 点击仓库页面的 **Releases**
2. 点击最新的版本（如 `v1.0.1`）
3. 下载 **KimiRemote-v1.0.1-universal.apk**
4. 传到手机安装

---

## 📱 安装到手机

### 方式 1：直接下载
1. 手机浏览器打开 Release 页面
2. 点击 APK 下载
3. 下载完成点击安装
4. 允许"未知来源"安装

### 方式 2：电脑传输
1. 电脑下载 APK
2. 微信/QQ/数据线传到手机
3. 手机文件管理器点击安装

---

## ⚡ 手动触发构建

如果不想等推送代码，手动触发：

1. 打开仓库 → Actions
2. 点击 **Build Android APK**
3. 点击右侧 **Run workflow** → **Run workflow**
4. 等待构建完成

---

## 🎉 完成！

现在你可以：
- ✅ 每次推送代码自动构建新版本
- ✅ 在 Releases 页面下载最新 APK
- ✅ 手机上控制 Kimi CLI

---

## 🔧 版本号规则

自动构建版本号：`1.0.${构建序号}`

例如：
- 第 1 次构建: `v1.0.1`
- 第 2 次构建: `v1.0.2`

手动触发时可以自定义版本号。

---

## ❓ 常见问题

**Q: 构建失败怎么办？**  
A: 点击 Actions → 失败的构建 → 查看错误日志

**Q: 多久可以下载？**  
A: 通常 5-10 分钟

**Q: 免费吗？**  
A: 公开仓库完全免费，无限构建

**Q: 支持哪些手机？**  
A: Android 5.0+，提供 arm64/arm32/universal 三个版本
