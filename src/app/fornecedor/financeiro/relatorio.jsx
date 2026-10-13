'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { CampoSelecao } from '@/componentes/campo';
import { descreverPeriodo, nomeDoArquivo, rotuloMesTitulo } from '@/lib/relatorio-financeiro';
import SecaoFinanceiro from './secao';

// RF056 / UC 032 — exportação do relatório financeiro mensal, a partir do
// painel financeiro (passos 2 a 8).
//
// O arquivo é buscado com fetch, e não por um link direto para a rota: se
// a sessão tiver expirado ou o servidor recusar o mês, a resposta é uma
// mensagem de erro em JSON, e um link abriria esse JSON cru numa aba nova.
// Assim o erro aparece aqui, ao lado do botão que a pessoa clicou.

const OPCOES_FORMATO = [
  { valor: 'pdf', rotulo: 'PDF', detalhe: 'Para guardar, enviar ou imprimir.', Icone: FileText },
  { valor: 'xlsx', rotulo: 'Excel', detalhe: 'Planilha para conferir e somar os valores.', Icone: FileSpreadsheet },
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

  const detalheFormato = OPCOES_FORMATO.find((opcao) => opcao.valor === formato).detalhe;

  return (
    <SecaoFinanceiro
      id="secao-relatorio"
      titulo="Relatório mensal"
      descricao="Os repasses liberados no mês, com a comissão retida e o valor líquido recebido.">
      <form onSubmit={exportar} className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          {/* A dica diz sempre qual período entra no arquivo. Antes ela só
              aparecia no mês em andamento, e as duas colunas ficavam com
              alturas diferentes conforme o mês escolhido. */}
          <CampoSelecao
            label="Mês de referência"
            name="relatorio-mes"
            value={mes}
            onChange={(evento) => setMes(evento.target.value)}
            dica={descreverPeriodo(mes, emAndamento)}>
            {meses.map((chave) => (
              <option key={chave} value={chave}>{rotuloMesTitulo(chave)}</option>
            ))}
          </CampoSelecao>

          {/* UC 032, passo 3 — formato desejado.
              Um controle só, com as duas opções lado a lado, e não dois
              cartões: cartão dentro do cartão do formulário era justamente
              o que tirava a clareza da seção. A borda e a altura são as do
              select ao lado, para os dois controles formarem uma linha. O
              para que serve cada formato desce para a dica, como no mês. */}
          <fieldset className="min-w-0">
            <legend className="mb-1.5 block text-sm font-medium text-slate-700">Formato</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-festa-200 bg-white p-1">
              {OPCOES_FORMATO.map(({ valor, rotulo, Icone }) => (
                <label key={valor}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-festa-600/40 ${
                    formato === valor
                      ? 'bg-festa-600 text-white'
                      : 'text-slate-700 hover:bg-festa-50 hover:text-festa-700'}`}>
                  <input type="radio" name="relatorio-formato" value={valor}
                    id={`relatorio-formato-${valor}`}
                    checked={formato === valor}
                    onChange={() => setFormato(valor)}
                    className="sr-only" />
                  <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {rotulo}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">{detalheFormato}</p>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Valores ainda em carência entram no relatório do mês em que forem liberados.
          </p>
          <button type="submit" disabled={gerando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" />
            {gerando ? 'Gerando…' : 'Exportar relatório'}
          </button>
        </div>

        {erro && <p role="alert" className="mt-3 text-sm text-perigo-700">{erro}</p>}
      </form>
    </SecaoFinanceiro>
  );
}
