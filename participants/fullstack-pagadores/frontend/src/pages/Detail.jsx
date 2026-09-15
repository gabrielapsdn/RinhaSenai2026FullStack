import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [transaction, setTransaction] = useState(null)
  const [feedback, setFeedback] = useState(null)

  async function load() {
    const response = await fetch(`/api/transactions/${id}`)
    if (response.ok) setTransaction(await response.json())
  }

  useEffect(() => { load() }, [id])

  async function refund() {
    setFeedback(null)
    const response = await fetch(`/api/transactions/${id}/refund`, { method: 'POST' })
    if (response.ok) await load()
    else setFeedback((await response.json()).error || 'Nao foi possivel estornar')
  }

  if (!transaction) return <div className="page loading-page"><span className="loader" /><p>Carregando transacao...</p></div>

  return (
    <div className="page detail-page">
      <Link className="back-link" to="/history">← Voltar para transacoes</Link>
      <div className="detail-heading"><div><p className="kicker">DETALHE DA TRANSACAO</p><h1>Pagamento <span>#{transaction.id.slice(0, 8)}</span></h1><p className="page-subtitle">Criado em {new Date(transaction.created_at).toLocaleString('pt-BR')}</p></div><span className={`transaction-status status-${transaction.status}`}><i />{transaction.status === 'approved' ? 'Aprovada' : transaction.status === 'refunded' ? 'Estornada' : 'Recusada'}</span></div>
      <section className="detail-layout"><div className="panel amount-panel"><span className="panel-index">VALOR DA TRANSACAO</span><strong className="detail-amount">{money(transaction.amount_cents)}</strong><span className="detail-description">{transaction.description}</span><div className="detail-rule" /><div className="detail-summary"><span>Liquido recebido <b>{money(transaction.net_amount)}</b></span><span>Taxa da operacao <b>{money(transaction.fee_cents)}</b></span></div></div>
        <div className="panel detail-info"><span className="panel-index">INFORMACOES</span><div className="info-grid"><span>Cliente<strong className="detail-holder">{transaction.holder_name}</strong></span><span>Cartao<strong className="detail-card">{transaction.card_brand} · •••• {transaction.card_last4}</strong></span><span>Parcelamento<strong>{transaction.installments}x de {money(transaction.installment_amount)}</strong></span><span>Total com juros<strong>{money(transaction.total_with_interest)}</strong></span></div><div className="detail-actions">{feedback && <span className="inline-error">{feedback}</span>}{transaction.status === 'approved' && <button className="btn-refund" onClick={refund}>↺ Estornar pagamento</button>}<button className="secondary-button" onClick={() => navigate('/history')}>Fechar</button></div></div>
      </section>
    </div>
  )
}
