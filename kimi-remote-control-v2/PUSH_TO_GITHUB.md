# 推送代码到 GitHub

## 目标仓库
```
git@github.com:OldYuTou/TaroShell.git
```

## 步骤

### 1. 进入项目目录

```bash
cd kimi-remote-control-v2
```

### 2. 初始化 Git（如果还没初始化）

```bash
git init
```

### 3. 添加所有文件

```bash
git add .
```

### 4. 提交代码

```bash
git commit -m "Initial commit: AI Remote Control with full features"
```

### 5. 关联远程仓库

```bash
git remote add origin git@github.com:OldYuTou/TaroShell.git
```

如果提示 `remote origin already exists`，先删除旧的：
```bash
git remote remove origin
git remote add origin git@github.com:OldYuTou/TaroShell.git
```

### 6. 推送到 GitHub

```bash
git branch -M main
git push -u origin main
```

---

## 🔐 SSH 密钥配置（如果推送失败）

如果提示 `Permission denied`，需要配置 SSH 密钥：

### 生成 SSH 密钥

```bash
# 生成密钥（替换为你的邮箱）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 按回车使用默认路径
# 可以设置密码，也可以直接回车
```

### 添加密钥到 SSH Agent

```bash
# 启动 ssh-agent
 eval "$(ssh-agent -s)"

# 添加私钥
ssh-add ~/.ssh/id_ed25519
```

### 添加公钥到 GitHub

```bash
# 复制公钥内容
cat ~/.ssh/id_ed25519.pub
```

1. 打开 https://github.com/settings/keys
2. 点击 **New SSH key**
3. Title: 任意名称（如 "My Computer"）
4. Key: 粘贴刚才复制的公钥
5. 点击 **Add SSH key**

### 测试连接

```bash
ssh -T git@github.com
```

看到 `Hi OldYuTou! You've successfully authenticated` 说明成功！

然后重新推送：
```bash
git push -u origin main
```

---

## ✅ 验证推送成功

推送完成后，打开：
https://github.com/OldYuTou/TaroShell

应该能看到所有代码文件！

---

## 🚀 触发自动构建

推送成功后，GitHub Actions 会自动开始构建 APK：

1. 打开 https://github.com/OldYuTou/TaroShell/actions
2. 看到 **Build Android APK**  workflow 正在运行
3. 等待 5-10 分钟
4. 构建完成后，在 Releases 页面下载 APK

---

## 📝 完整命令汇总

```bash
# 进入目录
cd kimi-remote-control-v2

# 初始化并提交
git init
git add .
git commit -m "Initial commit"

# 关联远程仓库
git remote add origin git@github.com:OldYuTou/TaroShell.git

# 推送
git branch -M main
git push -u origin main

# 完成！
```

---

## ❓ 常见问题

### 1. `fatal: not a git repository`
```bash
# 解决：先初始化
git init
```

### 2. `remote origin already exists`
```bash
# 解决：删除旧的，添加新的
git remote remove origin
git remote add origin git@github.com:OldYuTou/TaroShell.git
```

### 3. `failed to push some refs`
```bash
# 解决：先拉取再推送
git pull origin main --rebase
git push -u origin main
```

### 4. `Permission denied (publickey)`
```bash
# 解决：配置 SSH 密钥（见上文）
```

---

**现在就开始执行吧！推送完成后告诉我，我帮你检查构建状态。**
