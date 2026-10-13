'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { CampoSelecao } from '@/componentes/campo';
import { nomeDoArquivo, rotuloMesTitulo } from '@/lib/relatorio-financeiro';

// RF056 / UC 032 — exportação do relatório financeiro mensal, a partir do
// painel financeiro (passos 2 a 8).
//
// O arquivo é buscado com fetch, e não por um link direto para a rota: se
// a sessão tiver expirado ou o servidor recusar o mês, a resposta é uma
// mensagem de erro em JSON, e um link abriria esse JSON cru numa aba nova.
// Assim o erro aparece aqui, ao lado do botão que a pessoa clicou.

const OPCOES_FORMATO = [
  { valor: 'pdf', rotulo: 'PDF', detalhe: 'Para guardar ou imprimir', Icone: FileText },
  { valor: 'xlsx', rotulo: 'Excel', detalhe: 'Para conferir e somar', Icone: FileSpreadsheet },
];

// O nome vem do cabeçalho da resposta; se ele não vier legível, o mesmo
// nome é montado aqui.
function nomeDaResposta(resposta, mes, formato) {
  const cabecalho = resposta.headers.get('Content-Disposition') ?? '';
  const achado = /filename="([^"]+)"/.exec(cabecalho);
  return achado ? achado[1] : nomeDoArquivo(mes, formato);
}

export default function RelatorioMensal({ meses, mesInicial }) {
  const [mes, setMes] = useState(mesInicial);
  const [formato, setFormato] = useState('pdf');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // A lista vem do servidor com o mês atual primeiro. Comparar com ela, e
  // não com o relógio do navegador, mantém a tela de acordo com o servidor
  // mesmo na virada do mês ou com o computador num fuso diferente.
  const emAndamento = mes === meses[0];

  async function exportar(evento) {
    evento.preventDefault();
    setErro('');
    setGerando(true);

    try {
      const resposta = await fetch(
        `/api/fornecedor/relatorio?mes=${encodeURIComponent(mes)}&formato=${formato}`
      );
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        setErro(corpo.erro ?? 'Não foi possível gerar o relatório. Tente de novo em instantes.');
        return;
      }

      // UC 032, passo 8 — o download do arquivo.
      const arquivo = await resposta.blob();
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = nomeDaResposta(resposta, mes, formato);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revogar no mesmo instante cancela o download em alguns navegadores.
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch {
      setErro('Não foi possível gerar o relatório. Confira a sua conexão e tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-slate-900">Relatório mensal</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Os repasses liberados no mês, com a comissão retida e o valor líquido recebido.
      </p>

      <form onSubmit={exportar}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao
            label="Mês de referência"
            name="relatorio-mes"
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
            dica={emAndamento
              ? 'Mês em andamento: entram os repasses liberados até agora.'
              : undefined}>
            {meses.map((chave) => (
              <option key={chave} value={chave}>{rotuloMesTitulo(chave)}</option>
            ))}
          </CampoSelecao>

          {/* UC 032, passo 3 — formato desejado. Dois cartões lado a lado,
              no lugar de um select, porque são só duas opções e cada uma
              diz para que serve. */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Formato</legend>
            <div className="grid grid-cols-2 gap-2">
              {OPCOES_FORMATO.map(({ valor, rotulo, detalhe, Icone }) => (
                <label key={valor}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-festa-600/40 ${
                    formato === valor
                      ? 'border-festa-600 bg-festa-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input type="radio" name="relatorio-formato" value={valor}
                    id={`relatorio-formato-${valor}`}
                    checked={formato === valor}
                    onChange={() => setFormato(valor)}
                    className="sr-only" />
                  <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${
                    formato === valor ? 'text-festa-700' : 'text-slate-500'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{rotulo}</span>
                    <span className="block text-xs text-slate-500">{detalhe}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Valores ainda em carência entram no relatório do mês em que forem liberados.
          </p>
          <button type="submit" disabled={gerando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" />
            {gerando ? 'Gerando…' : 'Exportar relatório'}
          </button>
        </div>

        {erro && <p role="alert" className="text-sm text-perigo-700">{erro}</p>}
      </form>
    </section>
  );
}
