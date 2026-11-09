# 阿里99与国内静态资源加速

## 当前上线路线：境外 Pages

2026-11-09 核实阿里99区域为杭州（cn-hangzhou），用户确认 emssion.com 未备案，并选择先使用免 ICP 备案的境外托管、在国内测速后再选择 CDN。因此当前不在杭州服务器安装 Runner 或开放公网游戏站点，下面的阿里99部署配置保留为备案后的备选，发布开关保持关闭。

EdgeOne Pages/Makers 选择“全球（不含中国大陆）”。优先使用 Git 集成导入私有仓库 `adoin/IAmUltraman`，生产分支 `main`，根目录 `/`。仓库 `edgeone.json` 已设置安装 `npm ci`、构建 `npm test && npm run build`、产物目录 `dist`，并允许页面摄像头权限。导入完成后每次 main 推送将自动测试、构建并发布，无需服务器 Runner 或在仓库保存个人 SSH 私钥。

自定义域名建议 `ultraman.emssion.com`，具体 DNS CNAME 值必须以项目控制台生成值为准；不得复用其他项目的 CNAME 或覆盖根域名既有站点。默认平台域名在大陆访问存在预览链接有效期限制，不能用其替代正式自定义域名。

国内测速使用阿里99杭州服务器的 SSH 会话执行，不能使用用户本机（存在境外代理/分流）推断国内速度。至少分别测首页、雷德王 GLB 和识别 WASM，记录 HTTP 状态、首字节时间、总时间及下载字节数，冷/热请求均需检查。单个杭州机房结果不代表所有省份和运营商。

2026-11-09 GitHub Pages 基线：杭州服务器请求首页约 1.23 秒；雷德王 25 秒仅收到 562286 字节（约 22 KB/s），识别 WASM 25 秒仅收到 507904 字节（约 20 KB/s），两个大资源均超时。这是实测时点的单个机房结果。

参考：[境外域名和区域要求](https://pages.edgeone.ai/document/domain-overview)、[Git 构建配置](https://pages.edgeone.ai/document/edgeone-json)。

## 发布结构

现有 Caddy 承载游戏 HTTPS 页面；无需额外游戏后端或数据库。源站保留模型、MediaPipe WASM、识别模型和配音，通过 CDN 回源缓存。CDN 不是另外一份需手工同步的素材仓库。

`npm run build` 默认保持 GitHub Pages 和本地同源访问。设置 `ASSET_BASE_URL=https://assets.example.com` 后，构建仅将游戏代码、识别 Worker 中的资源地址改为该域名下 `/assets/<资源内容摘要>/public/...`。Worker 脚本自身、Three.js 模块和页面 SVG 仍由页面同源加载。资源目录按内容摘要保留，代码更新不会改掉未变更素材的目录；旧页面仍能加载其对应素材。

服务器目录：

```
/srv/iamultraman/
  releases/<commit>-<run>-<attempt>/
  assets/<内容摘要>/public/
  current -> releases/当前版本/
```

发布前验证素材摘要，发布时原子切换 `current`。发布后检查 HTTPS `deployment.json`；失败时恢复上一个链接。旧版本和素材暂不自动删除，以保留回退能力，需定期检查磁盘。初次发布检查失败时取消 `current` 链接。

跨域加载回归：先用 `ASSET_BASE_URL=https://assets.example.test npm run build` 构建，再 `node scripts/serve.mjs --dist`，最后 `npm run test:cdn`。Windows 用 PowerShell 设置同名环境变量。该测试以浏览器路由模拟 HTTPS 素材域名，实际初始化姿态 Worker/WASM、预热识别模型并加载全部怪兽；它验证加载机制，不代表真实 CDN 的命中率或网速。

## 自动工作流

`.github/workflows/check.yml` 在 main 推送或手动运行时：

1. GitHub 托管机器安装依赖、执行测试、构建。
2. 上传网站和发布工具 artifact。
3. 启用发布后，由阿里99上的专用普通用户 Runner 下载 artifact 并发布。

只在私有仓库注册带 `ultraman-ali99` 标签的专用 Linux Runner。不使用 root Runner，不给该用户 sudo，不执行 PR 事件。普通用户只写 `/srv/iamultraman` 和自己的 Runner 目录，Caddy 以只读方式提供文件。无需把个人 SSH 私钥上传 GitHub；Runner 使用注册时的一次性令牌建立连接。

仓库 Actions Variables：

| 名称 | 值 |
| --- | --- |
| `ALI99_DEPLOY_ENABLED` | 初始不设置；站点和 Runner 验证完成后设为 `true` |
| `ALI99_SITE_URL` | 游戏的 HTTPS 完整地址 |
| `ASSET_BASE_URL` | 可选，素材 CDN 的 HTTPS 域名，无末尾 `/`；留空为同源 |

## Caddy 与 CDN

`deploy/Caddyfile.template` 是待替换域名的新站点配置。独立站点必须允许 `camera=(self)`；已有其他站点的 `camera=()` 不能照搬。保留现有站点配置，新增 import 前备份并 `caddy validate`，成功后 reload。

也可将整个游戏域名接入 CDN，只缓存 `/assets/*`。独立素材域名需响应 `Access-Control-Allow-Origin: *`，正确返回 `.wasm` MIME `application/wasm`。所有资源使用 HTTPS。

CDN 规则：

- `/assets/*` 保留完整路径，缓存一年、允许跨域，不能去掉内容摘要路径。
- HTML、`deployment.json`、应用 JS 和 CSS 初期不缓存或遵循源站 `no-cache`，避免旧入口与新版混用。
- 回源至阿里99时配置正确的 Host、HTTPS 证书名，避免 CDN 域名指向自身而形成回源循环。
- 发布后实测模型、WASM、识别 Worker、音频以及第二次请求是否命中缓存，不能只验证首页。

免费套餐需按当前服务条款确认。中国大陆节点通常要求域名备案；免费套餐不提供访问速度承诺。EdgeOne 免费版限制大型文件分发，不能据“不限量”推断适合作为独立素材下载站。ESA 免费版存在带宽/单请求速率限制，国内节点权益需以账号控制台为准。

参考：[ESA 免费套餐](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-plan)、[EdgeOne 免费版使用说明](https://cloud.tencent.cn/document/product/1552/118985)。
