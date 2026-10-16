'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CreditCard, MessageCircle, XCircle, CheckCircle2,
  AlertTriangle, Flag, Download, Headset,
} from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
import FormularioAvaliacao from '@/componentes/formulario-avaliacao';
import DadosReembolso from '@/componentes/dados-reembolso';
import { Bloco } from '@/componentes/bloco';
import Chat from '@/componentes/chat';
import DialogoDenuncia from '@/componentes/dialogo-denuncia';
import FotosContestacao, { LinkProvaPeloSuporte } from '@/componentes/fotos-contestacao';
import TituloPainel from '@/componentes/titulo-painel';
import OpcoesRadio from '@/componentes/opcoes-radio';
import EscolhaFotosContestacao, {
  descartarFotos,
} from '@/componentes/escolha-fotos-contestacao';
import CartaoSolicitacao, {
  AvisoCartao, CartaoRecolhivel,
} from '@/componentes/cartao-solicitacao';
import { BarraAcoes, BotaoAcao, LinkAcao } from '@/componentes/acoes-solicitacao';
import {
  formatarPreco,
  ROTULO_STATUS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  ROTULO_MOTIVO_RECUSA,
  chatAberto,
  situacaoCliente,
} from '@/lib/solicitacao';
import { ROTULO_RESULTADO_DENUNCIA } from '@/lib/denuncia';
import {
  ROTULO_ORIGEM_CANCELAMENTO,
  ROTULO_STATUS_CANCELAMENTO,
  impedimentoParaCancelar,
} from '@/lib/cancelamento';
import {
  MOTIVOS_CONTESTACAO,
  ROTULO_MOTIVO_CONTESTACAO,
  ROTULO_RESULTADO_CONTESTACAO,
  TOM_RESULTADO_CONTESTACAO,
  MINIMO_RELATO_CONTESTACAO,
  MAXIMO_RELATO_CONTESTACAO,
  AVISO_ENVIO_UNICO_CONTESTACAO,
} from '@/lib/contestacao';
import { formatarDataHora } from '@/lib/datas';
import LinhaDoTempo from '@/componentes/linha-do-tempo';

// UC 014, passos 3 e 4 — a página de UMA solicitação.
//
// Até aqui a lista fazia o papel das duas coisas: cada cartão trazia
// dentro de si todos os painéis — pagamento, cancelamento, contestação,
// dados de reembolso, avaliação, denúncia e o chat. Funcionava, mas uma
// solicitação em contestação ocupava três telas de rolagem, e as outras
// cinco da lista ficavam atrás dela.
//
// O caso de uso sempre descreveu dois momentos: "o cliente acessa a lista
// de suas solicitações" e, depois, "o cliente seleciona uma solicitação; o
// sistema exibe os detalhes". A lista voltou a ser lista; o detalhe é
// aqui.
export default function DetalheSolicitacao({
  solicitacao, titular, prazoConfirmacaoHoras, denunciaNoPrazo = true,
}) {
  const router = useRouter();
  // Um painel de cada vez, e agora basta dizer QUAL: a página inteira
  // trata de uma solicitação só, então não há mais o que desempatar.
  const [painel, setPainel] = useState(null);
  const [motivoContestacao, setMotivoContestacao] = useState('');
  const [descricaoContestacao, setDescricaoContestacao] = useState('');
  // RF069-B — fotos escolhidas no formulário, ainda só no navegador. Vão
  // junto com o texto, no mesmo envio (RN069).
  const [fotosContestacao, setFotosContestacao] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  // O erro do envio da contestação aparece dentro do formulário, junto do
  // botão: é ali que a pessoa está olhando, e é ali que ela troca a foto
  // recusada. No topo da página, no celular, ele ficava fora da tela.
  const [erroContestacao, setErroContestacao] = useState('');

  function fecharPainel() {
    setPainel(null);
  }

  // Toda saída do formulário passa por aqui ou pelo envio: as miniaturas
  // seguram os arquivos na memória do navegador até serem liberadas.
  function voltarDaContestacao() {
    descartarFotos(fotosContestacao);
    setFotosContestacao([]);
    setErroContestacao('');
    fecharPainel();
  }

  // UC 042 — a contestação e as fotos num envio só, e numa transação só no
  // servidor (RN069): ou tudo é registrado, ou nada. Se uma foto for
  // recusada, a contestação NÃO fica registrada pela metade — o formulário
  // continua preenchido, e a pessoa troca a foto e envia de novo. Antes eram
  // duas etapas, e uma foto que falhasse ficava para ser anexada depois, num
  // quadro que aceitava mudanças até a decisão.
  async function enviarContestacao() {
    setErroContestacao('');
    setErro('');
    setMensagem('');
    setProcessando(true);

    // FormData, não JSON: o navegador monta o corpo multipart e define o
    // Content-Type sozinho.
    const formulario = new FormData();
    formulario.append('motivo', motivoContestacao);
    formulario.append('descricao', descricaoContestacao);
    fotosContestacao.forEach((foto) => formulario.append('fotos', foto.arquivo));

    try {
      const resposta = await fetch(`/api/solicitacoes/${solicitacao.id}/contestacao`, {
        method: 'POST',
        body: formulario,
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroContestacao(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErroContestacao(dados.erro ?? 'Não foi possível registrar a contestação.');
        return;
      }

      descartarFotos(fotosContestacao);
      setFotosContestacao([]);
      setMotivoContestacao('');
      setDescricaoContestacao('');
      fecharPainel();
      setMensagem('Contestação registrada. A administração vai analisar.');
      router.refresh();
    } catch {
      setErroContestacao('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function acionar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/solicitacoes/${solicitacao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      fecharPainel();
      setMotivoContestacao('');
      setDescricaoContestacao('');
      setMensagem(
        dados.aguardandoDadosRecebimento
          ? 'Cancelamento registrado. Como o pagamento foi por boleto, você precisará informar os dados para receber o reembolso.'
          : textoSucesso
      );
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  const { contestacaoPendente, aguardandoConfirmacao } = situacaoCliente(solicitacao);

  const impedimento = impedimentoParaCancelar({
    status: solicitacao.status,
    dataEvento: solicitacao.data_hora_evento,
    temCancelamento: Boolean(solicitacao.id_cancelamento),
    conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
    contestacaoPendente: solicitacao.status_contestacao === 'pendente',
  });
  const podeCancelar = impedimento === null;

  // O histórico fica acessível mesmo depois de encerrado o canal:
  // é nele que ficou combinado horário de chegada e acesso ao
  // local, e é o que sustenta uma contestação ou denúncia depois.
  const temChat = ['aguardando_pagamento', 'confirmado', 'concluido', 'cancelado']
    .includes(solicitacao.status);
  // RN022 — mas escrever, só dentro da janela. O rótulo segue a
  // mesma regra do servidor para não prometer o que ele recusa.
  const podeEscrever = chatAberto({
    status: solicitacao.status,
    conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
  });
  const podeDenunciar = ['confirmado', 'concluido', 'cancelado']
    .includes(solicitacao.status);

  const pagamento = solicitacao.id_pagamento ? {
    status: solicitacao.status_pagamento,
    valor_bruto: solicitacao.valor_bruto,
    perc_multa_faixa_mais_7d: solicitacao.perc_multa_faixa_mais_7d,
    perc_multa_faixa_7d_48h: solicitacao.perc_multa_faixa_7d_48h,
    perc_multa_faixa_48h_24h: solicitacao.perc_multa_faixa_48h_24h,
    perc_multa_faixa_24h: solicitacao.perc_multa_faixa_24h,
  } : null;

  // Tudo que é alto vai por fora da linha da foto (prop "painel"):
  // dentro dela, um chat de 500px esticava a faixa lateral junto, e a
  // foto virava uma tira.
  const conteudoPainel = painel === null ? null : (
    <div className="space-y-4">

      {painel === 'conversar' && (
        <>
          <Chat
            idSolicitacao={solicitacao.id}
            titulo={`Conversa com ${solicitacao.fornecedor}`}
            aoFechar={() => fecharPainel()}
            aoAlterar={() => router.refresh()} />
        </>
      )}

      {painel === 'cancelar' && (
        <>
          <DialogoCancelamento
            solicitadoPor="cliente"
            dataEvento={solicitacao.data_hora_evento}
            pagamento={pagamento}
            processando={processando}
            aoVoltar={() => fecharPainel()}
            aoCancelar={(motivo) => acionar(
              { acao: 'cancelar', motivo },
              'Cancelamento registrado.'
            )} />
        </>
      )}

      {painel === 'denunciar' && (
        <>
          <DialogoDenuncia
            tipo="fornecedor"
            alvo={{ idSolicitacao: solicitacao.id }}
            aoVoltar={() => fecharPainel()}
            aoConcluir={() => {
              fecharPainel();
              setMensagem('Denúncia registrada. A administração vai analisar.');
              router.refresh();
            }} />
        </>
      )}

      {/* UC 042 — formulário de contestação. Direto no cartão do painel,
          sem uma caixa colorida dentro dele: o título diz o assunto. */}
      {painel === 'contestar' && (
        <div className="space-y-5">
          <TituloPainel icone={AlertTriangle} tom="atencao" titulo="Contestar conclusão">
            A administração analisa e decide sobre o reembolso. Até lá, a conclusão
            não é confirmada automaticamente.
          </TituloPainel>

          <OpcoesRadio nome="motivo-contestacao" legenda="O que aconteceu?" tom="atencao"
            opcoes={MOTIVOS_CONTESTACAO} valor={motivoContestacao}
            aoEscolher={setMotivoContestacao} desabilitado={processando} />

          <div>
            <label htmlFor="descricao-contestacao"
              className="mb-1.5 block text-sm font-medium text-slate-700">
              Descreva o ocorrido
            </label>
            <textarea id="descricao-contestacao" rows={4}
              maxLength={MAXIMO_RELATO_CONTESTACAO}
              value={descricaoContestacao}
              onChange={(e) => setDescricaoContestacao(e.target.value)}
              placeholder="O que foi combinado e o que de fato aconteceu."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            {/* O contador só fala enquanto falta texto; cumprido o mínimo,
                ele não tem mais o que dizer. */}
            {descricaoContestacao.trim().length < MINIMO_RELATO_CONTESTACAO && (
              <p className="mt-1 text-xs text-slate-500">
                Mínimo de {MINIMO_RELATO_CONTESTACAO} caracteres
                ({descricaoContestacao.trim().length} até agora).
              </p>
            )}
          </div>

          {/* RF069-B / UC 042, passo 5 — as fotos escolhidas junto com o
              motivo e a descrição. Seguem no mesmo clique de "Enviar
              contestação"; até lá ficam só no navegador. */}
          <EscolhaFotosContestacao id="fotos-contestacao-cliente"
            fotos={fotosContestacao} aoAlterar={setFotosContestacao}
            processando={processando} />

          {erroContestacao && <p className="text-sm text-perigo-600">{erroContestacao}</p>}

          <div className="space-y-2">
            {/* RN069 — o envio único dito ao lado do botão: depois, não há
                como voltar atrás. */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button"
                disabled={processando || motivoContestacao === ''
                  || descricaoContestacao.trim().length < MINIMO_RELATO_CONTESTACAO}
                onClick={() => enviarContestacao()}
                className="rounded-lg bg-atencao-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-atencao-700 disabled:opacity-50">
                {processando
                  ? (fotosContestacao.length > 0 ? 'Enviando contestação e fotos...' : 'Enviando...')
                  : 'Enviar contestação'}
              </button>
              <button type="button" onClick={() => voltarDaContestacao()}
                disabled={processando}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Voltar
              </button>
              <span className="text-xs text-slate-500">{AVISO_ENVIO_UNICO_CONTESTACAO}</span>
            </div>
            <LinkProvaPeloSuporte idSolicitacao={solicitacao.id} />
          </div>
        </div>
      )}
    </div>
  );

  // UC 021 — a avaliação, num cartão PRÓPRIO. Antes ela ia no fim do cartão
  // do painel, depois de uma divisória que a separava do que estivesse
  // aberto acima; quando não havia nada aberto, sobrava a linha sozinha no
  // topo do cartão. Num cartão só dela, cada coisa tem a sua moldura, como
  // a contestação.
  const avaliacao = solicitacao.status === 'concluido' ? (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <FormularioAvaliacao
        avaliacao={solicitacao.id_avaliacao ? {
          id: solicitacao.id_avaliacao,
          nota: solicitacao.nota,
          comentario: solicitacao.comentario,
          status_avaliacao: solicitacao.status_avaliacao,
        } : null}
        processando={processando}
        aoEnviar={async ({ nota, comentario, visibilidade }) => {
          setErro('');
          setMensagem('');
          setProcessando(true);
          try {
            const resposta = await fetch('/api/avaliacoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idSolicitacao: solicitacao.id, nota, comentario, visibilidade,
              }),
            });
            const dados = await resposta.json();
            if (!resposta.ok) {
              setErro(dados.erro ?? 'Não foi possível registrar a avaliação.');
              return;
            }
            setMensagem('Avaliação registrada. Obrigado!');
            router.refresh();
          } catch {
            setErro('Falha de conexão. Tente novamente.');
          } finally {
            setProcessando(false);
          }
        }} />
    </div>
  ) : null;

  // UC 042/043 — a contestação registrada, num cartão PRÓPRIO, abaixo do
  // resumo. Dentro dele, a descrição e as fotos esticavam a coluna da foto
  // do serviço junto. Aberta enquanto pendente, porque é o assunto em aberto
  // da solicitação; fechada depois de julgada, porque a faixa de cima já diz
  // o desfecho.
  const contestacao = solicitacao.status_contestacao ? (
    <CartaoRecolhivel tom="atencao" abertoPorPadrao={contestacaoPendente}
      resumo={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Contestação:{' '}
            {ROTULO_MOTIVO_CONTESTACAO[solicitacao.motivo_contestacao_cliente]}
          </span>
          {contestacaoPendente ? (
            <Etiqueta tom="atencao" formato="caixa" contorno>Em análise</Etiqueta>
          ) : (
            <Etiqueta formato="caixa" contorno
              tom={TOM_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}>
              {ROTULO_RESULTADO_CONTESTACAO[solicitacao.resultado_contestacao]}
            </Etiqueta>
          )}
        </span>
      }>
      <p className="whitespace-pre-line text-slate-700">
        {solicitacao.descricao_contestacao_cliente}
      </p>
      {/* RF069-B — as fotos que vieram com a contestação, logo abaixo do
          texto que elas acompanham, só para rever: o envio é único (RN069).
          Decidida a contestação, elas já foram apagadas e o componente não
          mostra nada. */}
      {contestacaoPendente && <FotosContestacao idSolicitacao={solicitacao.id} />}
      <p className="text-xs text-slate-500">
        Enviada em {formatarDataHora(solicitacao.data_contestacao_cliente)}.
        {contestacaoPendente
          && ' Até a decisão, a conclusão não é confirmada automaticamente.'}
      </p>

      {contestacaoPendente ? (
        <LinkProvaPeloSuporte idSolicitacao={solicitacao.id} />
      ) : (
        <div className="space-y-1 border-t border-slate-200 pt-3">
          <p className="font-medium text-slate-800">Justificativa da decisão</p>
          <p className="whitespace-pre-line text-slate-700">
            {solicitacao.justificativa_contestacao}
          </p>
          <p className="text-xs text-slate-500">
            Analisada em {formatarDataHora(solicitacao.data_analise_contestacao)}.
          </p>
        </div>
      )}
    </CartaoRecolhivel>
  ) : null;

  const cartao = (
    <CartaoSolicitacao como="div"
        titulo={solicitacao.servico}
        subtitulo={solicitacao.fornecedor}
        preco={formatarPreco(solicitacao.valor_final)}
        foto={solicitacao.foto_principal}
        etiquetas={
          <>
            <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]} formato="ponto">
              {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
            </Etiqueta>
            {contestacaoPendente && (
              <Etiqueta tom="atencao" formato="ponto">Em contestação</Etiqueta>
            )}
          </>
        }
        quando={`${formatarDataHora(solicitacao.data_hora_evento)} · ${solicitacao.duracao}h`}
        convidados={`${solicitacao.numero_convidados} convidados`}
        local={`${solicitacao.cidade}/${solicitacao.estado}`}
        hrefTitulo={`/servicos/${solicitacao.id_servico}`}
        hrefSubtitulo={`/fornecedores/${solicitacao.id_fornecedor}`}
        >

        {solicitacao.status === 'aguardando_analise' && (
          <AvisoCartao>
            O fornecedor tem até{' '}
            {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)} para responder.
          </AvisoCartao>
        )}

        {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
          <AvisoCartao tom="atencao">
            Pague até {formatarDataHora(solicitacao.data_limite)} para confirmar.
          </AvisoCartao>
        )}

        {solicitacao.status === 'confirmado' && !aguardandoConfirmacao
          && !solicitacao.data_registro_conclusao_fornecedor && (
            <AvisoCartao tom="festa">
              Contratação confirmada. Após o evento, o fornecedor registra a conclusão
              e você confirma por aqui.
            </AvisoCartao>
          )}

        {/* UC 020 / UC 042 — o fornecedor registrou; falta você. */}
        {aguardandoConfirmacao && (
          <AvisoCartao tom="atencao">
            O fornecedor registrou a conclusão do serviço em{' '}
            {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}. Se você
            não responder em {prazoConfirmacaoHoras} horas, o sistema confirma
            automaticamente.
          </AvisoCartao>
        )}

        {solicitacao.status === 'concluido' && (
          <AvisoCartao tom="sucesso">
            Serviço concluído em{' '}
            {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
          </AvisoCartao>
        )}

        {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
          <AvisoCartao>
            <span className="font-medium">Motivo da recusa: </span>
            {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
          </AvisoCartao>
        )}

        {/* UC 022 — cancelamento registrado. Fio à esquerda, e não caixa
            dentro do cartão; os dados do reembolso por boleto, que têm
            formulário, ficam num cartão próprio logo abaixo deste. */}
        {solicitacao.id_cancelamento && (
          <Bloco tom="perigo" className="mt-4"
            rotulo={`${ROTULO_ORIGEM_CANCELAMENTO[solicitacao.solicitado_por]} · ${
              ROTULO_STATUS_CANCELAMENTO[solicitacao.status_cancelamento]}`}>
            <span className="block">
              <span className="font-medium">Motivo: </span>
              {solicitacao.motivo_cancelamento}
            </span>
            {Number(solicitacao.valor_reembolso) > 0 && (
              <span className="mt-1 block">
                <span className="font-medium">Reembolso: </span>
                {formatarPreco(solicitacao.valor_reembolso)}
              </span>
            )}
            {Number(solicitacao.valor_multa) > 0 && (
              <span className="mt-1 block">
                <span className="font-medium">Valor retido: </span>
                {formatarPreco(solicitacao.valor_multa)}
              </span>
            )}
          </Bloco>
        )}

        {/* RF067 / RN052 — denúncia já registrada. */}
        {podeDenunciar && solicitacao.id_denuncia && (
          <Bloco className="mt-4"
            tom={solicitacao.status_denuncia === 'analisada' ? 'neutro' : 'atencao'}
            rotulo={solicitacao.status_denuncia === 'analisada'
              ? `Denúncia registrada · ${ROTULO_RESULTADO_DENUNCIA[solicitacao.resultado_analise]}`
              : 'Denúncia registrada · em análise'}>
            {solicitacao.status_denuncia === 'analisada'
              ? solicitacao.justificativa_analise
              : 'A administração vai analisar e você será avisado do resultado.'}
          </Bloco>
        )}

        <BarraAcoes>
            {solicitacao.status === 'aguardando_pagamento' && solicitacao.id_pagamento && (
              <BotaoAcao tom="principal" Icone={CreditCard}
                href={`/pagamento/${solicitacao.id_pagamento}`}>
                Pagar
              </BotaoAcao>
            )}

            {aguardandoConfirmacao && (
              <BotaoAcao tom="principal" Icone={CheckCircle2} disabled={processando}
                onClick={() => acionar(
                  { acao: 'confirmar_conclusao' },
                  'Conclusão confirmada. Obrigado!'
                )}>
                Confirmar conclusão
              </BotaoAcao>
            )}

            {temChat && (
              <BotaoAcao tom="secundario" Icone={MessageCircle}
                contador={solicitacao.nao_lidas}
                onClick={() => setPainel('conversar')}>
                {podeEscrever ? 'Conversar' : 'Ver conversa'}
              </BotaoAcao>
            )}

            {aguardandoConfirmacao && (
              <BotaoAcao tom="atencao" Icone={AlertTriangle} disabled={processando}
                onClick={() => setPainel('contestar')}>
                Contestar conclusão
              </BotaoAcao>
            )}

            {podeCancelar && (
              <BotaoAcao tom="perigo" Icone={XCircle}
                onClick={() => setPainel('cancelar')}>
                Cancelar
              </BotaoAcao>
            )}

            {/* RF058 / UC 034 — comprovante não fiscal. */}
            {solicitacao.status_pagamento === 'pago' && (
              <LinkAcao href={`/api/comprovantes/${solicitacao.id}`} Icone={Download}>
                Comprovante
              </LinkAcao>
            )}

            {podeDenunciar && !solicitacao.id_denuncia && denunciaNoPrazo && (
              <BotaoAcao tom="discreto" Icone={Flag}
                onClick={() => setPainel('denunciar')}>
                Denunciar
              </BotaoAcao>
            )}

            {/* UC 040, fluxo 2b — fora do prazo da RN052, a denúncia some e
                o caminho passa a ser o suporte, já com o contexto. */}
            {podeDenunciar && !solicitacao.id_denuncia && !denunciaNoPrazo && (
              <LinkAcao
                href={`/suporte?assunto=denuncia&origem=solicitacao&solicitacao=${solicitacao.id}`}
                Icone={Headset}>
                Relatar ao suporte
              </LinkAcao>
            )}
        </BarraAcoes>
      </CartaoSolicitacao>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/minhas-solicitacoes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Minhas solicitações
      </Link>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="mb-4 text-sm text-perigo-600">{erro}</p>}

      {cartao}

      {/* UC 036 — reembolso de pagamento por boleto precisa de dados de
          recebimento; Pix e cartão voltam sozinhos. Cartão próprio, fora do
          resumo (CT-80). Some quando o reembolso segue para o gateway. */}
      {solicitacao.id_cancelamento
        && solicitacao.status_cancelamento === 'em_analise'
        && Number(solicitacao.valor_reembolso) > 0
        && solicitacao.forma_pagamento === 'boleto' && (
          <DadosReembolso
            idCancelamento={solicitacao.id_cancelamento}
            valor={solicitacao.valor_reembolso}
            titular={titular}
            dados={solicitacao.id_dados_reembolso ? {
              status_validacao: solicitacao.validacao_reembolso,
              motivo_rejeicao: solicitacao.motivo_rejeicao_reembolso,
              tipo_recebimento: solicitacao.tipo_recebimento,
              chave_pix: solicitacao.chave_pix,
              tipo_chave_pix: solicitacao.tipo_chave_pix,
              banco: solicitacao.banco,
              tipo_conta: solicitacao.tipo_conta,
              agencia: solicitacao.agencia,
              numero_conta: solicitacao.numero_conta,
            } : null} />
        )}

      {contestacao}

      {/* O painel aberto — conversa, cancelamento, recusa, denúncia,
          contestação, avaliação — é um cartão à parte, abaixo do resumo.
          Antes ele abria DENTRO do cartão, empurrado para o rodapé, e num
          celular isso significava um chat de 500px nascendo embaixo da
          foto: quem clicava em "Conversar" via o cartão crescer e tinha de
          rolar para descobrir onde a conversa começava. Fora dele, cada
          coisa tem a sua moldura — o resumo é o resumo, o que você abriu
          é o que você abriu. */}
      {conteudoPainel && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {conteudoPainel}
        </div>
      )}

      {avaliacao}

      {/* RF023 — o histórico embaixo do resumo: primeiro o que a
          solicitação é, depois como ela chegou até aqui. */}
      <LinhaDoTempo solicitacao={solicitacao} />
    </main>
  );
}
