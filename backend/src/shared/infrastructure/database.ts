import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Prisma } from "../../generated/prisma/client.js"
import { Failure } from "@cardapio/domain/failure"
import { postgresPoolConfig, type DatabaseConfig } from "./postgres-config.js"
export type { DatabaseConfig } from "./postgres-config.js"

export type Transaction = Prisma.TransactionClient
export class Database {
  readonly client: PrismaClient
  constructor(config: DatabaseConfig, onPoolFailure: () => void = () => {}) {
    const adapter = new PrismaPg(postgresPoolConfig(config), {
      onPoolError: () => {
        try {
          onPoolFailure()
        } catch {
          /* Diagnostic sinks cannot crash the pool. */
        }
      },
    })
    this.client = new PrismaClient({ adapter, log: [], errorFormat: "minimal" })
  }
  async run<T>(action: (client: PrismaClient) => Promise<T>): Promise<T> {
    try {
      return await action(this.client)
    } catch (error) {
      if (error instanceof Failure) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002" || retryableTransaction(error))
          throw new Failure(
            "CONFLICT",
            "Outra alteração entrou em conflito. Atualize os dados e tente novamente.",
            {},
            "database_conflict",
          )
        if (["P2003", "P2025"].includes(error.code))
          throw new Failure(
            "NOT_FOUND",
            "O recurso solicitado não está disponível.",
            {},
            "database_reference",
          )
      }
      throw new Failure(
        "STORAGE_UNAVAILABLE",
        "O banco está indisponível. Tente novamente em instantes.",
        {},
        error instanceof Prisma.PrismaClientKnownRequestError &&
          /^P[0-9]{4}$/.test(error.code)
          ? `database_${error.code}`
          : error instanceof Prisma.PrismaClientValidationError
            ? "database_query_validation"
            : "database_unavailable",
      )
    }
  }
  /** Database-only callbacks: retry only transactions PostgreSQL has certainly rolled back. */
  transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.run(async (client) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await client.$transaction(action, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 15000,
          })
        } catch (error) {
          if (!retryableTransaction(error) || attempt >= 2) throw error
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
        }
      }
    })
  }
  /** Coherent, read-only snapshots without serializable predicate conflicts. */
  snapshot<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.run((client) =>
      client.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`
          return action(tx)
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: 5000,
          timeout: 15000,
        },
      ),
    )
  }
  async connect() {
    await this.run(async (client) => {
      await client.$connect()
      await client.$queryRaw`SELECT 1`
    })
  }
  async close() {
    await this.client.$disconnect()
  }
}

export function retryableTransaction(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" ||
      (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))
  )
}
