# GitHub Actions 自动构建指南

## 🎯 目标

配置 GitHub 自动构建 APK，无需本地 Flutter 环境，每次推送代码自动构建，可直接下载安装。

---

## 📋 前置准备

### 1. 创建 GitHub 账号

- 访问 https://github.com
- 注册账号（如果还没有）

### 2. 创建代码仓库

#### 方法一：直接上传（推荐新手）

```bash
# 1. 在你的电脑上，进入项目目录
cd kimi-remote-control-v2

# 2. 初始化 git
git init

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "Initial commit"

# 5. 在 GitHub 上创建新仓库（不要初始化）
# 访问: https://github.com/new
# 输入仓库名: kimi-remote-control

# 6. 关联远程仓库（替换 YOUR_USERNAME 为你的用户名）
git remote add origin https://github.com/YOUR_USERNAME/kimi-remote-control.git

# 7. 推送代码
git branch -M main
git push -u origin main
```

#### 方法二：Fork 现有仓库

如果你已经有现成的仓库，可以直接 Fork。

---

## 🚀 自动构建流程

### 方式一：自动触发（推荐）

每次你推送代码到 `main` 分支，GitHub 会自动构建 APK：

```bash
# 修改代码后
git add .
git commit -m "更新功能"
git push origin main

# 然后 GitHub 会自动开始构建
# 约 5-10 分钟后，在 Releases 页面下载 APK
```

### 方式二：手动触发

如果你想立即构建，不用等推送代码：

1. 打开你的 GitHub 仓库
2. 点击 **Actions** 标签
3. 点击左侧 **Build Android APK**
4. 点击右侧 **Run workflow** 按钮
5. 可选：输入版本号（如 `1.0.0`）
6. 点击绿色的 **Run workflow**

![手动触发示意图](https://docs.github.com/assets/images/help/actions/manual-run-workflow.png)

---

## 📱 下载 APK

### 从 Releases 下载（推荐）

1. 打开仓库页面
2. 点击右侧 **Releases**
3. 找到最新版本（如 `v1.0.1`）
4. 下载适合你的 APK：
   - **KimiRemote-v1.0.1-universal.apk** - 通用版，所有手机可用
   - **KimiRemote-v1.0.1-arm64.apk** - ARM64 版，现代手机推荐
   - **KimiRemote-v1.0.1-arm32.apk** - ARM32 版，旧手机

### 从 Artifacts 下载

如果不想发 Release，也可以直接从构建产物下载：

1. 打开 **Actions** 标签
2. 点击最新的一次构建记录
3. 页面底部 **Artifacts** 部分
4. 下载对应的 APK 文件

---

## ⚙️ 配置说明

### 构建版本号

版本号自动生成规则：
- 自动构建: `1.0.${GITHUB_RUN_NUMBER}`（如 1.0.42）
- 手动构建: 可以输入自定义版本号

### 构建触发条件

默认以下情况会触发构建：
- ✅ 推送代码到 `main` 或 `master` 分支
- ✅ 修改了 `mobile-client/**` 目录下的文件
- ✅ 修改了 `.github/workflows/**` 文件
- ✅ 手动点击 "Run workflow"

### 跳过构建

如果某次提交不想触发构建，在 commit message 中加入 `[skip ci]`：

```bash
git commit -m "更新文档 [skip ci]"
```

---

## 🔧 自定义配置

### 修改 Flutter 版本

编辑 `.github/workflows/build_apk.yml`：

```yaml
env:
  FLUTTER_VERSION: '3.16.0'  # 改成你需要的版本
```

### 修改 Java 版本

```yaml
env:
  JAVA_VERSION: '17'  # 可选: 11, 17, 21
```

### 添加签名（正式发布需要）

如果要发布到应用商店，需要添加签名：

1. 生成签名密钥（本地执行）：
```bash
keytool -genkey -v -keystore kimi-remote.keystore -alias kimi -keyalg RSA -keysize 2048 -validity 10000
```

2. 在 GitHub 仓库添加 Secrets：
   - 打开仓库 Settings → Secrets and variables → Actions
   - 点击 **New repository secret**
   - 添加以下 secrets：
     - `KEYSTORE_BASE64`: 密钥文件的 base64 编码
     - `KEYSTORE_PASSWORD`: 密钥密码
     - `KEY_ALIAS`: 密钥别名
     - `KEY_PASSWORD`: 别名密码

3. 修改 workflow 文件添加签名步骤

---

## 🐛 故障排查

### 构建失败

1. **查看构建日志**
   - 打开 Actions 标签
   - 点击失败的构建
   - 查看具体的错误信息

2. **常见错误**

| 错误 | 解决方案 |
|------|---------|
| `flutter command not found` | 检查 Flutter 安装步骤 |
| `Gradle build failed` | 清理 Gradle 缓存后重试 |
| `Out of memory` | GitHub Actions 内存不足，简化构建步骤 |

3. **重新运行构建**
   - 在失败的构建页面点击 **Re-run jobs**
   - 或推送新代码触发新构建

### APK 安装失败

1. **允许未知来源安装**
   - 设置 → 安全 → 允许安装未知来源应用

2. **检查架构版本**
   - 旧手机用 arm32 版
   - 新手机用 arm64 版
   - 不确定用 universal 版

3. **签名问题**
   - 调试版使用 debug 签名，可能提示不安全
   - 这是正常的，点击"继续安装"

---

## 📊 构建状态

在仓库 README 中添加构建状态徽章：

```markdown
![Build APK](https://github.com/YOUR_USERNAME/kimi-remote-control/workflows/Build%20Android%20APK/badge.svg)
```

---

## 🎉 成功标志

如果看到以下内容，说明配置成功：

1. ✅ 推送代码后 Actions 自动触发
2. ✅ 构建完成显示绿色 ✓
3. ✅ Releases 页面出现新版本
4. ✅ 可以下载并安装 APK

---

## 💡 提示

- 每次构建约需 **5-10 分钟**
- 构建免费，但有每月使用限制（公开仓库无限制）
- 建议开启仓库为 **Public**，免费且无限构建
- 如果是 Private 仓库，每月有 2000 分钟免费额度

---

## 📞 需要帮助？

如果遇到问题：

1. 查看 Actions 页面的错误日志
2. 检查代码是否有语法错误
3. 在 Issues 中提问

**现在就开始吧！**
1. 创建 GitHub 仓库
2. 推送代码
3. 等待 10 分钟
4. 下载 APK 使用！