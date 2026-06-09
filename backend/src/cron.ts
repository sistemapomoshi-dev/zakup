import { syncMailboxForUser } from './mail/sync'
import { MoySkladService } from './moysklad/service'
import { RetailService } from './retail/service'
import { createBackendRuntime, type BackendRuntime } from './runtime'
import { createStorageServiceFromEnv } from './storage/service'

type CronTask = (runtime: BackendRuntime) => Promise<void>

const cronTasks = {
  noop: async () => {
    console.log('Cron noop task completed.')
  },
  'db:ping': async ({ prisma }) => {
    await prisma.$queryRaw`SELECT 1`
    console.log('Cron db:ping task completed.')
  },
  'mail:sync-all': async ({ prisma, env }) => {
    const storageService = createStorageServiceFromEnv(env)
    const mailboxes = await prisma.mailboxConnection.findMany({
      where: { syncStatus: { not: 'syncing' } },
      select: { userId: true },
    })
    for (const mailbox of mailboxes) {
      try {
        const result = await syncMailboxForUser(prisma, env, mailbox.userId, storageService)
        console.log(`Synced mailbox for user ${mailbox.userId}:`, result)
      } catch (error) {
        console.error(`Failed to sync mailbox for user ${mailbox.userId}:`, error)
      }
    }
    console.log('Cron mail:sync-all task completed.')
  },
  'moysklad:sync': async ({ prisma, env }) => {
    const service = new MoySkladService(prisma, env)
    if (!service.isConfigured()) {
      console.log('MoySklad is not configured; skipping sync.')
      return
    }
    const result = await service.syncAll()
    console.log('Cron moysklad:sync completed:', result)
  },
  'retail:sync': async ({ prisma, env }) => {
    const service = new RetailService(prisma, env)
    if (!service.isEnabled()) {
      console.log('Retail sync is disabled; skipping.')
      return
    }
    const result = await service.syncAll()
    console.log('Cron retail:sync completed:', result)
  },
} satisfies Record<string, CronTask>

export type CronTaskName = keyof typeof cronTasks

export async function runCronTask(taskName: string, runtime: BackendRuntime) {
  const task = cronTasks[taskName as CronTaskName]

  if (!task) {
    throw new Error(`Unknown cron task "${taskName}". Available tasks: ${Object.keys(cronTasks).join(', ')}`)
  }

  await task(runtime)
}

export async function main(argv: string[] = Bun.argv.slice(2)) {
  const [taskName] = argv

  if (!taskName) {
    console.error(`Cron task name is required. Available tasks: ${Object.keys(cronTasks).join(', ')}`)
    process.exit(1)
  }

  const runtime = createBackendRuntime()

  try {
    await runCronTask(taskName, runtime)
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
