import { useState, useEffect } from 'react'
import { Link } from 'react-router'

const initialForm = { card_number: '', holder_name: '', expiration: '', cvv: '', amount_cents: '', installments: '1', description: '' }
const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Dashboard() {
  const [form, setForm] = useState(initialForm)
  const [balance, setBalance] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadBalance() {
    const response = await fetch('/api/balance')
    if (response.ok) setBalance(await response.json())
  }

  useEffect(() => { loadBalance() }, [])

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setFeedback(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount_cents: Number(form.amount_cents), installments: Number(form.installments), idempotency_key: crypto.randomUUID() }),
      })
      const data = await response.json()
      if (response.ok && data.status === 'approved') { setFeedback({ type: 'success', text: 'Pagamento aprovado', detail: data.id }); setForm(initialForm) }
      else setFeedback({ type: 'error', text: data.error || 'Pagamento recusado' })
      await loadBalance()
    } catch { setFeedback({ type: 'error', text: 'Nao foi possivel conectar a API' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="page dashboard-page">
      <div className="page-heading"><div><p className="kicker">TERCA-FEIRA, 15 DE SETEMBRO</p><h1>Bom dia, equipe.</h1><p className="page-subtitle">Acompanhe sua operacao e crie uma nova cobranca.</p></div><Link className="text-link" to="/history">Ver todas as transacoes <span>→</span></Link></div>
      <section className="metrics-grid">
        <article className="metric-card metric-primary"><span className="metric-label">Saldo liquido</span><strong className="display-balance">{money(balance?.balance_cents)}</strong><span className="metric-note"><i /> Valor acumulado aprovado</span></article>
        <article className="metric-card"><span className="metric-label">Aprovadas</span><strong className="display-total-approved">{balance?.total_approved ?? '—'}</strong><span className="metric-note positive">+ pagamentos processados</span></article>
        <article className="metric-card"><span className="metric-label">Recusadas</span><strong className="display-total-declined">{balance?.total_declined ?? '—'}</strong><span className="metric-note neutral">Requerem atencao</span></article>
        <article className="metric-card"><span className="metric-label">Estornadas</span><strong className="display-total-refunded">{balance?.total_refunded ?? '—'}</strong><span className="metric-note neutral">Devolucoes realizadas</span></article>
      </section>
      <section className="workspace-grid">
        <div className="panel checkout-panel"><div className="panel-heading"><div><span className="panel-index">01 / NOVA COBRANCA</span><h2>Receba um pagamento</h2></div><span className="secure-tag">● seguro</span></div>
          <form className="payment-form" onSubmit={submit}>
            <label className="field full"><span>Numero do cartao</span><input className="input-card-number" name="card_number" value={form.card_number} onChange={updateField} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength="16" required /></label>
            <label className="field full"><span>Nome do titular</span><input className="input-holder-name" name="holder_name" value={form.holder_name} onChange={updateField} placeholder="Como aparece no cartao" required /></label>
            <label className="field"><span>Validade</span><input className="input-expiration" name="expiration" value={form.expiration} onChange={updateField} placeholder="MM/AA" maxLength="5" required /></label>
            <label className="field"><span>CVV</span><input className="input-cvv" name="cvv" value={form.cvv} onChange={updateField} placeholder="123" maxLength="4" inputMode="numeric" required /></label>
            <label className="field"><span>Valor da cobranca</span><div className="input-prefix"><b>R$</b><input className="input-amount" name="amount_cents" type="number" min="1" value={form.amount_cents} onChange={updateField} placeholder="0,00" required /></div></label>
            <label className="field"><span>Parcelamento</span><select className="select-installments" name="installments" value={form.installments} onChange={updateField}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}x sem juros*</option>)}</select></label>
            <label className="field full"><span>Descricao da cobranca</span><input className="input-description" name="description" value={form.description} onChange={updateField} placeholder="Ex.: Plano profissional - setembro" required /></label>
            {feedback && <div className={`feedback feedback-${feedback.type}`}><strong>{feedback.text}</strong>{feedback.detail && <small>Codigo: {feedback.detail}</small>}</div>}
            <button className="btn-pay" type="submit" disabled={submitting}>{submitting ? 'Processando...' : 'Processar pagamento'} <span>↗</span></button>
          </form><p className="form-footnote">Os dados do cartao sao utilizados somente para autorizacao.</p>
        </div>
        <aside className="panel insight-panel"><span className="panel-index">02 / COMO FUNCIONA</span><h2>Uma operacao mais simples.</h2><p>O Pagadores organiza cada etapa do seu recebimento em um so lugar.</p><div className="insight-list"><div><b>01</b><span><strong>Autorize</strong><small>Validacao instantanea do pagamento.</small></span></div><div><b>02</b><span><strong>Acompanhe</strong><small>Saldo e status sempre atualizados.</small></span></div><div><b>03</b><span><strong>Concilie</strong><small>Historico pronto para sua analise.</small></span></div></div><Link to="/history" className="insight-link">Explorar historico <span>→</span></Link></aside>
      </section>
    </div>
  )
}
