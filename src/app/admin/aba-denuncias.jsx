'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Star, EyeOff, Check, X, Gavel } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoAdmin, {
  Bloco, AcoesAdmin, NotaAba, ListaVazia,
} from '@/componentes/cartao-admin';
import { BotaoAcao } from '@/componentes/acoes-solicitacao';
import { CampoTexto } from '@/componentes/campo';
import {
  ROTULO_MOTIVO,
  ROTULO_RESULTADO_DENUNCIA,
  TOM_RESULTADO_DENUNCIA,
} from '@/lib/denuncia';
import { formatarDataHora } from '@/lib/datas';

// RF068 / UC 026 — análise das denúncias.

export default function AbaDenuncias({ denuncias }) {
  const router = useRouter();
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const pendentes = denuncias.filter((d) => d.status_denuncia === 'pendente');

  async function analisar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/denuncias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return false;
      }
      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível registrar a análise.');
        return false;
      }

      setMensagem(textoSucesso);
      router.refresh();
      return true;
    } catch {
      setErro('Falha de conexão. Tente novamente.');
      return false;
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-4">
      <NotaAba>
        A denúncia é disciplinar: não gera reembolso, não bloqueia repasse e não
        suspende conta por si só. Se o caso justificar suspensão, ela é registrada
        na aba Contas.
      </NotaAba>

      {pendentes.length > 0 && (
        <NotaAba tom="atencao" Icone={Flag}>
          {pendentes.length === 1
            ? '1 denúncia aguardando análise.'
            : `${pendentes.length} denúncias aguardando análise.`}
        </NotaAba>
      )}

      {mensagem && (
        <p className="rounded-xl bg-sucesso-50 px-4 py-3 text-sm text-sucesso-800">{mensagem}</p>
      )}
      {erro && (
        <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">{erro}</p>
      )}

      {denuncias.length === 0 ? (
        <ListaVazia>Nenhuma denúncia registrada.</ListaVazia>
      ) : (
        <ul className="space-y-4">
          {denuncias.map((denuncia) => (
            <ItemDenuncia key={`${denuncia.id}-${denuncia.status_denuncia}`}
              denuncia={denuncia} processando={processando} aoAnalisar={analisar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemDenuncia({ denuncia, processando, aoAnalisar }) {
  const [decidindo, setDecidindo] = useState(null); // 'procedente' | 'improcedente'
  const [justificativa, setJustificativa] = useState('');
  const [ocultar, setOcultar] = useState(false);
  const [motivoOcultacao, setMotivoOcultacao] = useState('');

  const pendente = denuncia.status_denuncia === 'pendente';
  const ehDeAvaliacao = denuncia.tipo_denuncia === 'avaliacao';
  // RN045 — só há o que moderar enquanto o comentário estiver visível.
  const podeOcultar = ehDeAvaliacao
    && denuncia.comentario
    && denuncia.origem_ocultacao !== 'moderacao';

  const rodape = !pendente ? (
    <p className="text-sm text-slate-600">
      Denúncia analisada. A decisão foi comunicada a quem denunciou.
    </p>
  ) : decidindo ? (
    <div className="space-y-3">
      <CampoTexto label="Justificativa da decisão" name={`justificativa-denuncia-${denuncia.id}`}
        rows={3} value={justificativa} minimo={20}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="O texto é exibido a quem denunciou." />

      {/* UC 026 — a remoção do comentário é decisão separada. Uma
          avaliação negativa porém legítima é julgada improcedente e
          permanece no ar (RN045). */}
      {decidindo === 'procedente' && podeOcultar && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={ocultar}
              onChange={(e) => setOcultar(e.target.checked)}
              className="mt-1 h-4 w-4 accent-festa-600" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <EyeOff className="h-4 w-4 text-slate-600" aria-hidden="true" />
                Remover o comentário da vitrine
              </span>
              <span className="block text-xs text-slate-500">
                A nota continua contando na média do serviço; só o texto deixa de
                aparecer.
              </span>
            </span>
          </label>

          {ocultar && (
            <div className="mt-3">
              <CampoTexto label="Motivo da remoção" name={`motivo-ocultacao-${denuncia.id}`}
                rows={2} value={motivoOcultacao} minimo={10}
                onChange={(e) => setMotivoOcultacao(e.target.value)}
                placeholder="Fica registrado e é informado a quem escreveu." />
            </div>
          )}
        </div>
      )}

      <AcoesAdmin>
        <BotaoAcao tom={decidindo === 'procedente' ? 'perigoCheio' : 'principal'}
          Icone={Gavel}
          disabled={processando
            || justificativa.trim().length < 20
            || (ocultar && motivoOcultacao.trim().length < 10)}
          onClick={async () => {
            const certo = await aoAnalisar({
              id: denuncia.id,
              resultado: decidindo,
              justificativa,
              ocultarComentario: decidindo === 'procedente' && ocultar,
              motivoOcultacao,
            }, decidindo === 'procedente' && ocultar
              ? 'Denúncia procedente e comentário removido da vitrine.'
              : `Denúncia julgada ${decidindo}.`);
            if (certo) {
              setDecidindo(null);
              setJustificativa('');
              setOcultar(false);
              setMotivoOcultacao('');
            }
          }}>
          Confirmar decisão
        </BotaoAcao>
        <BotaoAcao tom="discreto" disabled={processando}
          onClick={() => { setDecidindo(null); setOcultar(false); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : (
    <AcoesAdmin>
      <BotaoAcao tom="perigo" Icone={Check} disabled={processando}
        onClick={() => { setDecidindo('procedente'); setJustificativa(''); }}>
        Julgar procedente
      </BotaoAcao>
      <BotaoAcao tom="discreto" Icone={X} disabled={processando}
        onClick={() => { setDecidindo('improcedente'); setJustificativa(''); }}>
        Julgar improcedente
      </BotaoAcao>
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={ehDeAvaliacao ? 'Comentário denunciado' : 'Fornecedor denunciado'}
      subtitulo={
        <>
          {denuncia.servico} · {denuncia.fornecedor}
          <span className="mt-0.5 block text-xs text-slate-500">
            Denunciado por {ehDeAvaliacao ? denuncia.fornecedor : denuncia.cliente} em{' '}
            {formatarDataHora(denuncia.data_denuncia)}
          </span>
        </>
      }
      etiqueta={pendente
        ? <Etiqueta tom="atencao" formato="ponto">pendente de análise</Etiqueta>
        : (
          <Etiqueta tom={TOM_RESULTADO_DENUNCIA[denuncia.resultado_analise]} formato="ponto">
            {ROTULO_RESULTADO_DENUNCIA[denuncia.resultado_analise]}
          </Etiqueta>
        )}
      rodape={rodape}
    >
      <Bloco tom="perigo" rotulo={ROTULO_MOTIVO[denuncia.motivo_padrao]}>
        {denuncia.motivo}
      </Bloco>

      {/* O conteúdo denunciado, para a análise não depender de memória. */}
      {ehDeAvaliacao && (
        <Bloco rotulo={`Avaliação de ${denuncia.cliente}`}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="flex" aria-label={`Nota ${denuncia.nota} de 5`}>
              {[1, 2, 3, 4, 5].map((posicao) => (
                <Star key={posicao} aria-hidden="true"
                  className={`h-4 w-4 ${posicao <= denuncia.nota
                    ? 'fill-atencao-600 text-atencao-600'
                    : 'text-slate-300'}`} />
              ))}
            </span>
            {denuncia.origem_ocultacao === 'moderacao' && (
              <Etiqueta tom="perigo" formato="caixa" contorno>já removido</Etiqueta>
            )}
          </span>
          <span className="mt-2 block">{denuncia.comentario}</span>
        </Bloco>
      )}

      {!pendente && (
        <Bloco rotulo={`Justificativa · ${formatarDataHora(denuncia.data_analise)}`}>
          {denuncia.justificativa_analise}
        </Bloco>
      )}
    </CartaoAdmin>
  );
}
