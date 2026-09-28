'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Pausar é a ação de saída que o próprio fornecedor controla: ele deixa
// de aparecer para novos clientes sem perder cadastro, serviços ou
// histórico. Suspensão é ação da administração; exclusão é outro fluxo
// (RN044).
//
// Fica na primeira tela do perfil porque é uma chave que se liga e
// desliga com frequência — quem vai viajar na semana que vem não deveria
// procurar por ela dentro de um formulário de edição.

export default function DisponibilidadeFornecedor({ statusInicial }) {
  const router = useRouter();
  const [status, setStatus] = useState(statusInicial);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const ativo = status === 'ativo';

  async function alternar() {
    setErro('');
    setProcessando(true);

    // Atualização otimista: a chave vira na hora e o pedido segue atrás.
    // Se der errado, ela volta. Esperar a resposta para animar deixaria o
    // controle com cara de travado.
    const anterior = status;
    const novo = ativo ? 'pausado' : 'ativo';
    setStatus(novo);

    try {
      const resposta = await fetch('/api/fornecedor/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: ativo ? 'pausar' : 'reativar' }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setStatus(anterior);
        setErro(dados.erro ?? 'Não foi possível alterar a disponibilidade.');
        return;
      }

      setStatus(dados.statusFornecedor);
      // A etiqueta de status no alto da página vem do servidor.
      router.refresh();
    } catch {
      setStatus(anterior);
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">Disponibilidade</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Não afeta solicitações em andamento, apenas impede novas.
          </p>
        </div>

        {/* role="switch" é o que faz o leitor de tela anunciar "ligado" ou
            "desligado" em vez de só "botão". */}
        <button type="button" role="switch" aria-checked={ativo}
          onClick={alternar} disabled={processando}
          aria-label="Disponível para novas solicitações"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            ativo ? 'bg-festa-600' : 'bg-slate-300'}`}>
          <span aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              ativo ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {!ativo && (
        <p className="mt-3 rounded-lg bg-atencao-50 px-3 py-2 text-sm text-atencao-800">
          Seu perfil e seus serviços não aparecem para novos clientes.
        </p>
      )}

      {erro && <p className="mt-3 text-sm text-perigo-600">{erro}</p>}
    </div>
  );
}
