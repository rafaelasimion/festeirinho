import { NextResponse } from 'next/server';
import { obterFornecedorLogado } from '@/lib/autorizacao';
import { confirmarConclusoesVencidas } from '@/lib/conclusao-servidor';
import { liberarRepassesVencidos } from '@/lib/repasse-servidor';
import { FORMATOS, lerMes, mesAtual, nomeDoArquivo } from '@/lib/relatorio-financeiro';
import { buscarRelatorioMensal } from '@/lib/relatorio-financeiro-servidor';
import { montarPdfRelatorio } from '@/lib/relatorio-financeiro-pdf';
import { montarXlsxRelatorio } from '@/lib/relatorio-financeiro-xlsx';

// RF056 / UC 032 / RN058 — exportação do relatório financeiro mensal.
//
// GET /api/fornecedor/relatorio?mes=AAAA-MM&formato=pdf|xlsx
//
// Só o próprio fornecedor exporta, e só o dele: o id vem da sessão, nunca
// da URL. Não há id de fornecedor na requisição que alguém pudesse trocar.
export async function GET(request) {
  const { erro, fornecedor } = await obterFornecedorLogado();
  if (erro) return erro;

  const parametros = request.nextUrl.searchParams;

  // UC 032, passos 3 e 4 — mês/ano de referência e formato.
  const periodo = lerMes(parametros.get('mes'));
  if (!periodo) {
    return NextResponse.json({ erro: 'Escolha o mês de referência.' }, { status: 400 });
  }
  // Comparação de texto: 'AAAA-MM' ordena igual à data que representa.
  if (periodo.chave > mesAtual()) {
    return NextResponse.json(
      { erro: 'O relatório pode ser gerado para o mês atual ou para meses anteriores.' },
      { status: 400 }
    );
  }

  const formato = parametros.get('formato');
  if (!Object.hasOwn(FORMATOS, formato)) {
    return NextResponse.json({ erro: 'Escolha o formato: PDF ou Excel.' }, { status: 400 });
  }

  // As mesmas rotinas que o painel financeiro roda ao abrir: uma conclusão
  // confirmada automaticamente agora pode ser a que destrava um repasse, e
  // um repasse que saiu da carência hoje precisa entrar no relatório de
  // hoje. Sem isto, o relatório do mês atual podia mostrar menos que o
  // painel aberto ao lado.
  await confirmarConclusoesVencidas();
  await liberarRepassesVencidos();

  let arquivo;
  try {
    // UC 032, passo 6 (e fluxo 6a, que é o mesmo caminho com a lista vazia).
    const relatorio = await buscarRelatorioMensal(fornecedor.id, periodo);
    // Passo 7.
    arquivo = formato === 'pdf'
      ? await montarPdfRelatorio(relatorio)
      : await montarXlsxRelatorio(relatorio);
  } catch (falha) {
    console.error('[relatorio financeiro]', falha);
    return NextResponse.json(
      { erro: 'Não foi possível gerar o relatório. Tente de novo em instantes.' },
      { status: 500 }
    );
  }

  // Passo 8 — attachment, e não inline como o comprovante: o caso de uso
  // pede download, e uma planilha não abre no navegador de qualquer jeito.
  return new Response(arquivo, {
    headers: {
      'Content-Type': FORMATOS[formato].tipo,
      'Content-Disposition': `attachment; filename="${nomeDoArquivo(periodo.chave, formato)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
