import 'dotenv/config'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

const configuredUrl = process.env.DATABASE_URL || 'file:../data.db'
const databasePath = configuredUrl.startsWith('file:') ? resolve(import.meta.dirname, '..', '..', 'data.db') : configuredUrl
const database = new Database(databasePath.replaceAll('\\', '/'))
const toModel = row => row && ({
	id: row.id, status: row.status, cardLast4: row.card_last4, cardBrand: row.card_brand,
	holderName: row.holder_name, amountCents: row.amount_cents, installments: row.installments,
	installmentAmount: row.installment_amount, totalWithInterest: row.total_with_interest,
	feeCents: row.fee_cents, netAmount: row.net_amount, description: row.description,
	idempotencyKey: row.idempotency_key, createdAt: new Date(row.created_at),
})

const whereClause = where => {
	if (!where) return { sql: '', values: [] }
	const conditions = []
	const values = []
	if (where.id) { conditions.push('id = ?'); values.push(where.id) }
	if (where.idempotencyKey) { conditions.push('idempotency_key = ?'); values.push(where.idempotencyKey) }
	if (where.cardLast4) { conditions.push('card_last4 = ?'); values.push(where.cardLast4) }
	if (where.status?.in) { conditions.push(`status IN (${where.status.in.map(() => '?').join(',')})`); values.push(...where.status.in) }
	else if (where.status) { conditions.push('status = ?'); values.push(where.status) }
	if (where.createdAt?.gte) { conditions.push('created_at >= ?'); values.push(where.createdAt.gte.toISOString()) }
	return { sql: conditions.join(' AND '), values }
}

const prisma = {
	transaction: {
		aggregate({ _sum, _count, where } = {}) {
			const clause = whereClause(where)
			const row = database.prepare(`SELECT ${_sum?.netAmount ? 'SUM(net_amount) AS netAmount' : 'NULL AS netAmount'}, ${_sum?.amountCents ? 'SUM(amount_cents) AS amountCents' : 'NULL AS amountCents'}, ${_count?._all ? 'COUNT(*) AS count' : '0 AS count'} FROM transactions${clause.sql ? ` WHERE ${clause.sql}` : ''}`).get(...clause.values)
			return { _sum: { netAmount: row.netAmount, amountCents: row.amountCents }, _count: { _all: row.count } }
		},
		count({ where } = {}) {
			const clause = whereClause(where)
			return database.prepare(`SELECT COUNT(*) AS count FROM transactions${clause.sql ? ` WHERE ${clause.sql}` : ''}`).get(...clause.values).count
		},
		findUnique({ where }) {
			const key = where.idempotencyKey ? 'idempotency_key' : 'id'
			const value = where.idempotencyKey || where.id
			return toModel(database.prepare(`SELECT * FROM transactions WHERE ${key} = ? LIMIT 1`).get(value))
		},
		findMany({ orderBy, skip = 0, take = 10 } = {}) {
			const order = orderBy?.createdAt === 'desc' ? 'DESC' : 'ASC'
			return database.prepare(`SELECT * FROM transactions ORDER BY created_at ${order} LIMIT ? OFFSET ?`).all(take, skip).map(toModel)
		},
		create({ data }) {
			const transaction = {
				id: randomUUID(), ...data,
			}
			database.prepare(`INSERT INTO transactions (id, status, card_last4, card_brand, holder_name, amount_cents, installments, installment_amount, total_with_interest, fee_cents, net_amount, description, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(transaction.id, transaction.status, transaction.cardLast4, transaction.cardBrand, transaction.holderName, transaction.amountCents, transaction.installments, transaction.installmentAmount, transaction.totalWithInterest, transaction.feeCents, transaction.netAmount, transaction.description, transaction.idempotencyKey || null)
			return toModel(database.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction.id))
		},
		updateMany({ where, data }) {
			const clause = whereClause(where)
			const result = database.prepare(`UPDATE transactions SET status = ?${clause.sql ? ` WHERE ${clause.sql}` : ''}`).run(data.status, ...clause.values)
			return { count: result.changes }
		},
	},
}

export default prisma
