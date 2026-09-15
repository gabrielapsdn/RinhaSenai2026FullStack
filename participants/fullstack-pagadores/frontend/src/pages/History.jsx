import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 10
  const [result, setResult] = useState({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })

  async function load() {
    const response = await fetch(`/api/transactions?page=${page}&limit=${limit}`)
    if (response.ok) setResult(await response.json())
  }

  useEffect(() => { load() }, [page, limit])

  async function refund(id) {
    await fetch(`/api/transactions/${id}/refund`, { method: 'POST' })
    await load()
  }

  function move(nextPage) {
    setSearchParams({ page: String(nextPage), limit: String(limit) })
  }

  return (
    <div className="page history-page">
      <div className="page-heading"><div><p className="kicker">REGISTRO FINANCEIRO</p><h1>Transacoes</h1><p className="page-subtitle">Consulte, acompanhe e gerencie seus recebimentos.</p></div><div className="history-count">{result.pagination.total} registros</div></div>
      <div className="table-toolbar"><span>ULTIMAS MOVIMENTACOES</span><span className="toolbar-line" /><span>Pagina {page} de {result.pagination.total_pages || 1}</span></div>
      <div className="list-transactions">
        {result.data.map(transaction => <article className="transaction-item" key={transaction.id}>
          <Link className="transaction-main" to={`/transaction/${transaction.id}`}><span className={`transaction-icon ${transaction.status}`}>{transaction.card_brand === 'visa' ? 'V' : 'M'}</span><span><strong className="transaction-description">{transaction.description}</strong><small className="transaction-id">#{transaction.id.slice(0, 8)} · •••• {transaction.card_last4}</small></span></Link>
          <span className={`transaction-status status-${transaction.status}`} data-value={transaction.status}><i />{transaction.status === 'approved' ? 'Aprovada' : transaction.status === 'refunded' ? 'Estornada' : 'Recusada'}</span><span className="transaction-date">{date(transaction.created_at)}</span><strong className="transaction-amount">{money(transaction.amount_cents)}</strong>
          {transaction.status === 'approved' && <button className="btn-refund" onClick={() => refund(transaction.id)} title="Estornar transacao">↺</button>}
        </article>)}
        {!result.data.length && <div className="empty-state"><strong>Nenhuma transacao ainda.</strong><span>As novas cobrancas aparecerao aqui.</span></div>}
      </div>
      <nav className="pagination">
        <span className="pagination-total">Mostrando {result.data.length} de {result.pagination.total}</span><span className="pagination-spacer" /><button className="btn-prev-page" disabled={page <= 1} onClick={() => move(page - 1)}>← Anterior</button><span className="pagination-current">{page}</span><button className="btn-next-page" disabled={page >= result.pagination.total_pages} onClick={() => move(page + 1)}>Proxima →</button>
      </nav>
    </div>
  )
}
