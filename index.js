// design-ledger：日志+看板插件（规则提供者，真实文件存项目文件夹）
// 能力注册为 DSH 工具，供智能体跨会话调用：
//   ledger_append  —— 追加一条要求记录到指定项目的日志（真值层，append-only）
//   ledger_board   —— 依据日志生成/更新该项目的看板文件（推理层）
//   ledger_read    —— 读取日志或看板
// 文件位置规则：logs/<项目名>.log.md 与 boards/<项目名>.board.md，存于配置根目录下
// 注意：不导出 Config 对象（cordis resolveConfig 需要 standard-schema）；
//       可调参数来自 cordis.patch.yml 里行的 config（apply 的第二参）

export const inject = ['tools']

function safeName(project) {
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5-]{1,64}$/.test(project)) {
    throw new Error(`非法项目名: ${project}（只允许中英文/数字/下划线/连字符）`)
  }
  return project
}

function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function normalizeConfig(raw = {}) {
  return {
    projectsRoot: typeof raw.projectsRoot === 'string' && raw.projectsRoot.trim()
      ? raw.projectsRoot.trim()
      : 'G:/program/飞书cli/docs',
  }
}

const str = (desc) => ({ type: 'string', description: desc })

const MSG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'message'],
  properties: {
    ok: { type: 'boolean', description: '是否成功' },
    message: { type: 'string', description: '结果说明或文件内容' },
  },
}

const renderMsg = (_args, v) => [{ type: 'text', text: v?.message ?? String(v) }]

export function apply(ctx, rawConfig = {}) {
  const cfg = normalizeConfig(rawConfig)
  const logger = ctx.logger ? ctx.logger('design-ledger') : console

  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    logger.warn?.('ctx.tools 不可用，design-ledger 不注册工具')
    return
  }

  const disposers = []

  disposers.push(ctx.tools.register({
    name: 'ledger_append',
    description:
      '追加一条主人要求/设计变更记录到指定项目的更新日志（真值层，append-only，按项目分文件）。日志是唯一真相，每条必填依据。',
    parameters: {
      type: 'object',
      properties: {
        project: str('项目名（即项目文件夹名，如 privhub）'),
        change: str('变更内容：改了什么'),
        reason: str('依据：主人哪句话/哪个决策'),
        section: str('涉及的分册与小节（如 B1-2.4），无则填 无'),
      },
      required: ['project', 'change', 'reason'],
    },
    output: { schema: MSG_SCHEMA, render: renderMsg },
    async execute({ project, change, reason, section = '无' }) {
      try {
        const name = safeName(project)
        const { writeFile, appendFile, mkdir, readFile } = await import('node:fs/promises')
        const path = await import('node:path')
        const logPath = path.join(cfg.projectsRoot, 'logs', `${name}.log.md`)
        await mkdir(path.join(cfg.projectsRoot, 'logs'), { recursive: true })
        let head = ''
        try {
          const existing = await readFile(logPath, 'utf8')
          if (!existing) head = `# ${name} 更新日志（真值层 · append-only）\n\n`
        } catch {
          head = `# ${name} 更新日志（真值层 · append-only）\n\n`
        }
        const entry = `## ${now()}\n- 变更: ${change}\n- 依据: ${reason}\n- 位置: ${section}\n- 状态: 生效\n\n`
        if (head) await writeFile(logPath, head + entry, 'utf8')
        else await appendFile(logPath, entry, 'utf8')
        logger.info?.('appended to %s', logPath)
        return { ok: true, message: `已记录到 ${logPath}` }
      } catch (e) {
        return { ok: false, message: `记录失败: ${e.message}` }
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'ledger_board',
    description:
      '依据指定项目的更新日志生成/更新该项目的看板文件（推理层：当前生效状态汇总）。content 由智能体根据日志推理产出。',
    parameters: {
      type: 'object',
      properties: {
        project: str('项目名'),
        content: str('看板全文（智能体依据日志推理生成的当前状态汇总，Markdown）'),
      },
      required: ['project', 'content'],
    },
    output: { schema: MSG_SCHEMA, render: renderMsg },
    async execute({ project, content }) {
      try {
        const name = safeName(project)
        const { writeFile, mkdir } = await import('node:fs/promises')
        const path = await import('node:path')
        const boardPath = path.join(cfg.projectsRoot, 'boards', `${name}.board.md`)
        await mkdir(path.join(cfg.projectsRoot, 'boards'), { recursive: true })
        const doc = `# ${name} 看板（推理层 · 由更新日志推算）\n> 更新时间: ${now()}\n\n${content}\n`
        await writeFile(boardPath, doc, 'utf8')
        return { ok: true, message: `看板已更新: ${boardPath}` }
      } catch (e) {
        return { ok: false, message: `看板更新失败: ${e.message}` }
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'ledger_read',
    description: '读取指定项目的更新日志全文或看板全文。',
    parameters: {
      type: 'object',
      properties: {
        project: str('项目名'),
        kind: str('log 或 board'),
      },
      required: ['project', 'kind'],
    },
    output: { schema: MSG_SCHEMA, render: renderMsg },
    async execute({ project, kind }) {
      const name = safeName(project)
      const { readFile } = await import('node:fs/promises')
      const path = await import('node:path')
      const p = kind === 'board'
        ? path.join(cfg.projectsRoot, 'boards', `${name}.board.md`)
        : path.join(cfg.projectsRoot, 'logs', `${name}.log.md`)
      try {
        return { ok: true, message: await readFile(p, 'utf8') }
      } catch {
        return { ok: true, message: `（尚无文件：${p}）` }
      }
    },
  }))

  return () => disposers.forEach((d) => d?.())
}
