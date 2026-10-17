import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'
import type { ApiConfig } from '../../app/config.js'

export type Transaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export class Database {
  private readonly pool: pg.Pool
  public readonly client: PrismaClient

  constructor(config: ApiConfig) {
    const connectionString = config.database.toString()
    
    this.pool = new pg.Pool({ 
      connectionString,
      // Se em produção com TLS ativado no PostgreSQL
      ssl: config.databaseTls ? { rejectUnauthorized: false } : false
    })

    const adapter = new PrismaPg(this.pool)
    this.client = new PrismaClient({ adapter })
  }

  async run<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return fn(this.client)
  }

  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.client.$transaction(fn)
  }

  async close(): Promise<void> {
    await this.client.$disconnect()
    await this.pool.end()
  }
}