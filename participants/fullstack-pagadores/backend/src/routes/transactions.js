import prisma from '../db.js'

const BRANDS = {
  '3': { name: 'amex', fee: 0.035 },
  '4': { name: 'visa', fee: 0.025 },
  '5': { name: 'mastercard', fee: 0.03 },
  '6': { name: 'elo', fee: 0.04 },
}

let writeQueue = Promise.resolve()

function serializeWrite(operation) {
  const result = writeQueue.then(operation, operation)
  writeQueue = result.catch(() => {})
  return result
}

function toTransactionResponse(transaction) {
  return {
    id: transaction.id,
    status: transaction.status,
    card_last4: transaction.cardLast4,
    card_brand: transaction.cardBrand,
    holder_name: transaction.holderName,
    amount_cents: transaction.amountCents,
    installments: transaction.installments,
    installment_amount: transaction.installmentAmount,
    total_with_interest: transaction.totalWithInterest,
    fee_cents: transaction.feeCents,
    net_amount: transaction.netAmount,
    description: transaction.description,
    created_at: transaction.createdAt.toISOString(),
  }
}

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 422
  return error
}

function parseRequest(body = {}) {
  const { card_number: cardNumber, holder_name: holderName, expiration, cvv,
    amount_cents: amountCents, installments = 1, description, idempotency_key: idempotencyKey } = body
  if (!/^\d{16}$/.test(cardNumber || '')) throw validationError('card_number invalido')
  if (!/^\d{3,4}$/.test(cvv || '')) throw validationError('cvv invalido')
  if (typeof holderName !== 'string' || !holderName.trim() || holderName.length > 50 || /<[^>]*>/.test(holderName)) {
    throw validationError('holder_name invalido')
  }
  if (!/^((0[1-9])|(1[0-2]))\/\d{2}$/.test(expiration || '')) throw validationError('expiration invalido')
  const [month, year] = expiration.split('/').map(Number)
  const now = new Date()
  const expirationDate = new Date(2000 + year, month)
  if (expirationDate <= new Date(now.getFullYear(), now.getMonth())) throw validationError('cartao vencido')
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 1000000) throw validationError('amount_cents invalido')
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) throw validationError('installments invalido')
  if (typeof description !== 'string' || !description.trim() || description.length > 100) throw validationError('description invalida')
  const brand = BRANDS[cardNumber[0]] || (cardNumber.startsWith('9999') ? { name: 'unknown', fee: 0 } : null)
  if (!brand) throw validationError('bandeira desconhecida')
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !idempotencyKey.trim())) {
    throw validationError('idempotency_key invalida')
  }
  return { cardNumber, holderName: holderName.trim(), amountCents, installments, description, idempotencyKey, brand }
}

export default async function (fastify) {

  fastify.get('/health', async () => ({ status: 'ok' }))

  fastify.get('/balance', async (req, reply) => {
    const [approved, declined, refunded] = await Promise.all([
      prisma.transaction.aggregate({ _sum: { netAmount: true }, _count: { _all: true }, where: { status: 'approved' } }),
      prisma.transaction.count({ where: { status: 'declined' } }),
      prisma.transaction.count({ where: { status: 'refunded' } }),
    ])
    return { balance_cents: approved._sum.netAmount || 0, total_approved: approved._count._all, total_declined: declined, total_refunded: refunded }
  })

  fastify.post('/transactions', async (req, reply) => {
    try {
      const input = parseRequest(req.body)
      const result = await serializeWrite(async () => {
        if (input.idempotencyKey) {
          const existing = await prisma.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
          if (existing) return { transaction: existing, duplicate: true }
        }
        const monthlyRate = input.installments === 1 ? 0 : input.installments <= 6 ? 0.02 : 0.04
        const totalWithInterest = Math.ceil(input.amountCents * Math.pow(1 + monthlyRate, input.installments))
        const installmentAmount = Math.ceil(totalWithInterest / input.installments)
        if (installmentAmount < 1000) throw validationError('parcela abaixo do minimo')
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const usedToday = await prisma.transaction.aggregate({
          _sum: { amountCents: true },
          where: { cardLast4: input.cardNumber.slice(-4), status: { in: ['approved', 'refunded'] }, createdAt: { gte: startOfDay } },
        })
        const declined = input.cardNumber.startsWith('9999') || (usedToday._sum.amountCents || 0) + input.amountCents > 500000
        const feeCents = Math.round(input.amountCents * input.brand.fee)
        const transaction = await prisma.transaction.create({
          data: {
            status: declined ? 'declined' : 'approved', cardLast4: input.cardNumber.slice(-4), cardBrand: input.brand.name,
            holderName: input.holderName, amountCents: input.amountCents, installments: input.installments, installmentAmount,
            totalWithInterest, feeCents, netAmount: declined ? 0 : input.amountCents - feeCents,
            description: input.description, idempotencyKey: input.idempotencyKey,
          },
        })
        return { transaction, duplicate: false }
      })
      reply.code(result.duplicate ? 200 : 201).send(toTransactionResponse(result.transaction))
    } catch (error) {
      reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })

  fastify.get('/transactions/:id', async (req, reply) => {
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } })
    if (!transaction) return reply.code(404).send({ error: 'Transacao nao encontrada' })
    return toTransactionResponse(transaction)
  })

  fastify.get('/transactions', async (req, reply) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10))
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.transaction.count(),
    ])
    return { data: transactions.map(toTransactionResponse), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } }
  })

  fastify.post('/transactions/:id/refund', async (req, reply) => {
    try {
      const updated = await serializeWrite(async () => prisma.transaction.updateMany({ where: { id: req.params.id, status: 'approved' }, data: { status: 'refunded' } }))
      if (updated.count !== 1) return reply.code(422).send({ error: 'Transacao nao pode ser estornada' })
      const refunded = await prisma.transaction.findUnique({ where: { id: req.params.id } })
      return toTransactionResponse(refunded)
    } catch (error) {
      return reply.code(500).send({ error: error.message })
    }
  })
}
