'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Store, ShieldAlert, Ban, Undo2, Gavel, Check } from 'lucide-react';
import Etiqueta from '@/componentes/etiqueta';
import CartaoAdmin, {
  Fatos, Fato, Bloco, AcoesAdmin, NotaAba, ListaVazia,
} from '@/componentes/cartao-admin';
import { BotaoAcao } from '@/componentes/acoes-solicitacao';
import { CampoTexto } from '@/componentes/campo';
import { formatarDataHora } from '@/lib/datas';
import AvisoPainel from '@/componentes/aviso-painel';

// UC 027 / UC 035 — contas da plataforma: suspensão, reativação e análise
// das solicitações de revisão.

const ROTULO_STATUS = {
  ativo: 'ativa',
  suspenso: 'suspensa',
  inativo: 'inativa',
  excluido: 'excluída',
};

const TOM_STATUS = {
  ativo: 'sucesso',
  suspenso: 'perigo',
  inativo: 'neutro',
  excluido: 'neutro',
};

// Plural sem "(s)": a palavra certa para cada quantidade. Tem duas formas
// porque em português o plural nem sempre é só acrescentar a letra —
// "contestação" vira "contestações".
function plural(quantidade, singular, muitos) {
  return `${quantidade} ${quantidade === 1 ? singular : muitos}`;
}

// UC 027 — a pré-condição é existir um motivo que justifique a suspensão.
// Parte dos motivos tem registro no sistema: contestação decidida contra a
// pessoa e cancelamentos que ela causou. Outros vêm de fora (fraude,
// denúncia por e-mail, ordem judicial) — por isso a lista completa continua
// acessível, mas não é o que a aba mostra de saída.
function precisaAtencao(conta) {
  return conta.status === 'suspenso'
    || conta.status_solicitacao_revisao === 'pendente'
    || conta.alerta_contestacoes > 0
    || conta.alerta_cancelamentos > 0;
}

export default function AbaContas({ contas }) {
  const router = useRouter();
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const revisoesPendentes = contas.filter((c) => c.status_solicitacao_revisao === 'pendente');
  const comAtencao = contas.filter(precisaAtencao);
  const visiveis = mostrarTodas ? contas : comAtencao;

  async function executar(corpo, textoSucesso) {
    setErro('');
    setMensagem('');
    setProcessando(true);
    try {
      const resposta = await fetch('/api/admin/contas', {
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
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
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
      {revisoesPendentes.length > 0 && (
        <NotaAba tom="atencao" Icone={ShieldAlert}>
          {plural(revisoesPendentes.length, 'solicitação de revisão aguardando',
            'solicitações de revisão aguardando')} análise.
        </NotaAba>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {mostrarTodas
            ? `${plural(contas.length, 'conta cadastrada', 'contas cadastradas')}.`
            : `${plural(comAtencao.length, 'conta com ocorrência registrada',
                'contas com ocorrência registrada')}.`}
        </p>
        <button type="button" onClick={() => setMostrarTodas(!mostrarTodas)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          {mostrarTodas ? 'Ver só as que pedem atenção' : 'Ver todas as contas'}
        </button>
      </div>

      <AvisoPainel mensagem={mensagem} erro={erro} />

      {visiveis.length === 0 ? (
        <ListaVazia>
          {mostrarTodas
            ? 'Nenhuma conta cadastrada.'
            : 'Nenhuma conta com ocorrência registrada. Para suspender por um motivo externo à plataforma, use "Ver todas as contas".'}
        </ListaVazia>
      ) : (
        <ul className="space-y-4">
          {visiveis.map((conta) => (
            <ItemConta key={`${conta.tipo}-${conta.id}`} conta={conta}
              processando={processando} aoExecutar={executar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemConta({ conta, processando, aoExecutar }) {
  const [suspendendo, setSuspendendo] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState('');

  const ehFornecedor = conta.tipo === 'fornecedor';
  const Icone = ehFornecedor ? Store : User;
  const suspensa = conta.status === 'suspenso';
  const excluida = conta.status === 'excluido';
  const revisaoPendente = conta.status_solicitacao_revisao === 'pendente';

  const corpoBase = { tipo: conta.tipo, id: conta.id };

  const rodape = excluida ? (
    <p className="text-sm text-slate-600">
      Conta excluída em caráter definitivo (RN044). Não há ação disponível.
    </p>
  ) : suspendendo ? (
    <div className="space-y-3">
      <CampoTexto label="Motivo da suspensão" name={`motivo-suspensao-${conta.tipo}-${conta.id}`}
        rows={3} value={motivo} minimo={10} maximo={500}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="O texto é exibido ao usuário na tela de bloqueio." />
      <AcoesAdmin>
        <BotaoAcao tom="perigoCheio" Icone={Ban}
          disabled={processando || motivo.trim().length < 10 || motivo.trim().length > 500}
          onClick={async () => {
            const certo = await aoExecutar(
              { ...corpoBase, acao: 'suspender', motivo },
              'Conta suspensa. O acesso foi bloqueado.'
            );
            if (certo) { setSuspendendo(false); setMotivo(''); }
          }}>
          Confirmar suspensão
        </BotaoAcao>
        <BotaoAcao tom="discreto" onClick={() => { setSuspendendo(false); setMotivo(''); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : analisando ? (
    <div className="space-y-3">
      <CampoTexto label="Resposta à solicitação de revisão"
        name={`resposta-revisao-${conta.tipo}-${conta.id}`}
        rows={4} value={resultado} minimo={20} maximo={1000}
        onChange={(e) => setResultado(e.target.value)}
        placeholder="Explique a decisão. O texto é exibido ao usuário na tela de bloqueio." />
      <AcoesAdmin>
        <BotaoAcao tom="sucesso" Icone={Check}
          disabled={processando || resultado.trim().length < 20 || resultado.trim().length > 1000}
          onClick={async () => {
            const certo = await aoExecutar(
              { ...corpoBase, acao: 'analisar_revisao', resultado, manterSuspensao: false },
              'Revisão acolhida. A conta voltou a ficar ativa.'
            );
            if (certo) { setAnalisando(false); setResultado(''); }
          }}>
          Acolher e reativar
        </BotaoAcao>
        <BotaoAcao tom="perigo" Icone={Ban}
          disabled={processando || resultado.trim().length < 20 || resultado.trim().length > 1000}
          onClick={async () => {
            const certo = await aoExecutar(
              { ...corpoBase, acao: 'analisar_revisao', resultado, manterSuspensao: true },
              'Revisão analisada. A suspensão foi mantida.'
            );
            if (certo) { setAnalisando(false); setResultado(''); }
          }}>
          Manter suspensão
        </BotaoAcao>
        <BotaoAcao tom="discreto" onClick={() => { setAnalisando(false); setResultado(''); }}>
          Voltar
        </BotaoAcao>
      </AcoesAdmin>
    </div>
  ) : (
    <AcoesAdmin>
      {revisaoPendente && (
        <BotaoAcao tom="principal" Icone={Gavel} disabled={processando}
          onClick={() => setAnalisando(true)}>
          Analisar revisão
        </BotaoAcao>
      )}
      {suspensa ? (
        // Com revisão pendente, a reativação passa pela análise: a
        // pessoa precisa receber resposta ao que enviou (UC 035).
        !revisaoPendente && (
          <BotaoAcao tom="principal" Icone={Undo2} disabled={processando}
            onClick={() => aoExecutar({ ...corpoBase, acao: 'reativar' }, 'Conta reativada.')}>
            Reativar conta
          </BotaoAcao>
        )
      ) : (
        <BotaoAcao tom="perigo" Icone={Ban} disabled={processando}
          onClick={() => setSuspendendo(true)}>
          Suspender conta
        </BotaoAcao>
      )}
    </AcoesAdmin>
  );

  return (
    <CartaoAdmin
      titulo={ehFornecedor ? conta.nome_exibicao : conta.nome}
      subtitulo={
        <>
          {ehFornecedor ? 'Fornecedor' : 'Cliente'} · {conta.email}
          {conta.cidade && ` · ${conta.cidade}/${conta.estado}`}
        </>
      }
      miniatura={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-festa-100">
          {conta.foto_perfil ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conta.foto_perfil} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icone className="h-5 w-5 text-festa-600" aria-hidden="true" />
          )}
        </span>
      }
      etiqueta={
        <div className="flex flex-wrap justify-end gap-1.5">
          <Etiqueta tom={TOM_STATUS[conta.status]} formato="ponto">
            {ROTULO_STATUS[conta.status]}
          </Etiqueta>
          {revisaoPendente && (
            <Etiqueta tom="atencao" formato="ponto">revisão pendente</Etiqueta>
          )}
        </div>
      }
      rodape={rodape}
    >
      {(conta.alerta_contestacoes > 0 || conta.alerta_cancelamentos > 0) && (
        <div className="rounded-xl border border-atencao-200 bg-atencao-50 p-3.5">
          <Fatos>
            <Fato rotulo={ehFornecedor
              ? 'Contestações procedentes'
              : 'Contestações improcedentes'}>
              <span className="text-base font-semibold text-atencao-800">
                {conta.alerta_contestacoes}
              </span>
            </Fato>
            <Fato rotulo="Cancelamentos causados">
              <span className="text-base font-semibold text-atencao-800">
                {conta.alerta_cancelamentos}
              </span>
            </Fato>
          </Fatos>
        </div>
      )}

      {suspensa && conta.motivo_suspensao && (
        <Bloco tom="perigo"
          rotulo={`Motivo da suspensão · ${formatarDataHora(conta.data_suspensao)}`}>
          {conta.motivo_suspensao}
        </Bloco>
      )}

      {conta.status_solicitacao_revisao && (
        <Bloco
          rotulo={`Solicitação de revisão · ${formatarDataHora(conta.data_solicitacao_revisao)}`}>
          {conta.motivo_solicitacao_revisao}
          {conta.status_solicitacao_revisao === 'analisada' && (
            <span className="mt-2 block border-t border-slate-200 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resposta · {formatarDataHora(conta.data_analise_revisao)}
              </span>
              <span className="mt-1 block">{conta.resultado_solicitacao_revisao}</span>
            </span>
          )}
        </Bloco>
      )}
    </CartaoAdmin>
  );
}
