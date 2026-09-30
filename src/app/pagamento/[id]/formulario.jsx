'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Barcode, CreditCard, Plus } from 'lucide-react';
import { CampoSelecao } from '@/componentes/campo';
import CartaoSolicitacao, { AvisoCartao } from '@/componentes/cartao-solicitacao';
import Etiqueta from '@/componentes/etiqueta';
import { formatarPreco, ROTULO_FORMA_PAGAMENTO } from '@/lib/solicitacao';
import { rotuloCartao } from '@/lib/cartao';

function formatarDataHora(valor) {
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// Cada forma de pagamento é um cartão escolhível, no mesmo molde da
// escolha entre pessoa física e jurídica no cadastro: o rádio fica
// invisível e o cartão inteiro é o alvo de toque — no celular, a diferença
// entre acertar e errar. O foco do teclado aparece pela borda do cartão
// (focus-within), já que o rádio em si não é visível.
//
// O <select> do cartão fica FORA do <label>, e não dentro: um controle de
// formulário aninhado noutro é HTML ambíguo, e clicar no select acabaria
// acionando o rádio junto.
function OpcaoPagamento({
  valor, Icone, titulo, descricao, selecionado, desabilitado, aoEscolher, children,
}) {
  const moldura = desabilitado
    ? 'border-slate-200 bg-slate-50'
    : selecionado
      ? 'border-festa-600 bg-festa-50'
      : 'border-slate-200 bg-white hover:border-festa-200';

  const selo = desabilitado
    ? 'bg-slate-200 text-slate-400'
    : selecionado
      ? 'bg-festa-600 text-white'
      : 'bg-festa-100 text-festa-600';

  return (
    <div className={`relative rounded-xl border p-4 transition-colors
      focus-within:ring-2 focus-within:ring-festa-600/40 ${moldura}`}>
      <label className={`flex items-center gap-3 ${desabilitado ? '' : 'cursor-pointer'}`}>
        <input type="radio" name="forma" value={valor}
          checked={selecionado} disabled={desabilitado}
          onChange={(evento) => aoEscolher(evento.target.value)}
          className="sr-only" />

        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selo}`}>
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className={`block font-medium ${desabilitado ? 'text-slate-500' : 'text-slate-900'}`}>
            {titulo}
          </span>
          <span className="mt-0.5 block text-sm text-slate-500">{descricao}</span>
        </span>

        {/* Bolinha de rádio desenhada, à direita, como no protótipo: o
            rádio nativo está invisível, e sem ela o cartão não anuncia que
            faz parte de uma escolha entre várias. Um "check" diria
            "concluído"; a bolinha diz "esta é a escolhida". */}
        <span aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            desabilitado ? 'border-slate-300'
              : selecionado ? 'border-festa-600' : 'border-slate-300'}`}>
          {selecionado && <span className="h-2.5 w-2.5 rounded-full bg-festa-600" />}
        </span>
      </label>

      {/* Só quando a opção está escolhida — ou quando está bloqueada e o
          conteúdo é justamente a saída para desbloqueá-la. */}
      {(selecionado || desabilitado) && children && (
        <div className="mt-4 border-t border-slate-200 pt-4">{children}</div>
      )}
    </div>
  );
}

// O mesmo resumo que identifica a contratação em "Minhas solicitações".
// Quem chega aqui vindo de uma lista de pedidos precisa reconhecer, de
// relance, qual deles está pagando — nome e fornecedor em texto corrido
// não faziam isso.
function ResumoDaContratacao({ pagamento, etiqueta, children }) {
  return (
    <CartaoSolicitacao
      como="div"
      titulo={pagamento.servico}
      subtitulo={pagamento.fornecedor}
      preco={formatarPreco(pagamento.valorBruto)}
      foto={pagamento.fotoPrincipal}
      etiquetas={etiqueta}
      quando={`${formatarDataHora(pagamento.dataHoraEvento)} · ${pagamento.duracao}h`}
      convidados={`${pagamento.numeroConvidados} convidados`}
      local={`${pagamento.cidade}/${pagamento.estado}`}>
      {children}
    </CartaoSolicitacao>
  );
}

export default function FormularioPagamento({
  pagamento,
  boletoDisponivel,
  diasMinimosBoleto,
  cartoes = [],
}) {
  const router = useRouter();
  const [forma, setForma] = useState('pix');
  const [idCartao, setIdCartao] = useState(cartoes[0]?.id ?? '');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  if (pagamento.status === 'pago') {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Pagamento confirmado</h1>
        <p className="mb-6 mt-1 text-slate-600">
          Sua contratação está confirmada.
        </p>

        <ResumoDaContratacao pagamento={pagamento}
          etiqueta={<Etiqueta tom="sucesso" formato="ponto">Pago</Etiqueta>}>
          {/* Forma e identificador ficam abaixo do resumo: são o recibo,
              não a identificação da contratação. O valor não se repete
              aqui, já está no cabeçalho do resumo. */}
          <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div>
              <dt className="inline font-medium text-slate-700">Forma: </dt>
              <dd className="inline text-slate-600">
                {ROTULO_FORMA_PAGAMENTO[pagamento.formaPagamento] ?? pagamento.formaPagamento}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-slate-700">Identificador: </dt>
              <dd className="inline font-mono text-slate-600">{pagamento.idTransacao}</dd>
            </div>
          </dl>
        </ResumoDaContratacao>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/minhas-solicitacoes"
            className="inline-flex items-center rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            Ver minhas solicitações
          </Link>
          {/* RF058 / UC 034 — o comprovante existe a partir daqui. */}
          <a href={`/api/comprovantes/${pagamento.idSolicitacao}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
            Baixar comprovante
          </a>
        </div>
      </main>
    );
  }

  if (pagamento.status !== 'pendente') {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Pagamento indisponível</h1>
        <p className="mb-6 mt-1 text-slate-600">
          {pagamento.status === 'expirado'
            ? 'O prazo de pagamento se esgotou e a solicitação foi cancelada.'
            : 'Este pagamento foi encerrado após o limite de tentativas recusadas.'}
        </p>

        <ResumoDaContratacao pagamento={pagamento}
          etiqueta={<Etiqueta tom="perigo" formato="ponto">
            {pagamento.status === 'expirado' ? 'Expirado' : 'Recusado'}
          </Etiqueta>} />

        <Link href="/minhas-solicitacoes"
          className="mt-6 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Voltar
        </Link>
      </main>
    );
  }

  const tentativasRestantes = 3 - pagamento.numeroTentativas;

  async function pagar(resultado) {
    setErro('');
    setAviso('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/pagamentos/${pagamento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formaPagamento: forma,
          resultado,
          idCartao: forma === 'cartao' ? Number(idCartao) : undefined,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível processar o pagamento.');
        router.refresh();
        return;
      }

      if (dados.status === 'pago') {
        router.refresh();
        return;
      }

      setAviso(dados.mensagem ?? '');
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Pagamento</h1>

      <ResumoDaContratacao pagamento={pagamento}
        etiqueta={<Etiqueta tom="atencao" formato="ponto">Aguardando pagamento</Etiqueta>}>
        <AvisoCartao tom="atencao">
          Pague até {formatarDataHora(pagamento.dataLimite)}. Sem confirmação até lá,
          a solicitação é cancelada automaticamente.
        </AvisoCartao>
      </ResumoDaContratacao>

      <fieldset className="mt-8">
        <legend className="mb-3 text-sm font-medium text-slate-900">
          Forma de pagamento
        </legend>

        <div className="space-y-3">
          <OpcaoPagamento valor="pix" Icone={QrCode} titulo="Pix"
            descricao="Confirmação imediata"
            selecionado={forma === 'pix'} aoEscolher={setForma} />

          {/* RN012 — o boleto leva dias para compensar, então exige
              antecedência. Continua à vista, desabilitado, com o motivo:
              some da lista, a pessoa só ficaria se perguntando. */}
          <OpcaoPagamento valor="boleto" Icone={Barcode} titulo="Boleto"
            descricao={boletoDisponivel
              ? `Exige ao menos ${diasMinimosBoleto} dias de antecedência do evento`
              : `Indisponível: o evento é em menos de ${diasMinimosBoleto} dias`}
            selecionado={forma === 'boleto'} desabilitado={!boletoDisponivel}
            aoEscolher={setForma} />

          {/* RF031 / RF032 — cartão só é escolhível com algum salvo.
              Oferecer a forma sem cartão levaria a um beco sem saída dentro
              da tela; some da lista, a pessoa não saberia que existe. */}
          <OpcaoPagamento valor="cartao" Icone={CreditCard} titulo="Cartão de crédito"
            descricao={cartoes.length > 0
              ? 'Cobrado no cartão salvo'
              : 'Você ainda não tem nenhum cartão salvo'}
            selecionado={forma === 'cartao'} desabilitado={cartoes.length === 0}
            aoEscolher={setForma}>

            {cartoes.length === 0 ? (
              <Link href="/minha-conta/cartoes"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Cadastrar cartão
              </Link>
            ) : (
              <CampoSelecao label="Qual cartão" name="cartao" value={idCartao}
                onChange={(e) => setIdCartao(e.target.value)}>
                {cartoes.map((cartao) => (
                  <option key={cartao.id} value={cartao.id}>
                    {rotuloCartao(cartao)}
                  </option>
                ))}
              </CampoSelecao>
            )}
          </OpcaoPagamento>
        </div>
      </fieldset>

      {pagamento.numeroTentativas > 0 && (
        <p className="mt-4 text-sm text-slate-600">
          Tentativas recusadas: {pagamento.numeroTentativas} de 3.
          {tentativasRestantes > 0 && ` Restam ${tentativasRestantes}.`}
        </p>
      )}

      {aviso && <p className="mt-4 text-sm text-atencao-800">{aviso}</p>}
      {erro && <p className="mt-4 text-sm text-perigo-600">{erro}</p>}

      <div className="mt-8 rounded-lg border border-dashed border-festa-300 bg-festa-50 p-4">
        <p className="text-sm font-medium">Simulação do gateway de pagamento</p>
        <p className="mt-1 text-xs text-slate-600">
          A plataforma não processa pagamentos diretamente: quem aprova ou recusa é
          o gateway externo. Enquanto a integração não existe, escolha abaixo a
          resposta que o gateway devolveria.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={processando}
            onClick={() => pagar('sucesso')}
            className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
            Pagamento aprovado
          </button>
          <button type="button" disabled={processando}
            onClick={() => pagar('recusa')}
            className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50 disabled:opacity-50">
            Pagamento recusado
          </button>
          <button type="button" disabled={processando}
            onClick={() => pagar('erro_tecnico')}
            className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50 disabled:opacity-50">
            Falha técnica
          </button>
        </div>
      </div>

      {/* RF063 / UC 039 — a tela de pagamento é o ponto citado no
          requisito. O número da solicitação vai na URL e vira o contexto
          pré-preenchido da mensagem. */}
      <p className="mt-6 text-center text-sm text-slate-600">
        Algum problema com o pagamento?{' '}
        <Link
          href={`/suporte?assunto=pagamento&origem=pagamento&solicitacao=${pagamento.idSolicitacao}`}
          className="font-medium text-festa-700 hover:underline">
          Falar com o suporte
        </Link>
      </p>
    </main>
  );
}