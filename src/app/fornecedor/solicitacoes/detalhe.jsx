'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Star, Check, X, MessageCircle, CheckCircle2, XCircle, Download, Flag,
} from 'lucide-react';
import { CampoSelecao } from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import DialogoCancelamento from '@/componentes/dialogo-cancelamento';
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
} from '@/lib/solicitacao';
import {
  ROTULO_STATUS_CANCELAMENTO,
  ROTULO_ORIGEM_CANCELAMENTO,
  impedimentoParaCancelar,
} from '@/lib/cancelamento';
import {
  ROTULO_MOTIVO_CONTESTACAO,
  MINIMO_RELATO_CONTESTACAO,
  MAXIMO_RELATO_CONTESTACAO,
  AVISO_ENVIO_UNICO_CONTESTACAO,
} from '@/lib/contestacao';
import Chat from '@/componentes/chat';
import DialogoDenuncia from '@/componentes/dialogo-denuncia';
import FotosContestacao from '@/componentes/fotos-contestacao';
import EscolhaFotosContestacao, {
  descartarFotos,
} from '@/componentes/escolha-fotos-contestacao';
import { ROTULO_RESULTADO_DENUNCIA } from '@/lib/denuncia';
import { formatarDataHora } from '@/lib/datas';
import LinhaDoTempo from '@/componentes/linha-do-tempo';

function somarDias(iso, dias) {
  const data = new Date(iso);
  data.setDate(data.getDate() + dias);
  return data;
}

// UC 015, passos 3 e 4 — a página de UMA solicitação recebida.
//
// Gêmea da página do cliente, e pelo mesmo motivo: o caso de uso descreve
// o fornecedor acessando a lista, selecionando uma solicitação e o sistema
// exibindo os detalhes. Aqui ficam o endereço completo, os dados do
// aniversariante, as observações, a avaliação recebida e os painéis de
// recusa, cancelamento, denúncia e conversa.
export default function DetalheSolicitacaoRecebida({
  solicitacao, prazoRegistroDias, prazoConfirmacaoHoras,
}) {
  const router = useRouter();
  const [painel, setPainel] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [mensagem, setMensagem] = useState('');
  // RF069-B / UC 046 — a versão do fornecedor sobre a contestação: o texto
  // e as fotos, ainda só no navegador até o envio.
  const [versao, setVersao] = useState('');
  const [fotosVersao, setFotosVersao] = useState([]);
  const [erroVersao, setErroVersao] = useState('');

  function fecharPainel() {
    setPainel(null);
  }

  async function acionar(corpo, textoSucesso) {
    setErroGeral('');
    setMensagem('');
    setProcessando(true);

    try {
      const resposta = await fetch(`/api/fornecedor/solicitacoes/${solicitacao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroGeral(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      fecharPainel();
      setMotivo('');
      setMensagem(textoSucesso);
      router.refresh();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  // UC 046 — texto e fotos num envio só, e numa transação só no servidor
  // (RN069). Se uma foto for recusada, nada é registrado e o formulário
  // continua preenchido para a troca.
  async function enviarVersao() {
    setErroVersao('');
    setErroGeral('');
    setMensagem('');
    setProcessando(true);

    const formulario = new FormData();
    formulario.append('descricao', versao);
    fotosVersao.forEach((foto) => formulario.append('fotos', foto.arquivo));

    try {
      const resposta = await fetch(`/api/solicitacoes/${solicitacao.id}/contestacao`, {
        method: 'POST',
        body: formulario,
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroVersao(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        // 409 é estado que mudou com a tela aberta — a administração
        // decidiu, ou a versão já tinha sido enviada em outra aba. O aviso
        // sobe para o topo, porque o cartão onde estava o formulário pode
        // sumir na recarga.
        if (resposta.status === 409) {
          setErroGeral(dados.erro ?? 'A contestação mudou de situação.');
          router.refresh();
        } else {
          setErroVersao(dados.erro ?? 'Não foi possível enviar a sua versão.');
        }
        return;
      }

      descartarFotos(fotosVersao);
      setFotosVersao([]);
      setVersao('');
      setMensagem('Sua versão foi enviada. A administração vai considerá-la na análise.');
      router.refresh();
    } catch {
      setErroVersao('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  const aberta = solicitacao.status === 'aguardando_analise';
  const eventoTerminou = new Date(solicitacao.termino_previsto) <= new Date();

  const podeRegistrarConclusao =
    solicitacao.status === 'confirmado'
    && eventoTerminou
    && !solicitacao.data_registro_conclusao_fornecedor;

  const aguardandoCliente =
    solicitacao.status === 'confirmado'
    && Boolean(solicitacao.data_registro_conclusao_fornecedor);

  const impedimento = impedimentoParaCancelar({
    status: solicitacao.status,
    dataEvento: solicitacao.data_hora_evento,
    temCancelamento: Boolean(solicitacao.id_cancelamento),
    conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
    contestacaoPendente: solicitacao.status_contestacao === 'pendente',
  });
  const podeCancelar = impedimento === null;

  // O histórico continua acessível com o canal encerrado: é nele
  // que ficou combinada a execução, e é o que sustenta uma
  // contestação depois. Escrever, só dentro da janela da RN022.
  const temChat = ['aguardando_pagamento', 'confirmado', 'concluido', 'cancelado']
    .includes(solicitacao.status);
  const podeEscrever = chatAberto({
    status: solicitacao.status,
    conclusaoRegistrada: Boolean(solicitacao.data_registro_conclusao_fornecedor),
  });

  const pagamento = solicitacao.status_pagamento ? {
    status: solicitacao.status_pagamento,
    valor_bruto: solicitacao.valor_bruto,
  } : null;

  // RN009 — antes de aprovar, o fornecedor vê só a região; o
  // endereço completo aparece quando a contratação existe.
  const mostrarEnderecoCompleto =
    !aberta && !['recusado', 'expirado'].includes(solicitacao.status);

  // O painel aberto vai por fora da linha da foto (prop "painel"):
  // dentro dela, um chat de 500px esticava a faixa lateral junto.
  const conteudoPainel = painel === null ? null : (
    <>

      {painel === 'conversar' && (
        <>
          <Chat
            idSolicitacao={solicitacao.id}
            titulo={`Conversa com ${solicitacao.cliente}`}
            aoFechar={() => fecharPainel()}
            aoAlterar={() => router.refresh()} />
        </>
      )}

      {/* UC 015 — recusar exige motivo. */}
      {painel === 'recusar' && (
        <div className="space-y-3">
          {/* As opções saem do mesmo mapa que desenha o motivo
              depois de recusada, logo abaixo nesta tela. Escritas
              à mão, as duas listas já tinham divergido: aqui dizia
              "Inviabilidade técnica ou logística" e o registro da
              recusa, "Inviabilidade técnica, operacional ou
              logística". O nome é único por cartão porque vários
              podem estar abertos ao mesmo tempo. */}
          <CampoSelecao label="Motivo da recusa"
            name="motivo-recusa" value={motivo}
            onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Selecione</option>
            {Object.entries(ROTULO_MOTIVO_RECUSA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </CampoSelecao>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={processando || motivo === ''}
              onClick={() => acionar(
                { acao: 'recusar', motivoRecusa: motivo },
                'Solicitação recusada.'
              )}
              className="rounded-lg bg-perigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-perigo-700 disabled:opacity-50">
              Confirmar recusa
            </button>
            <button type="button"
              onClick={() => { fecharPainel(); setMotivo(''); }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Voltar
            </button>
          </div>
        </div>
      )}

      {painel === 'cancelar' && (
        <>
          <DialogoCancelamento
            solicitadoPor="fornecedor"
            dataEvento={solicitacao.data_hora_evento}
            pagamento={pagamento}
            processando={processando}
            aoVoltar={() => fecharPainel()}
            aoCancelar={(motivoTexto) => acionar(
              { acao: 'cancelar', motivo: motivoTexto },
              'Cancelamento registrado. O cliente será reembolsado integralmente.'
            )} />
        </>
      )}

      {painel === 'denunciar' && (
        <>
          <DialogoDenuncia
            tipo="avaliacao"
            alvo={{ idAvaliacao: solicitacao.id_avaliacao }}
            aoVoltar={() => fecharPainel()}
            aoConcluir={() => {
              fecharPainel();
              setMensagem('Denúncia registrada. A administração vai analisar.');
              router.refresh();
            }} />
        </>
      )}
    </>
  );

  // UC 042 — a contestação do cliente, num cartão PRÓPRIO abaixo do resumo,
  // como na tela do cliente. Dentro dele, a descrição e as fotos esticavam a
  // coluna da foto do serviço junto. Só aparece pendente: é quando o
  // fornecedor ainda tem o que fazer (a sua versão, UC 046); julgada, o
  // desfecho está na linha do tempo e nos avisos.
  const versaoEnviada = Boolean(solicitacao.data_contestacao_fornecedor);
  const contestacao = solicitacao.status_contestacao === 'pendente' ? (
    <CartaoRecolhivel tom="atencao" abertoPorPadrao
      resumo={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            O cliente contestou a conclusão:{' '}
            {ROTULO_MOTIVO_CONTESTACAO[solicitacao.motivo_contestacao_cliente]}
          </span>
          <Etiqueta tom="atencao" formato="caixa" contorno>Em análise</Etiqueta>
        </span>
      }>
      <p className="whitespace-pre-line text-slate-700">
        {solicitacao.descricao_contestacao_cliente}
      </p>
      <p className="text-xs text-slate-500">
        Enviada em {formatarDataHora(solicitacao.data_contestacao_cliente)}.
        A administração vai analisar e decidir.
      </p>

      {versaoEnviada ? (
        // Enviada, a versão vira só leitura (RN069): é ela, e não um
        // rascunho, que a administração está lendo.
        <div className="space-y-3 border-t border-atencao-200 pt-3">
          <div className="space-y-1">
            <p className="font-medium text-slate-800">Sua versão</p>
            <p className="whitespace-pre-line text-slate-700">
              {solicitacao.descricao_contestacao_fornecedor}
            </p>
            <p className="text-xs text-slate-500">
              Enviada em {formatarDataHora(solicitacao.data_contestacao_fornecedor)}.
              Só a administração vê a sua versão.
            </p>
          </div>
          <FotosContestacao idSolicitacao={solicitacao.id} />
        </div>
      ) : (
        // RF069-B / UC 046 — até aqui o fornecedor só lia a acusação e podia
        // mandar fotos soltas. Agora ele conta o seu lado, com as fotos
        // junto, logo abaixo do que o cliente escreveu, onde ele já está
        // olhando.
        <div className="mt-2 space-y-4 rounded-lg border border-atencao-200 bg-atencao-50 p-4">
          <div>
            <p className="font-medium text-slate-800">Sua versão</p>
            <p className="mt-0.5 text-xs text-slate-600">
              Conte o que foi combinado e o que foi entregue. Só a administração vê o
              seu texto e as suas fotos — o cliente não. Não há prazo para enviar, mas a
              administração pode decidir a qualquer momento.
            </p>
          </div>

          <div>
            <label htmlFor="versao-fornecedor"
              className="mb-1.5 block text-sm font-medium text-slate-700">
              Descreva a sua versão
            </label>
            <textarea id="versao-fornecedor" rows={4}
              maxLength={MAXIMO_RELATO_CONTESTACAO}
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="Horário de chegada, o que foi montado e entregue, o que foi combinado pelo chat."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <p className="mt-1 text-xs text-slate-500">
              {versao.trim().length}/{MINIMO_RELATO_CONTESTACAO} caracteres mínimos.
            </p>
          </div>

          <EscolhaFotosContestacao id="fotos-versao-fornecedor"
            idSolicitacao={solicitacao.id}
            fotos={fotosVersao} aoAlterar={setFotosVersao}
            processando={processando}
            orientacao="Mostre o serviço prestado: a montagem, a estrutura, a decoração no local." />

          {/* RN069 — dito antes do botão: depois, não há como voltar atrás. */}
          <p className="text-xs text-slate-600">{AVISO_ENVIO_UNICO_CONTESTACAO}</p>

          {erroVersao && <p className="text-sm text-perigo-600">{erroVersao}</p>}

          <button type="button"
            disabled={processando || versao.trim().length < MINIMO_RELATO_CONTESTACAO}
            onClick={() => enviarVersao()}
            className="rounded-lg bg-atencao-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-atencao-700 disabled:opacity-50">
            {processando
              ? (fotosVersao.length > 0 ? 'Enviando versão e fotos...' : 'Enviando...')
              : 'Enviar minha versão'}
          </button>
        </div>
      )}
    </CartaoRecolhivel>
  ) : null;

  const cartao = (
    <CartaoSolicitacao como="div"
        titulo={solicitacao.servico}
        subtitulo={`Cliente: ${solicitacao.cliente}`}
        preco={formatarPreco(solicitacao.valor_final)}
        foto={solicitacao.foto_principal}
        etiquetas={
          <>
            <Etiqueta tom={TOM_STATUS_SOLICITACAO[solicitacao.status]} formato="ponto">
              {ROTULO_STATUS_SOLICITACAO[solicitacao.status]}
            </Etiqueta>
            {solicitacao.status_contestacao === 'pendente' && (
              <Etiqueta tom="atencao" formato="ponto">Em contestação</Etiqueta>
            )}
          </>
        }
        quando={`${formatarDataHora(solicitacao.data_hora_evento)} · ${solicitacao.duracao}h`}
        convidados={`${solicitacao.numero_convidados} convidados · ${solicitacao.tipo_local}`}
        local={mostrarEnderecoCompleto
          ? `${solicitacao.rua}, ${solicitacao.numero}${
            solicitacao.complemento ? ` — ${solicitacao.complemento}` : ''
          } · ${solicitacao.bairro} · ${solicitacao.cidade}/${solicitacao.estado} · CEP ${solicitacao.cep}`
          : `${solicitacao.bairro}, ${solicitacao.cidade}/${solicitacao.estado}`}
        >

        {(solicitacao.tema || solicitacao.nome_aniversariante || solicitacao.observacoes) && (
          <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {solicitacao.tema && (
              <p><span className="font-medium">Tema: </span>{solicitacao.tema}</p>
            )}
            {solicitacao.nome_aniversariante && (
              <p>
                <span className="font-medium">Aniversariante: </span>
                {solicitacao.nome_aniversariante}
                {solicitacao.idade_aniversariante !== null &&
                  `, ${solicitacao.idade_aniversariante} anos`}
              </p>
            )}
            {solicitacao.observacoes && (
              <p className="whitespace-pre-line">
                <span className="font-medium">Observações: </span>
                {solicitacao.observacoes}
              </p>
            )}
          </div>
        )}

        {aberta && (
          <AvisoCartao tom="atencao">
            Responda até {formatarDataHora(solicitacao.data_limite_resposta_fornecedor)}.
            Sem resposta, a solicitação expira automaticamente.
          </AvisoCartao>
        )}

        {solicitacao.status === 'recusado' && solicitacao.motivo_recusa && (
          <AvisoCartao>
            <span className="font-medium">Motivo informado: </span>
            {ROTULO_MOTIVO_RECUSA[solicitacao.motivo_recusa]}
          </AvisoCartao>
        )}

        {/* UC 019 — janela para registrar a conclusão. */}
        {solicitacao.status === 'confirmado' && !aguardandoCliente && (
          podeRegistrarConclusao ? (
            <AvisoCartao tom="festa">
              Registre a conclusão até{' '}
              {formatarDataHora(somarDias(solicitacao.termino_previsto, prazoRegistroDias))}.
              Sem registro, a solicitação é cancelada com reembolso ao cliente.
            </AvisoCartao>
          ) : (
            <AvisoCartao>
              A conclusão poderá ser registrada após o término previsto do evento, em{' '}
              {formatarDataHora(solicitacao.termino_previsto)}.
            </AvisoCartao>
          )
        )}

        {/* UC 020 — aguardando o cliente */}
        {/* RN069 — com a contestação pendente, a confirmação automática
            fica suspensa: prometer as 72h aqui contradizia o cartão da
            contestação logo abaixo. A lista já fazia essa exceção. */}
        {aguardandoCliente && solicitacao.status_contestacao !== 'pendente' && (
          <AvisoCartao tom="festa">
            Conclusão registrada em{' '}
            {formatarDataHora(solicitacao.data_registro_conclusao_fornecedor)}.
            Aguardando confirmação do cliente; sem resposta em {prazoConfirmacaoHoras}h,
            o sistema confirma automaticamente.
          </AvisoCartao>
        )}

        {solicitacao.status === 'concluido' && (
          <AvisoCartao tom="sucesso">
            Serviço concluído e confirmado em{' '}
            {formatarDataHora(solicitacao.data_confirmacao_conclusao_cliente)}.
          </AvisoCartao>
        )}

        {/* UC 022 — cancelamento registrado */}
        {solicitacao.id_cancelamento && (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">
              {ROTULO_ORIGEM_CANCELAMENTO[solicitacao.solicitado_por]} ·{' '}
              {ROTULO_STATUS_CANCELAMENTO[solicitacao.status_cancelamento]}
            </p>
            <p className="whitespace-pre-line text-slate-700">
              <span className="font-medium">Motivo: </span>
              {solicitacao.motivo_cancelamento}
            </p>
            {Number(solicitacao.valor_multa) > 0 && (
              <p className="text-slate-700">
                <span className="font-medium">Valor retido a seu favor: </span>
                {formatarPreco(solicitacao.valor_multa)}
                {solicitacao.status_repasse === 'liberado'
                  ? ' · já liberado para saque'
                  : ' · liberado quando o cancelamento concluir'}
              </p>
            )}
          </div>
        )}

        {/* RF037 — a avaliação recebida. RN062: a nota conta na
            média mesmo quando o comentário é privado ou foi ocultado
            pela moderação; só o texto deixa de aparecer. */}
        {solicitacao.id_avaliacao && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex" aria-label={`Nota ${solicitacao.nota} de 5`}>
                {[1, 2, 3, 4, 5].map((posicao) => (
                  <Star key={posicao} aria-hidden="true"
                    className={`h-4 w-4 ${posicao <= solicitacao.nota
                      ? 'fill-atencao-600 text-atencao-600'
                      : 'text-slate-300'}`} />
                ))}
              </span>
              <span className="text-sm text-slate-600">
                Avaliação de {solicitacao.cliente}
                {solicitacao.status_avaliacao === 'oculta'
                  && solicitacao.origem_ocultacao === 'usuario'
                  && ' · comentário privado'}
                {solicitacao.status_avaliacao === 'oculta'
                  && solicitacao.origem_ocultacao === 'moderacao'
                  && ' · comentário removido pela moderação'}
              </span>
            </div>

            {solicitacao.comentario && (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {solicitacao.comentario}
              </p>
            )}

            {solicitacao.comentario && solicitacao.id_denuncia && (
              <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                Comentário denunciado
                {solicitacao.status_denuncia === 'analisada'
                  ? `: ${ROTULO_RESULTADO_DENUNCIA[solicitacao.resultado_analise]}. ${solicitacao.justificativa_analise}`
                  : '. A administração vai analisar.'}
              </p>
            )}
          </div>
        )}

        <BarraAcoes>
            {aberta && (
              <BotaoAcao tom="principal" Icone={Check} disabled={processando}
                onClick={() => acionar(
                  { acao: 'aprovar' },
                  'Solicitação aprovada. O cliente foi encaminhado para o pagamento.'
                )}>
                Aprovar
              </BotaoAcao>
            )}

            {podeRegistrarConclusao && (
              <BotaoAcao tom="principal" Icone={CheckCircle2} disabled={processando}
                onClick={() => acionar(
                  { acao: 'registrar_conclusao' },
                  'Conclusão registrada. O cliente foi avisado para confirmar.'
                )}>
                Registrar conclusão
              </BotaoAcao>
            )}

            {temChat && (
              <BotaoAcao tom="secundario" Icone={MessageCircle}
                contador={solicitacao.nao_lidas}
                onClick={() => setPainel('conversar')}>
                {podeEscrever ? 'Conversar' : 'Ver conversa'}
              </BotaoAcao>
            )}

            {aberta && (
              <BotaoAcao tom="perigo" Icone={X} disabled={processando}
                onClick={() => setPainel('recusar')}>
                Recusar
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

            {/* RN052 — denúncia do comentário, não da nota. */}
            {solicitacao.id_avaliacao && solicitacao.comentario
              && !solicitacao.id_denuncia && (
                <BotaoAcao tom="discreto" Icone={Flag}
                  onClick={() => setPainel('denunciar')}>
                  Denunciar comentário
                </BotaoAcao>
              )}
        </BarraAcoes>
      </CartaoSolicitacao>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/fornecedor/solicitacoes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Solicitações recebidas
      </Link>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-perigo-600">{erroGeral}</p>}

      {cartao}

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

      {/* RF023 — o histórico embaixo do resumo: primeiro o que a
          solicitação é, depois como ela chegou até aqui. */}
      <LinhaDoTempo solicitacao={solicitacao} />
    </main>
  );
}
