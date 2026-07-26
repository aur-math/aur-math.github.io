# KIDmath

一个支持 iPad、iPhone 和电脑的数学小测 PWA，包含三语界面、用户登录和管理员页面。

## 本地测试

```bash
node server.js
```

然后打开 `http://localhost:8000`。第一次启动会在终端显示初始管理员用户名和随机密码。

本地用户数据保存在 `data/kidmath-db.json`，该目录已加入 `.gitignore`，不会上传到 GitHub。密码只保存加盐 PBKDF2 哈希，管理员可以重置密码，但不能查看原密码。

## iPad 安装测试

1. 让电脑和 iPad 连接同一个 Wi-Fi。
2. 在电脑运行本地服务。
3. 用 `ifconfig en1` 查看电脑的 Wi-Fi 局域网地址。
4. 在 iPad Safari 打开电脑的局域网地址，例如 `http://192.168.1.20:8000`。
5. 点击 Safari 分享按钮，选择“添加到主屏幕”。

局域网 HTTP 适合真机预览。

## GitHub Pages 部署

GitHub Pages 只托管静态文件，用户和登录统计需要 Cloudflare Worker + D1 后端。免费部署代码位于 `cloudflare-worker/`：

1. 按照 `cloudflare-worker/README.md` 创建 D1 数据库并部署 Worker。
2. 将得到的 Worker HTTPS 地址写入根目录 `config.js`。
3. 把本项目推送到名为 `aur-math.github.io` 的 GitHub 仓库。
4. 在 GitHub 仓库设置中启用 Pages，并选择发布分支的根目录。

Worker 默认只允许 `https://aur-math.github.io` 调用。若网址不同，请同时修改 `cloudflare-worker/wrangler.jsonc` 中的 `ALLOWED_ORIGIN`。

## 功能

- 中文、英文和法文切换。
- 用户登录、退出和独立考试历史。
- 管理员创建、删除用户和重置密码。
- 管理员查看登录次数、累计使用时长和最近登录时间。
- 按年级设置题目难度。
- 可选择加、减、乘、除。
- 可设置题目数量和考试时间。
- 考试页倒计时。
- 题目可直接输入答案。
- 固定草稿区支持手写验算和清空。
- 到时或交卷后自动判分。
- 错题会用红色突出显示。
- 成绩页显示已用时间和剩余时间。
- 每次交卷会自动生成成绩快照，并保存在主页历史记录里。
